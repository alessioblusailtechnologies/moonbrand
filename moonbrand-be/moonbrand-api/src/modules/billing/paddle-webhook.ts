import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Config } from '../../config';
import { ApiError } from '../../errors';

export const PADDLE_WEBHOOK = '/v1/webhooks/paddle';

// Gli eventi di Paddle (developer.paddle.com/webhooks). Il checkout dello studio mette brandId e accountId nei
// custom_data della transazione, e Paddle li copia sull'abbonamento che nasce. Ogni prezzo del catalogo porta nei suoi
// custom_data cosa vale: il piano (plan, monthly_credits) o la ricarica (kind topup, credits).
// - subscription.*: lo stato dell'abbonamento del brand (piano, periodo, disdetta), in brand_subscriptions.
// - transaction.completed: i crediti pagati, il piano del periodo o la ricarica, una volta per transazione.
// Paddle ripete un evento finché non riceve un 2xx e può mandarli fuori ordine: ogni evento si registra una volta sola
// (paddle_events) e un evento più vecchio dell'ultimo applicato non tocca l'abbonamento.
const priceData = z
  .object({
    plan: z.enum(['start', 'pro', 'ultra']).optional(),
    monthly_credits: z.number().optional(),
    kind: z.string().optional(),
    credits: z.number().optional(),
  })
  .loose()
  .nullish();

const item = z
  .object({
    quantity: z.number().default(1),
    price: z.object({ id: z.string(), custom_data: priceData }).loose(),
  })
  .loose();

const owner = z.object({ brandId: z.string().optional(), accountId: z.string().optional() }).loose().nullish();
const period = z.object({ starts_at: z.string(), ends_at: z.string() }).nullish();

const subscriptionSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    customer_id: z.string().nullish(),
    items: z.array(item),
    current_billing_period: period,
    scheduled_change: z.object({ action: z.string(), effective_at: z.string() }).loose().nullish(),
    custom_data: owner,
  })
  .loose();

const transactionSchema = z
  .object({
    id: z.string(),
    subscription_id: z.string().nullish(),
    customer_id: z.string().nullish(),
    items: z.array(item),
    billing_period: period,
    custom_data: owner,
  })
  .loose();

const eventSchema = z.object({ event_id: z.string(), event_type: z.string(), occurred_at: z.string(), data: z.unknown() });

// La firma di Paddle: Paddle-Signature: ts=<secondi>;h1=<hmac>, con l'HMAC-SHA256 di «ts:corpo» e il segreto della
// destinazione. Durante il cambio del segreto ci possono essere più h1. Un timestamp vecchio di più di 5 minuti è una
// richiesta ripetuta da qualcun altro: Paddle firma di nuovo ogni tentativo.
const TOLERANCE_SECONDS = 300;

