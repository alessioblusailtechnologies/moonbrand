import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type pg from 'pg';

import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { ApiError } from '../../errors';
import { type DodoApi, LIVE_STATUSES, type WebhookEvent } from './dodo-api';

export const DODO_WEBHOOK = '/v1/webhooks/dodo';

// Gli eventi di Dodo Payments (docs.dodopayments.com/developer-resources/webhooks). Il checkout dello studio mette brandId
// e accountId nei metadata della sessione, e Dodo li copia sul pagamento e sull'abbonamento che nascono. Ogni prodotto del
// catalogo porta nei suoi metadata cosa vale: il piano (plan, monthly_credits) o la ricarica (kind topup, credits).
// - subscription.*: lo stato dell'abbonamento del brand (piano, periodo, disdetta), in brand_subscriptions.
// - payment.succeeded: i crediti pagati, il piano del periodo (primo pagamento, rinnovi, salita di piano) o la ricarica,
//   una volta per pagamento.
// - refund.succeeded e dispute.*: un rimborso o una contestazione tolgono i crediti di quel pagamento.
// Un secondo abbonamento sullo stesso brand (due checkout pagati insieme) si disdice e si rimborsa da solo.
// Dodo ripete un evento finché non riceve un 2xx (fino a 8 volte) e può mandarli fuori ordine: ogni evento si registra una
// volta sola (dodo_events, per webhook-id) e un evento più vecchio dell'ultimo applicato non tocca l'abbonamento.
type Payment = Extract<WebhookEvent, { type: 'payment.succeeded' }>['data'];
type Subscription = Extract<WebhookEvent, { type: 'subscription.active' }>['data'];
type Refund = Extract<WebhookEvent, { type: 'refund.succeeded' }>['data'];
type Dispute = Extract<WebhookEvent, { type: 'dispute.opened' }>['data'];
type Metadata = Record<string, string | number | boolean> | null | undefined;

interface Brand {
  id: string;
  account_id: string;
}

const text = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

// Il brand di un evento: quello dei metadata, se esiste ed è dell'utenza indicata; altrimenti quello che ha già
// l'abbonamento; altrimenti quello della sessione di checkout da cui è nato il pagamento (dodo_checkouts), anche
// attraverso un pagamento già ricevuto dello stesso abbonamento.
async function brandFor(db: pg.PoolClient, metadata: Metadata, subscriptionId: string | null, sessionId: string | null): Promise<Brand | null> {
  const brandId = text(metadata?.brandId);
  if (brandId) {
    const { rows } = await db.query<Brand>('select id, account_id from presenza.brands where id::text = $1', [brandId]);
    const brand = rows[0];
    const accountId = text(metadata?.accountId);
    if (brand && (!accountId || accountId === brand.account_id)) return brand;
  }
  if (subscriptionId) {
    const { rows } = await db.query<Brand>(
      'select brand_id as id, account_id from presenza.brand_subscriptions where dodo_subscription_id = $1',
      [subscriptionId],
    );
    if (rows[0]) return rows[0];
  }
  if (sessionId) {
    const { rows } = await db.query<Brand>('select brand_id as id, account_id from presenza.dodo_checkouts where session_id = $1', [sessionId]);
    if (rows[0]) return rows[0];
  }
  if (subscriptionId) {
    const { rows } = await db.query<Brand>(
      `select c.brand_id as id, c.account_id from presenza.dodo_events e
       join presenza.dodo_checkouts c on c.session_id = e.payload ->> 'checkout_session_id'
       where e.type like 'payment.%' and e.payload ->> 'subscription_id' = $1
       order by e.received_at limit 1`,
      [subscriptionId],
    );
    if (rows[0]) return rows[0];
  }
  return null;
}

async function linkCustomer(db: pg.PoolClient, accountId: string, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  await db.query('update presenza.accounts set dodo_customer_id = $2 where id = $1 and dodo_customer_id is null', [accountId, customerId]);
}

// Le chiamate a Dodo che un evento richiede (disdire o rimborsare un doppione): partono dopo il commit, senza far
// aspettare la risposta a Dodo.
type After = (dodo: DodoApi) => Promise<void>;

// L'abbonamento vivo che il brand ha già, se è un altro: un secondo checkout pagato prima che arrivasse il webhook del
// primo (due schede) farebbe pagare due volte lo stesso brand.
async function otherLive(db: pg.PoolClient, brandId: string, subscriptionId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `select dodo_subscription_id as id from presenza.brand_subscriptions
     where brand_id = $1 and dodo_subscription_id <> $2 and status = any($3)`,
    [brandId, subscriptionId, LIVE_STATUSES],
  );
  return rows[0]?.id ?? null;
}

