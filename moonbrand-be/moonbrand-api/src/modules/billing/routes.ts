import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { BillingConfigResponse, BillingPortalResponse, CheckoutResponse } from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLAN_IDS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { type Identity, withIdentity } from '../../db/identity';
import { ApiError } from '../../errors';
import type { PaddleApi } from './paddle-api';

// I pagamenti dallo studio, con Paddle. Il checkout si apre nel browser con Paddle.js: qui si decide cosa comprare
// (il prezzo del catalogo) e per chi (brand e utenza nei custom_data, il cliente Paddle se c'è già). Lo stato vero
// dell'abbonamento e i crediti arrivano solo dal webhook (paddle-webhook.ts).
// Un abbonamento è vivo finché Paddle non lo chiude: anche in past_due (sta riprovando il pagamento) o in pausa.
const LIVE = ['active', 'trialing', 'past_due', 'paused'];

const checkoutSchema = z.object({
  brandId: z.uuid('Brand non trovato.'),
  kind: z.enum(['plan', 'topup']),
  plan: z.enum(SUBSCRIPTION_PLAN_IDS as [SubscriptionPlanId, ...SubscriptionPlanId[]]).optional(),
});
const brandSchema = z.object({ brandId: z.uuid('Brand non trovato.') });

interface Owned {
  account_id: string;
  email: string;
  customer_id: string | null;
  subscription_id: string | null;
  plan: SubscriptionPlanId | null;
  status: string | null;
}

// Il brand di chi chiede (le policy lasciano vedere solo i propri), con la sua utenza e l'abbonamento, se c'è.
export async function ownedBrand(pool: pg.Pool, identity: Identity, brandId: string): Promise<Owned> {
  const owned = await withIdentity(pool, identity, async (db) => {
    const { rows } = await db.query<Owned>(
      `select b.account_id, a.email, a.paddle_customer_id as customer_id,
         s.paddle_subscription_id as subscription_id, s.plan, s.status
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

export const liveSubscription = (owned: Owned): boolean => Boolean(owned.subscription_id && owned.status && LIVE.includes(owned.status));

export function registerBillingRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  paddle: PaddleApi,
  settings: Pick<Config, 'PADDLE_ENV' | 'PADDLE_CLIENT_TOKEN'>,
): void {
  app.get('/v1/billing/config', (): BillingConfigResponse => {
    if (!settings.PADDLE_CLIENT_TOKEN || !paddle.configured) {
      throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'I pagamenti non sono configurati.');
    }
    return { environment: settings.PADDLE_ENV, clientToken: settings.PADDLE_CLIENT_TOKEN };
  });

  app.post('/v1/billing/checkout', async (request): Promise<CheckoutResponse> => {
    const { brandId, kind, plan } = checkoutSchema.parse(request.body);
    const owned = await ownedBrand(pool, request.identity, brandId);
    const prices = await paddle.catalog();
    let priceId: string;
    if (kind === 'plan') {
      if (!plan) throw ApiError.invalid('Scegli un piano.');
      // Un secondo abbonamento sullo stesso brand non deve nascere: il piano si cambia su quello che c'è.
      if (liveSubscription(owned)) throw ApiError.conflict('ALREADY_SUBSCRIBED', 'Questo brand ha già un piano attivo: cambialo dalle Impostazioni brand.');
      priceId = prices.plans[plan];
    } else {
      // Le ricariche valgono finché c'è l'abbonamento: senza, non si vendono.
      if (!liveSubscription(owned)) throw ApiError.conflict('NO_SUBSCRIPTION', 'Attiva prima un piano per questo brand.');
      priceId = owned.plan === 'ultra' ? prices.topupUltra : prices.topup;
    }
    return {
      priceId,
      customData: { brandId, accountId: owned.account_id },
      customer: owned.customer_id ? { id: owned.customer_id } : { email: owned.email },
    };
  });

  app.post('/v1/billing/portal', async (request): Promise<BillingPortalResponse> => {
    const { brandId } = brandSchema.parse(request.body);
    const owned = await ownedBrand(pool, request.identity, brandId);
    if (!owned.customer_id || !owned.subscription_id) throw ApiError.conflict('NO_SUBSCRIPTION', 'Questo brand non ha ancora un piano attivo.');
    return { url: await paddle.portal(owned.customer_id, [owned.subscription_id]) };
  });
}