export function paddleSigned(body: Buffer, header: string | undefined, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = header.split(';').map((part) => part.trim().split('='));
  const ts = parts.find(([key]) => key === 'ts')?.[1];
  const signatures = parts.filter(([key]) => key === 'h1').map(([, value]) => value ?? '');
  if (!ts || !/^\d+$/.test(ts) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(ts)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${ts}:`).update(body).digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature.toLowerCase(), 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

interface Brand {
  id: string;
  account_id: string;
}

// Il brand di un evento: quello dei custom_data, se esiste ed è dell'account indicato; altrimenti quello che ha già
// l'abbonamento.
async function brandFor(db: pg.PoolClient, data: { custom_data?: z.infer<typeof owner> }, subscriptionId: string | null | undefined): Promise<Brand | null> {
  const brandId = data.custom_data?.brandId;
  if (brandId) {
    const { rows } = await db.query<Brand>('select id, account_id from presenza.brands where id::text = $1', [brandId]);
    const brand = rows[0];
    const accountId = data.custom_data?.accountId;
    if (brand && (!accountId || accountId === brand.account_id)) return brand;
  }
  if (!subscriptionId) return null;
  const { rows } = await db.query<Brand>(
    'select brand_id as id, account_id from presenza.brand_subscriptions where paddle_subscription_id = $1',
    [subscriptionId],
  );
  return rows[0] ?? null;
}

function planOf(items: z.infer<typeof item>[]): SubscriptionPlanId | null {
  for (const { price } of items) if (price.custom_data?.plan) return price.custom_data.plan;
  return null;
}

async function linkCustomer(db: pg.PoolClient, accountId: string, customerId: string | null | undefined): Promise<void> {
  if (!customerId) return;
  await db.query('update presenza.accounts set paddle_customer_id = $2 where id = $1 and paddle_customer_id is null', [accountId, customerId]);
}

async function applySubscription(db: pg.PoolClient, raw: unknown, occurredAt: string, log: FastifyBaseLogger): Promise<void> {
  const data = subscriptionSchema.parse(raw);
  const brand = await brandFor(db, data, data.id);
  const plan = planOf(data.items);
  if (!brand || !plan) {
    log.warn({ subscription: data.id, brand: brand?.id, plan }, 'abbonamento Paddle senza brand o senza piano: ignorato');
    return;
  }
  const cancelsAt = data.scheduled_change?.action === 'cancel' ? data.scheduled_change.effective_at : null;
  const { rowCount } = await db.query(
    `insert into presenza.brand_subscriptions
       (brand_id, account_id, paddle_subscription_id, plan, status, period_start, period_end, cancels_at, event_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (brand_id) do update set
       paddle_subscription_id = excluded.paddle_subscription_id, plan = excluded.plan, status = excluded.status,
       period_start = excluded.period_start, period_end = excluded.period_end, cancels_at = excluded.cancels_at,
       event_at = excluded.event_at, updated_at = now()
     where presenza.brand_subscriptions.event_at <= excluded.event_at`,
    [
      brand.id,
      brand.account_id,
      data.id,
      plan,
      data.status,
      data.current_billing_period?.starts_at ?? null,
      data.current_billing_period?.ends_at ?? null,
      cancelsAt,
      occurredAt,
    ],
  );
  // Il piano del brand segue quello dell'abbonamento, anche quando finisce: resta l'ultimo pagato.
  if (rowCount) await db.query('update presenza.brands set plan = $2 where id = $1', [brand.id, plan]);
  await linkCustomer(db, brand.account_id, data.customer_id);
}

async function applyTransaction(db: pg.PoolClient, raw: unknown, log: FastifyBaseLogger): Promise<void> {
  const data = transactionSchema.parse(raw);
  const brand = await brandFor(db, data, data.subscription_id);
  if (!brand) {
    log.warn({ transaction: data.id }, 'transazione Paddle senza brand: crediti non caricati');
    return;
  }
  let plan = 0;
  let topup = 0;
  for (const { price, quantity } of data.items) {
    const info = price.custom_data;
    if (info?.plan) plan = Math.max(plan, info.monthly_credits ?? SUBSCRIPTION_PLANS[info.plan].monthlyCredits);
    else if (info?.kind === 'topup' && info.credits) topup += info.credits * quantity;
  }
  const insert = `insert into presenza.credit_movements
       (account_id, brand_id, amount, kind, paddle_transaction_id, period_start, period_end)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (paddle_transaction_id, kind) where paddle_transaction_id is not null do nothing`;
  if (plan > 0) {
    const period = data.billing_period;
    if (!period) log.warn({ transaction: data.id }, 'transazione del piano senza periodo');
    await db.query(insert, [brand.account_id, brand.id, plan, 'plan', data.id, period?.starts_at ?? null, period?.ends_at ?? null]);
  }
  if (topup > 0) await db.query(insert, [brand.account_id, brand.id, topup, 'topup', data.id, null, null]);
  await linkCustomer(db, brand.account_id, data.customer_id);
}

export function registerPaddleWebhook(app: FastifyInstance, pool: pg.Pool, settings: Pick<Config, 'PADDLE_WEBHOOK_SECRET'>): void {
  // Il corpo serve intero per la firma: in questo scope il JSON si legge a mano.
  void app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

    scope.post(PADDLE_WEBHOOK, async (request, reply) => {
      const secret = settings.PADDLE_WEBHOOK_SECRET;
      if (!secret) throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Manca PADDLE_WEBHOOK_SECRET.');
      const body = request.body as Buffer;
      const header = request.headers['paddle-signature'];
      if (!paddleSigned(body, Array.isArray(header) ? header[0] : header, secret)) throw ApiError.unauthenticated('Firma non valida.');

      let event: z.infer<typeof eventSchema>;
      try {
        event = eventSchema.parse(JSON.parse(body.toString('utf8')));
      } catch {
        throw ApiError.invalid('Evento non valido.');
      }

      // Tutto in una transazione: se qualcosa va storto non resta niente, nemmeno l'evento, e Paddle lo ripete.
      const db = await pool.connect();
      try {
        await db.query('begin');
        const { rowCount } = await db.query(
          `insert into presenza.paddle_events (id, type, occurred_at, payload) values ($1, $2, $3, $4)
           on conflict (id) do nothing`,
          [event.event_id, event.event_type, event.occurred_at, JSON.stringify(event.data)],
        );
        if (rowCount) {
          if (event.event_type.startsWith('subscription.')) await applySubscription(db, event.data, event.occurred_at, request.log);
          else if (event.event_type === 'transaction.completed') await applyTransaction(db, event.data, request.log);
        }
        await db.query('commit');
      } catch (error) {
        await db.query('rollback');
        request.log.error({ err: error, event: event.event_id, type: event.event_type }, 'evento Paddle non applicato');
        throw error;
      } finally {
        db.release();
      }
      return reply.code(204).send();
    });
  });
}
