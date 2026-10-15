import DodoPayments, { APIError } from 'dodopayments';

import { SUBSCRIPTION_PLAN_IDS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { ApiError } from '../../errors';

// Le chiamate a Dodo Payments (docs.dodopayments.com), con l'SDK ufficiale e la chiave del venditore: modalità test o
// live secondo DODO_PAYMENTS_ENV. La chiave resta qui: allo studio arriva solo l'indirizzo della pagina di pagamento.
export type DodoSettings = Pick<Config, 'DODO_PAYMENTS_API_KEY' | 'DODO_PAYMENTS_WEBHOOK_KEY' | 'DODO_PAYMENTS_ENV'>;

export type WebhookEvent = DodoPayments.UnwrapWebhookEvent;
export type DodoSubscription = DodoPayments.Subscription;

// Gli stati di Dodo in cui un abbonamento è ancora vivo: anche appena nato (pending), con un rinnovo non pagato
// (past_due con periodo di grazia, on_hold senza) o in pausa. Finisce con cancelled, expired o failed.
export const LIVE_STATUSES = ['pending', 'active', 'past_due', 'on_hold', 'paused'];

// Cosa vale un prodotto del catalogo, dai suoi metadata: un piano (plan, monthly_credits) o una ricarica (kind topup,
// credits, tier standard o ultra). Così test e live hanno ciascuno i suoi id senza doverli copiare in configurazione.
export interface ProductInfo {
  plan?: SubscriptionPlanId;
  monthlyCredits?: number;
  kind?: string;
  credits?: number;
  tier?: string;
}

export interface Catalog {
  plans: Record<SubscriptionPlanId, string>;
  topup: string;
  topupUltra: string;
  products: Map<string, ProductInfo>;
}

export type CheckoutCustomer = { customerId: string } | { email: string; name: string | null };

export interface Checkout {
  sessionId: string;
  url: string;
}

// Il cambio di piano prima di farlo: quanto si paga oggi (tasse comprese) e quanto costa il piano nuovo a ogni rinnovo
// (tasse escluse), in centesimi nella valuta dell'abbonamento, con la data del prossimo rinnovo.
export interface PlanPreview {
  currency: string;
  today: number;
  next: number;
  nextAt: string;
}

const CATALOG_TTL_MS = 10 * 60_000;

function infoOf(metadata: Record<string, string | number | boolean>): ProductInfo {
  const text = (value: unknown) => (value === undefined || value === null ? undefined : String(value));
  const number = (value: unknown) => {
    const parsed = Number(value);
    return value === undefined || value === null || Number.isNaN(parsed) ? undefined : parsed;
  };
  const plan = text(metadata.plan);
  return {
    plan: plan && (SUBSCRIPTION_PLAN_IDS as string[]).includes(plan) ? (plan as SubscriptionPlanId) : undefined,
    monthlyCredits: number(metadata.monthly_credits),
    kind: text(metadata.kind),
    credits: number(metadata.credits),
    tier: text(metadata.tier),
  };
}

// Il cambio di piano: chi sale paga subito la differenza per il tempo che resta del periodo (il rinnovo non si sposta) e
// ha subito i crediti del piano nuovo; chi scende non paga e non riceve niente, tiene i crediti del periodo già pagato e
// dal rinnovo paga il piano nuovo. Se il pagamento non riesce il piano resta quello di prima.
const planChange = (productId: string, upgrade: boolean) =>
  ({
    product_id: productId,
    quantity: 1,
    proration_billing_mode: upgrade ? 'prorated_immediately_keep_cycle' : 'do_not_bill',
    on_payment_failure: 'prevent_change',
  }) as const;

export class DodoApi {
  private catalogCache: { value: Catalog; at: number } | null = null;
  private clientInstance: DodoPayments | null = null;
  private readonly settings: DodoSettings;

  constructor(settings: DodoSettings) {
    this.settings = settings;
  }

  get configured(): boolean {
    return Boolean(this.settings.DODO_PAYMENTS_API_KEY);
  }

  private client(): DodoPayments {
    if (!this.settings.DODO_PAYMENTS_API_KEY) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'I pagamenti non sono configurati.');
    this.clientInstance ??= new DodoPayments({
      bearerToken: this.settings.DODO_PAYMENTS_API_KEY,
      environment: this.settings.DODO_PAYMENTS_ENV,
      webhookKey: this.settings.DODO_PAYMENTS_WEBHOOK_KEY ?? null,
      timeout: 15_000,
      maxRetries: 1,
    });
    return this.clientInstance;
  }

  // Un errore di Dodo diventa un errore nostro: un rifiuto (carta che non paga, operazione non ammessa) si dice al cliente,
  // il resto è il servizio che non risponde. Il dettaglio resta nei log.
  private async call<T>(what: string, run: (client: DodoPayments) => Promise<T>): Promise<T> {
    try {
      return await run(this.client());
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const status = error instanceof APIError ? error.status : undefined;
      const rejected = status !== undefined && status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 404;
      const wrapped = rejected
        ? new ApiError(409, 'PAYMENTS_REJECTED', 'Il pagamento non è andato a buon fine: controlla il metodo di pagamento e riprova.')
        : new ApiError(502, 'PAYMENTS_FAILED', 'Il servizio dei pagamenti non risponde: riprova tra poco.');
      wrapped.cause = `Dodo ${what}: ${status ?? ''} ${error instanceof Error ? error.message : String(error)}`;
      throw wrapped;
    }
  }

  // Il catalogo: i prodotti non archiviati, riconosciuti dai loro metadata. Si rilegge ogni 10 minuti.
  async catalog(): Promise<Catalog> {
    if (this.catalogCache && Date.now() - this.catalogCache.at < CATALOG_TTL_MS) return this.catalogCache.value;
    const products = new Map<string, ProductInfo>();
    await this.call('products.list', async (client) => {
      for await (const product of client.products.list({ archived: false })) products.set(product.product_id, infoOf(product.metadata));
    });
    const entries = [...products];
    const plan = (id: SubscriptionPlanId) => entries.find(([, info]) => info.plan === id)?.[0];
    const topup = (tier: string) => entries.find(([, info]) => info.kind === 'topup' && info.tier === tier)?.[0];
    const plans = { start: plan('start'), pro: plan('pro'), ultra: plan('ultra') };
    const standard = topup('standard');
    const ultra = topup('ultra');
    if (!plans.start || !plans.pro || !plans.ultra || !standard || !ultra) {
      throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Nel catalogo di Dodo Payments mancano dei prodotti.');
    }
    this.catalogCache = { value: { plans: plans as Record<SubscriptionPlanId, string>, topup: standard, topupUltra: ultra, products }, at: Date.now() };
    return this.catalogCache.value;
  }

  // Cosa vale un prodotto. Uno che non è nel catalogo letto (appena creato) fa rileggere il catalogo una volta.
  async product(productId: string): Promise<ProductInfo | null> {
    let catalog = await this.catalog();
    if (!catalog.products.has(productId)) {
      this.catalogCache = null;
      catalog = await this.catalog();
    }
    return catalog.products.get(productId) ?? null;
  }

  // La pagina di pagamento di Dodo per un prodotto, nella lingua dell'utenza (altrimenti Dodo prende quella del browser):
  // il cliente ci arriva con un redirect e torna su returnUrl, o su cancelUrl se rinuncia. I metadata (brand e utenza)
  // li ritroviamo sul pagamento e sull'abbonamento che nascono.
  async checkout(
    productId: string,
    customer: CheckoutCustomer,
    metadata: Record<string, string>,
    returnUrl: string,
    cancelUrl: string,
    language: string | null,
  ): Promise<Checkout> {
    const session = await this.call('checkoutSessions.create', (client) =>
      client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: 'customerId' in customer ? { customer_id: customer.customerId } : { email: customer.email, name: customer.name },
        metadata,
        return_url: returnUrl,
        cancel_url: cancelUrl,
        customization: { theme: 'light', force_language: language },
      }),
    );
    if (!session.checkout_url) {
      const error = new ApiError(502, 'PAYMENTS_FAILED', 'Il servizio dei pagamenti non risponde: riprova tra poco.');
      error.cause = `Dodo checkoutSessions.create: sessione ${session.session_id} senza checkout_url`;
      throw error;
    }
    return { sessionId: session.session_id, url: session.checkout_url };
  }

  async changePlan(subscriptionId: string, productId: string, upgrade: boolean): Promise<void> {
    await this.call('subscriptions.changePlan', (client) => client.subscriptions.changePlan(subscriptionId, planChange(productId, upgrade)));
  }

  // Lo stesso cambio, senza farlo: quanto si paga oggi e quanto costa il piano nuovo dal prossimo rinnovo.
  async previewPlan(subscriptionId: string, productId: string, upgrade: boolean): Promise<PlanPreview> {
    const preview = await this.call('subscriptions.previewChangePlan', (client) =>
      client.subscriptions.previewChangePlan(subscriptionId, planChange(productId, upgrade)),
    );
    return {
      currency: preview.immediate_charge.summary.currency,
      today: preview.immediate_charge.summary.total_amount,
      next: preview.new_plan.recurring_pre_tax_amount,
      nextAt: preview.new_plan.next_billing_date,
    };
  }

  subscription(subscriptionId: string): Promise<DodoSubscription> {
    return this.call('subscriptions.retrieve', (client) => client.subscriptions.retrieve(subscriptionId));
  }

  // La disdetta immediata, senza aspettare la fine del periodo: per un abbonamento nato in più sullo stesso brand, e per
  // un brand o un'utenza che spariscono. La disdetta a fine periodo la fa il cliente dal portale.
  async cancelNow(subscriptionId: string): Promise<void> {
    await this.call('subscriptions.update', (client) => client.subscriptions.update(subscriptionId, { status: 'cancelled' }));
  }

  // Il rimborso completo di un pagamento, sul metodo di pagamento del cliente; i crediti si tolgono quando arriva
  // l'evento del rimborso (webhook).
  async refund(paymentId: string, reason: string): Promise<void> {
    await this.call('refunds.create', (client) => client.refunds.create({ payment_id: paymentId, reason }));
  }

  // Il portale del cliente su Dodo: carta, disdetta, pagamenti e ricevute da scaricare. Il link vale 24 ore.
  async portal(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.call('customers.customerPortal.create', (client) =>
      client.customers.customerPortal.create(customerId, { return_url: returnUrl }),
    );
    return session.link;
  }

  // Un evento dei webhook, verificato con la chiave di firma (Standard Webhooks: webhook-id, webhook-timestamp,
  // webhook-signature sul corpo grezzo). Firma sbagliata o vecchia: eccezione.
  unwrap(body: string, headers: Record<string, string>): WebhookEvent {
    return this.client().webhooks.unwrap(body, { headers });
  }
}