async function applySubscription(db: pg.PoolClient, dodo: DodoApi, data: Subscription, occurredAt: string, log: FastifyBaseLogger, after: After[]): Promise<void> {
  const brand = await brandFor(db, data.metadata, data.subscription_id, null);
  const plan = (await dodo.product(data.product_id))?.plan ?? null;
  if (!brand || !plan) {
    log.warn({ subscription: data.subscription_id, brand: brand?.id, product: data.product_id }, 'abbonamento Dodo senza brand o senza piano: ignorato');
    return;
  }
  // Un doppione non prende il posto dell'abbonamento del brand: si disdice subito (il suo pagamento si rimborsa quando
  // arriva) e i suoi eventi successivi si ignorano.
  const kept = await otherLive(db, brand.id, data.subscription_id);
  if (kept) {
    log.warn({ brand: brand.id, kept, duplicate: data.subscription_id, status: data.status }, 'abbonamento doppio sullo stesso brand');
    if (LIVE_STATUSES.includes(data.status)) after.push((api) => api.cancelNow(data.subscription_id));
    return;
  }
  // La disdetta a fine periodo: l'abbonamento resta attivo fino al prossimo rinnovo, poi Dodo lo chiude (expired).
  const cancelsAt = data.cancel_at_next_billing_date ? data.next_billing_date : null;
  const status = data.status === 'cancelled' && cancelsAt && new Date(cancelsAt) > new Date(occurredAt) ? 'active' : data.status;
  const { rowCount } = await db.query(
    `insert into presenza.brand_subscriptions
       (brand_id, account_id, dodo_subscription_id, plan, status, period_start, period_end, cancels_at, event_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (brand_id) do update set
       dodo_subscription_id = excluded.dodo_subscription_id, plan = excluded.plan, status = excluded.status,
       period_start = excluded.period_start, period_end = excluded.period_end, cancels_at = excluded.cancels_at,
       event_at = excluded.event_at, updated_at = now()
     where presenza.brand_subscriptions.event_at <= excluded.event_at`,
    [brand.id, brand.account_id, data.subscription_id, plan, status, data.previous_billing_date, data.next_billing_date, cancelsAt, occurredAt],
  );
  // Il piano del brand segue quello dell'abbonamento, anche quando finisce: resta l'ultimo pagato.
  if (rowCount) await db.query('update presenza.brands set plan = $2 where id = $1', [brand.id, plan]);
  await linkCustomer(db, brand.account_id, data.customer.customer_id);
}

interface Period {
  start: string;
  end: string;
}

const insertMovement = `insert into presenza.credit_movements
     (account_id, brand_id, amount, kind, dodo_payment_id, period_start, period_end)
   values ($1, $2, $3, $4, $5, $6, $7)
   on conflict (dodo_payment_id, kind) where dodo_payment_id is not null do nothing`;

