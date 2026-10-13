import type { SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { ApiError } from '../../errors';

// Le chiamate all'API di Paddle (developer.paddle.com/api-reference), con la chiave del venditore: sandbox o live
// secondo PADDLE_ENV. La chiave resta qui: allo studio vanno solo il token lato client e gli id dei prezzi.
export type PaddleSettings = Pick<Config, 'PADDLE_API_KEY' | 'PADDLE_ENV'>;

export interface Prices {
  plans: Record<SubscriptionPlanId, string>;
  topup: string;
  topupUltra: string;
}

// Importi nella valuta del cliente, in centesimi come li dà Paddle.
export interface PlanPreview {
  currency: string;
  today: string | null;
  next: string | null;
  nextAt: string | null;
}

const planChange = (priceId: string, upgrade: boolean) => ({
  items: [{ price_id: priceId, quantity: 1 }],
  proration_billing_mode: upgrade ? 'prorated_immediately' : 'do_not_bill',
  on_payment_failure: 'prevent_change',
});

interface PriceEntity {
  id: string;
  custom_data: { plan?: SubscriptionPlanId; kind?: string; tier?: string } | null;
}

export class PaddleApi {
  private prices: { value: Prices; at: number } | null = null;
  private readonly settings: PaddleSettings;

  constructor(settings: PaddleSettings) {
    this.settings = settings;
  }

  get configured(): boolean {
    return Boolean(this.settings.PADDLE_API_KEY);
  }

  private async call<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
    const key = this.settings.PADDLE_API_KEY;
    if (!key) throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'I pagamenti non sono configurati.');
    const base = this.settings.PADDLE_ENV === 'production' ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json().catch(() => null)) as { data?: T; error?: { code?: string; detail?: string } } | null;
    if (!response.ok || !json?.data) {
      const error = new ApiError(502, 'PAYMENTS_FAILED', 'Il servizio dei pagamenti non risponde: riprova tra poco.');
      error.cause = `Paddle ${method} ${path}: ${response.status} ${json?.error?.code ?? ''} ${json?.error?.detail ?? ''}`;
      throw error;
    }
    return json.data;
  }

  // I prezzi del catalogo, riconosciuti dai loro custom_data (plan; kind topup con tier standard o ultra): così sandbox e
  // live hanno ciascuno i suoi id senza doverli copiare in configurazione. Si rileggono ogni 10 minuti.
  async catalog(): Promise<Prices> {
    if (this.prices && Date.now() - this.prices.at < 10 * 60_000) return this.prices.value;
    const list = await this.call<PriceEntity[]>('GET', '/prices?status=active&per_page=200');
    const plan = (id: SubscriptionPlanId) => list.find((price) => price.custom_data?.plan === id)?.id;
    const topup = (tier: string) => list.find((price) => price.custom_data?.kind === 'topup' && price.custom_data.tier === tier)?.id;
    const value = { plans: { start: plan('start'), pro: plan('pro'), ultra: plan('ultra') }, topup: topup('standard'), topupUltra: topup('ultra') };
    if (!value.plans.start || !value.plans.pro || !value.plans.ultra || !value.topup || !value.topupUltra) {
      throw new ApiError(503, 'PAYMENTS_NOT_CONFIGURED', 'Nel catalogo di Paddle mancano dei prezzi.');
    }
    this.prices = { value: value as Prices, at: Date.now() };
    return this.prices.value;
  }

  // Il cambio di piano di un abbonamento: chi sale paga subito la differenza del periodo (e ha subito i crediti del piano
  // nuovo); chi scende non paga e non riceve niente, tiene i crediti del periodo già pagato e dal rinnovo paga il piano
  // nuovo. Un rimborso della parte non usata, con i crediti lasciati, si potrebbe sfruttare: salire, consumare, scendere.
  // Se il pagamento non riesce il piano resta quello di prima.
  async changePlan(subscriptionId: string, priceId: string, upgrade: boolean): Promise<void> {
    await this.call('PATCH', `/subscriptions/${encodeURIComponent(subscriptionId)}`, planChange(priceId, upgrade));
  }

  // Lo stesso cambio, senza farlo: quanto si paga oggi e quanto al prossimo rinnovo, tasse comprese.
  async previewPlan(subscriptionId: string, priceId: string, upgrade: boolean): Promise<PlanPreview> {
    const preview = await this.call<{
      currency_code: string;
      immediate_transaction: { details: { totals: { total: string } } } | null;
      next_transaction: { billing_period: { starts_at: string }; details: { totals: { total: string } } } | null;
    }>('PATCH', `/subscriptions/${encodeURIComponent(subscriptionId)}/preview`, planChange(priceId, upgrade));
    return {
      currency: preview.currency_code,
      today: preview.immediate_transaction?.details.totals.total ?? null,
      next: preview.next_transaction?.details.totals.total ?? null,
      nextAt: preview.next_transaction?.billing_period.starts_at ?? null,
    };
  }

  // La disdetta immediata, senza aspettare la fine del periodo: per un abbonamento nato in più sullo stesso brand, e per
  // un brand o un'utenza che spariscono.
  async cancelNow(subscriptionId: string): Promise<void> {
    await this.call('POST', `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: 'immediately' });
  }

  // Il rimborso completo di una transazione, sul metodo di pagamento del cliente. In sandbox Paddle lo approva da solo
  // entro dieci minuti, nell'account vero lo rivede Paddle; i crediti si tolgono quando arriva approvato (webhook).
  async refund(transactionId: string, reason: string): Promise<void> {
    await this.call('POST', '/adjustments', { action: 'refund', type: 'full', transaction_id: transactionId, reason });
  }

  // Il portale del cliente su Paddle: carta, disdetta, pagamenti e fatture da scaricare.
  async portal(customerId: string, subscriptionIds: string[]): Promise<string> {
    const session = await this.call<{ urls: { general: { overview: string } } }>(
      'POST',
      `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
      { subscription_ids: subscriptionIds },
    );
    return session.urls.general.overview;
  }
}
