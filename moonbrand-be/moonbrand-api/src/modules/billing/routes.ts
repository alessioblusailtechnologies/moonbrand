import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { BillingPortalResponse, CheckoutResponse, PlanPreviewResponse } from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLAN_IDS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { type Identity, withIdentity } from '../../db/identity';
import { ApiError } from '../../errors';
import { type DodoApi, LIVE_STATUSES } from './dodo-api';

// I pagamenti dallo studio, con Dodo Payments. Il checkout è una pagina di Dodo: qui si decide cosa comprare (il prodotto
// del catalogo) e per chi (brand e utenza nei metadata, il cliente Dodo se c'è già), e lo studio ci manda il browser. Lo
// stato vero dell'abbonamento e i crediti arrivano solo dal webhook (dodo-webhook.ts).
const checkoutSchema = z.object({
  brandId: z.uuid('Brand non trovato.'),
  kind: z.enum(['plan', 'topup']),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS as [SubscriptionPlanId, ...SubscriptionPlanId[]]).optional(),
});
const brandSchema = z.object({ brandId: z.uuid('Brand non trovato.') });
const previewSchema = z.object({
  brandId: z.uuid('Brand non trovato.'),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS as [SubscriptionPlanId, ...SubscriptionPlanId[]]),
});

export const isUpgrade = (from: SubscriptionPlanId, to: SubscriptionPlanId): boolean =>
  SUBSCRIPTION_PLAN_IDS.indexOf(to) > SUBSCRIPTION_PLAN_IDS.indexOf(from);

interface Owned {
  account_id: string;
  email: string;
  name: string | null;
  locale: string | null;
  customer_id: string | null;
  subscription_id: string | null;
  plan: SubscriptionPlanId | null;
  status: string | null;
}

// Il brand di chi chiede (le policy lasciano vedere solo i propri), con la sua utenza e l'abbonamento, se c'è.
export async function ownedBrand(pool: pg.Pool, identity: Identity, brandId: string): Promise<Owned> {
  const owned = await withIdentity(pool, identity, async (db) => {
    const { rows } = await db.query<Owned>(
      `select b.account_id, a.email, a.name, a.locale, a.dodo_customer_id as customer_id,
         s.dodo_subscription_id as subscription_id, s.plan, s.status
       from presenza.brands b
       join presenza.accounts a on a.id = b.account_id
       left join presenza.brand_subscriptions s on s.brand_id = b.id
       where b.id = $1`,
      [brandId],
    );
    return rows[0];
  });
  if (!owned) throw ApiError.notFound('Brand non trovato.');
  return owned;
}

// Un abbonamento è vivo finché Dodo non lo chiude: anche con un rinnovo non pagato o in pausa.
export const liveSubscription = (owned: Owned): boolean => Boolean(owned.subscription_id && owned.status && LIVE_STATUSES.includes(owned.status));

export function registerBillingRoutes(app: FastifyInstance, pool: pg.Pool, dodo: DodoApi, settings: Pick<Config, 'STUDIO_URL'>): void {
  app.post('/v1/billing/checkout', async (request): Promise<CheckoutResponse> => {
    const { brandId, kind, plan } = checkoutSchema.parse(request.body);
    const owned = await ownedBrand(pool, request.identity, brandId);
    const catalog = await dodo.catalog();
    let productId: string;
    if (kind === 'plan') {
      if (!plan) throw ApiError.invalid('Scegli un piano.');
      // Un secondo abbonamento sullo stesso brand non deve nascere: il piano si cambia su quello che c'è.
      if (liveSubscription(owned)) throw ApiError.conflict('ALREADY_SUBSCRIBED', 'Questo brand ha già un piano attivo: cambialo dalle Impostazioni brand.');
      productId = catalog.plans[plan];
    } else {
      // Le ricariche valgono finché c'è l'abbonamento: senza, non si vendono.
      if (!liveSubscription(owned)) throw ApiError.conflict('NO_SUBSCRIPTION', 'Attiva prima un piano per questo brand.');
      productId = owned.plan === 'ultra' ? catalog.topupUltra : catalog.topup;
    }
    // Si torna nello studio su /abbonamento, dove la modale dei pagamenti aspetta il webhook; Dodo aggiunge status e
    // payment_id o subscription_id.
    const returnUrl = new URL('/abbonamento', settings.STUDIO_URL);
    returnUrl.searchParams.set('brand', brandId);
    returnUrl.searchParams.set('kind', kind);
    if (plan) returnUrl.searchParams.set('plan', plan);
    const customer = owned.customer_id ? { customerId: owned.customer_id } : { email: owned.email, name: owned.name };
    const metadata = { brandId, accountId: owned.account_id, kind, ...(kind === 'plan' && plan && { plan }) };
    // Chi rinuncia dalla pagina di Dodo torna allo stesso indirizzo con status=cancelled: lo studio non aspetta niente.
    const cancelUrl = new URL(returnUrl);
    cancelUrl.searchParams.set('status', 'cancelled');
    const checkout = await dodo.checkout(productId, customer, metadata, returnUrl.toString(), cancelUrl.toString(), owned.locale);
    // La sessione resta legata al brand: se i metadata non tornassero sul pagamento, il webhook lo ritrova da qui.
    await pool.query(
      'insert into presenza.dodo_checkouts (session_id, brand_id, account_id, kind, plan) values ($1, $2, $3, $4, $5)',
      [checkout.sessionId, brandId, owned.account_id, kind, kind === 'plan' ? plan : null],
    );
    return { url: checkout.url };
  });

  // Prima di cambiare piano: quanto costa il cambio, per farlo confermare.
  app.post('/v1/billing/plan-preview', async (request): Promise<PlanPreviewResponse> => {
    const { brandId, plan } = previewSchema.parse(request.body);
    const owned = await ownedBrand(pool, request.identity, brandId);
    if (!liveSubscription(owned) || !owned.subscription_id || !owned.plan) {
      throw ApiError.conflict('NO_SUBSCRIPTION', 'Questo brand non ha ancora un piano attivo.');
    }
    if (owned.plan === plan) throw ApiError.invalid('È già il piano del brand.');
    const catalog = await dodo.catalog();
    const upgrade = isUpgrade(owned.plan, plan);
    return { upgrade, ...(await dodo.previewPlan(owned.subscription_id, catalog.plans[plan], upgrade)) };
  });

  app.post('/v1/billing/portal', async (request): Promise<BillingPortalResponse> => {
    const { brandId } = brandSchema.parse(request.body);
    const owned = await ownedBrand(pool, request.identity, brandId);
    if (!owned.customer_id || !owned.subscription_id) throw ApiError.conflict('NO_SUBSCRIPTION', 'Questo brand non ha ancora un piano attivo.');
    return { url: await dodo.portal(owned.customer_id, new URL('/impostazioni', settings.STUDIO_URL).toString()) };
  });
}