async function applyPayment(db: pg.PoolClient, dodo: DodoApi, data: Payment, log: FastifyBaseLogger, after: After[]): Promise<void> {
  if (data.is_multi_subscription) {
    log.warn({ payment: data.payment_id }, 'pagamento di più abbonamenti insieme: lo studio non li vende, ignorato');
    return;
  }
  const subscriptionId = data.subscription_id ?? null;
  let brand = await brandFor(db, data.metadata, subscriptionId, data.checkout_session_id ?? null);
  // Il pagamento di un abbonamento porta solo il suo id, non il prodotto: il piano è quello dell'abbonamento, da noi o da
  // Dodo se il suo evento non è ancora arrivato. I crediti del piano valgono per il periodo di servizio che il pagamento
  // copre (primo pagamento, rinnovo, salita di piano). I pagamenti dal portale (cambio di carta) arrivano senza periodo:
  // se addebitano qualcosa è l'arretrato di un rinnovo non riuscito, e il periodo è quello corrente dell'abbonamento; a
  // zero è il solo cambio di carta, senza crediti.
  let plan: SubscriptionPlanId | null = null;
  let period: Period | null = null;
  if (subscriptionId) {
    const { rows } = await db.query<{ plan: SubscriptionPlanId }>('select plan from presenza.brand_subscriptions where dodo_subscription_id = $1', [subscriptionId]);
    plan = rows[0]?.plan ?? null;
    const service = data.service_periods.find((entry) => entry.subscription_id === subscriptionId);
    if (service) period = { start: service.starts_at, end: service.ends_at };
    const charged = !period && data.total_amount > 0;
    if (!plan || !brand || charged) {
      const remote = await dodo.subscription(subscriptionId);
      plan ??= (await dodo.product(remote.product_id))?.plan ?? null;
      brand ??= await brandFor(db, remote.metadata, null, null);
      if (charged) period = { start: remote.previous_billing_date, end: remote.next_billing_date };
    }
  }
  if (!brand) {
    log.warn({ payment: data.payment_id, subscription: subscriptionId }, 'pagamento Dodo senza brand: crediti non caricati');
    return;
  }
  // Il pagamento di un abbonamento doppio: niente crediti, si rimborsa tutto e l'abbonamento si disdice (se l'evento del
  // pagamento arriva prima di quello dell'abbonamento).
  if (subscriptionId) {
    const kept = await otherLive(db, brand.id, subscriptionId);
    if (kept) {
      log.warn({ brand: brand.id, kept, duplicate: subscriptionId, payment: data.payment_id }, 'pagamento di un abbonamento doppio: rimborso');
      after.push((api) => api.refund(data.payment_id, 'Abbonamento doppio sullo stesso brand: rimborso automatico'));
      after.push((api) => api.cancelNow(subscriptionId));
      return;
    }
  }
  let planCredits = 0;
  let topup = 0;
  if (subscriptionId && plan && period) {
    const catalog = await dodo.catalog();
    planCredits = catalog.products.get(catalog.plans[plan])?.monthlyCredits ?? SUBSCRIPTION_PLANS[plan].monthlyCredits;
  } else if (subscriptionId && plan) {
    log.info({ payment: data.payment_id, amount: data.total_amount, cardUpdate: data.is_update_payment_method }, 'pagamento di un abbonamento senza periodo di servizio: niente crediti');
  }
  for (const item of data.product_cart ?? []) {
    const info = await dodo.product(item.product_id);
    if (info?.kind === 'topup' && info.credits) topup += info.credits * item.quantity;
  }
  if (planCredits > 0 && period) {
    // Il periodo nuovo chiude quello ancora aperto (una salita di piano a metà periodo): così crediti e consumi di ogni
    // periodo restano separati.
    await db.query(
      `update presenza.credit_movements set period_end = $2
       where brand_id = $1 and kind = 'plan' and period_start < $2 and period_end > $2`,
      [brand.id, period.start],
    );
    await db.query(insertMovement, [brand.account_id, brand.id, planCredits, 'plan', data.payment_id, period.start, period.end]);
  }
  if (topup > 0) await db.query(insertMovement, [brand.account_id, brand.id, topup, 'topup', data.payment_id, null, null]);
  if (planCredits === 0 && topup === 0) log.warn({ payment: data.payment_id }, 'pagamento Dodo senza piano né ricarica riconosciuti');
  await linkCustomer(db, brand.account_id, data.customer.customer_id);
}

interface Grant {
  account_id: string;
  brand_id: string | null;
  granted: string;
}

// I crediti che un pagamento aveva dato.
async function grantOf(db: pg.PoolClient, paymentId: string): Promise<Grant | null> {
  const { rows } = await db.query<Grant>(
    `select account_id, brand_id, sum(amount) as granted from presenza.credit_movements
     where dodo_payment_id = $1 and amount > 0 group by account_id, brand_id`,
    [paymentId],
  );
  return rows[0] ?? null;
}

// Un rimborso toglie i crediti che quel pagamento aveva dato, in proporzione a quanto si è restituito (un rimborso
// parziale ne toglie una parte). Una volta sola per rimborso.
async function applyRefund(db: pg.PoolClient, data: Refund, log: FastifyBaseLogger): Promise<void> {
  if (data.status !== 'succeeded') return;
  const grant = await grantOf(db, data.payment_id);
  if (!grant) return;
  const { rows } = await db.query<{ total: string | null }>(
    `select payload ->> 'total_amount' as total from presenza.dodo_events
     where type = 'payment.succeeded' and payload ->> 'payment_id' = $1 limit 1`,
    [data.payment_id],
  );
  const total = Number(rows[0]?.total ?? 0);
  const share = data.is_partial && data.amount != null && total > 0 ? Math.min(data.amount / total, 1) : 1;
  const amount = Math.round(Number(grant.granted) * share);
  if (amount <= 0) return;
  await db.query(insertMovement, [grant.account_id, grant.brand_id, -amount, 'refund', data.refund_id, null, null]);
  log.warn({ refund: data.refund_id, payment: data.payment_id, credits: -amount }, 'crediti tolti per un rimborso');
}

// Una contestazione aperta (o persa) toglie tutti i crediti di quel pagamento; vinta o ritirata, li restituisce.
async function applyDispute(db: pg.PoolClient, type: string, data: Dispute, log: FastifyBaseLogger): Promise<void> {
  if (type === 'dispute.opened' || type === 'dispute.lost') {
    const grant = await grantOf(db, data.payment_id);
    const amount = Math.round(Number(grant?.granted ?? 0));
    if (!grant || amount <= 0) return;
    await db.query(insertMovement, [grant.account_id, grant.brand_id, -amount, 'dispute', data.dispute_id, null, null]);
    log.warn({ dispute: data.dispute_id, payment: data.payment_id, credits: -amount }, 'crediti tolti per una contestazione');
  } else if (type === 'dispute.won' || type === 'dispute.cancelled') {
    const { rows } = await db.query<{ account_id: string; brand_id: string | null; removed: string }>(
      `select account_id, brand_id, -sum(amount) as removed from presenza.credit_movements
       where dodo_payment_id = $1 and kind = 'dispute' and amount < 0 group by account_id, brand_id`,
      [data.dispute_id],
    );
    const removed = rows[0];
    const amount = Math.round(Number(removed?.removed ?? 0));
    if (!removed || amount <= 0) return;
    await db.query(insertMovement, [removed.account_id, removed.brand_id, amount, 'dispute', `${data.dispute_id}:won`, null, null]);
    log.warn({ dispute: data.dispute_id, payment: data.payment_id, credits: amount }, 'crediti restituiti dopo una contestazione');
  }
}

export function registerDodoWebhook(
  app: FastifyInstance,
  pool: pg.Pool,
  dodo: DodoApi,
  settings: Pick<Config, 'DODO_PAYMENTS_WEBHOOK_KEY'>,
): void {
  // Il corpo serve intero per la firma: in questo scope il JSON si legge a mano.
  void app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

    scope.post(DODO_WEBHOOK, async (request, reply) => {
      if (!settings.DODO_PAYMENTS_WEBHOOK_KEY) throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Manca DODO_PAYMENTS_WEBHOOK_KEY.');
      const header = (name: string) => {
        const value = request.headers[name];
        return (Array.isArray(value) ? value[0] : value) ?? '';
      };
      const webhookId = header('webhook-id');
      if (!webhookId) throw ApiError.invalid('Manca webhook-id.');
      const body = (request.body as Buffer).toString('utf8');
      let event: WebhookEvent;
      try {
        event = dodo.unwrap(body, {
          'webhook-id': webhookId,
          'webhook-signature': header('webhook-signature'),
          'webhook-timestamp': header('webhook-timestamp'),
        });
      } catch {
        throw ApiError.unauthenticated('Firma non valida.');
      }

      // Tutto in una transazione: se qualcosa va storto non resta niente, nemmeno l'evento, e Dodo lo ripete.
      const db = await pool.connect();
      const after: After[] = [];
      try {
        await db.query('begin');
        const { rowCount } = await db.query(
          `insert into presenza.dodo_events (id, type, occurred_at, payload) values ($1, $2, $3, $4)
           on conflict (id) do nothing`,
          [webhookId, event.type, event.timestamp, JSON.stringify(event.data)],
        );
        if (rowCount) {
          if (event.type.startsWith('subscription.')) await applySubscription(db, dodo, event.data as Subscription, event.timestamp, request.log, after);
          else if (event.type === 'payment.succeeded') await applyPayment(db, dodo, event.data, request.log, after);
          else if (event.type === 'refund.succeeded') await applyRefund(db, event.data, request.log);
          else if (event.type.startsWith('dispute.')) await applyDispute(db, event.type, event.data as Dispute, request.log);
        }
        await db.query('commit');
      } catch (error) {
        await db.query('rollback');
        request.log.error({ err: error, event: webhookId, type: event.type }, 'evento Dodo non applicato');
        throw error;
      } finally {
        db.release();
      }
      for (const call of after) {
        call(dodo).catch((error: unknown) => request.log.error({ err: error, event: webhookId }, 'chiamata a Dodo dopo un evento non riuscita'));
      }
      return reply.code(204).send();
    });
  });
}
