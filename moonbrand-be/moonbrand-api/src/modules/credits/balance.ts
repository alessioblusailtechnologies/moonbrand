import type { BrandSubscription, CreditsResponse, SpendBlock, SubscriptionStatus } from '@moonbrand/shared/api/contract';
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';

// I crediti di un brand, dal registro dei movimenti (migration credits) che scalano i trigger. Piani e crediti sono per
// brand (migration brand_credits); senza brandId vale il brand attivo.
// - Con l'abbonamento Paddle (migration paddle) vale il periodo pagato in corso: i crediti del piano del periodo, che
//   scadono a fine periodo, più le ricariche, che restano finché c'è l'abbonamento.
// - Senza un periodo in corso (nessun abbonamento, o il primo pagamento non ancora arrivato) vale il conto di prima, a
//   mese di calendario a Roma: i crediti del piano scelto più quelli aggiunti nel mese dall'admin.
export async function brandCredits(db: Queryable, accountId: string, brandId: string | null): Promise<CreditsResponse> {
  const subscription = await brandSubscription(db, accountId, brandId);
  const paid = await paidCredits(db, accountId, brandId);
  if (paid) return { ...paid, subscription, blocked: blockOf(subscription, paid.remaining) };
  const { rows } = await db.query<{ plan: SubscriptionPlanId | null; used: string; added: string; renews_on: string }>(
    `with month as (select date_trunc('month', now() at time zone 'Europe/Rome') as start),
          brand as (
            select b.id, b.plan from presenza.brands b
            where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
          )
     select (select plan from brand) as plan,
       coalesce(-sum(m.amount) filter (where m.amount < 0 and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as used,
       coalesce(sum(m.amount) filter (where m.amount > 0 and m.kind = 'topup' and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as added,
       to_char(month.start + interval '1 month', 'YYYY-MM-DD') as renews_on
     from month left join presenza.credit_movements m on m.brand_id = (select id from brand)
     group by month.start`,
    [accountId, brandId],
  );
  const plan = rows[0].plan ?? DEFAULT_SUBSCRIPTION_PLAN;
  const monthlyCredits = SUBSCRIPTION_PLANS[plan].monthlyCredits + Math.round(Number(rows[0].added));
  const usedThisMonth = Math.round(Number(rows[0].used));
  const remaining = monthlyCredits - usedThisMonth;
  return { plan, monthlyCredits, usedThisMonth, remaining, renewsOn: rows[0].renews_on, subscription, blocked: blockOf(subscription, remaining) };
}

// Il periodo pagato in corso. Ogni periodo ha i crediti del suo piano (l'ultimo movimento plan del periodo: un passaggio
// di piano a metà ne scrive un altro). Si consuma prima il piano: quello che in un periodo chiuso è andato oltre il piano
// è uscito dalle ricariche.
async function paidCredits(db: Queryable, accountId: string, brandId: string | null): Promise<Omit<CreditsResponse, 'subscription' | 'blocked'> | null> {
  const { rows } = await db.query<{ plan: SubscriptionPlanId; period_amount: string; used: string; topups: string; overflow: string; renews_on: string }>(
    `with brand as (
       select b.id from presenza.brands b
       where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
     ), sub as (
       select s.plan from presenza.brand_subscriptions s
       where s.brand_id = (select id from brand) and s.status in ('active', 'trialing', 'past_due')
     ), periods as (
       select distinct on (m.period_start) m.period_start, m.period_end, m.amount
       from presenza.credit_movements m
       where m.brand_id = (select id from brand) and m.kind = 'plan' and m.period_start is not null
       order by m.period_start, m.created_at desc
     ), spent as (
       select p.period_start, p.period_end, p.amount,
         coalesce((select -sum(m.amount) from presenza.credit_movements m
                   where m.brand_id = (select id from brand) and m.amount < 0
                     and m.created_at >= p.period_start and m.created_at < p.period_end), 0) as used
       from periods p
     )
     select (select plan from sub) as plan, c.amount as period_amount, c.used,
       coalesce((select sum(m.amount) from presenza.credit_movements m
                 where m.brand_id = (select id from brand) and m.kind = 'topup'), 0) as topups,
       coalesce((select sum(greatest(s.used - s.amount, 0)) from spent s where s.period_end <= now()), 0) as overflow,
       to_char(c.period_end at time zone 'Europe/Rome', 'YYYY-MM-DD') as renews_on
     from spent c
     where exists (select 1 from sub) and c.period_start <= now() and c.period_end > now()
     order by c.period_start desc
     limit 1`,
    [accountId, brandId],
  );
  const row = rows[0];
  if (!row) return null;
  const monthlyCredits = Math.round(Number(row.period_amount) + Math.max(Number(row.topups) - Number(row.overflow), 0));
  const usedThisMonth = Math.round(Number(row.used));
  return { plan: row.plan, monthlyCredits, usedThisMonth, remaining: monthlyCredits - usedThisMonth, renewsOn: row.renews_on };
}

async function brandSubscription(db: Queryable, accountId: string, brandId: string | null): Promise<BrandSubscription | null> {
  const { rows } = await db.query<{ plan: SubscriptionPlanId; status: SubscriptionStatus; period_end: Date | null; cancels_at: Date | null }>(
    `select s.plan, s.status, s.period_end, s.cancels_at from presenza.brand_subscriptions s
     where s.brand_id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))`,
    [accountId, brandId],
  );
  const row = rows[0];
  if (!row) return null;
  return { plan: row.plan, status: row.status, periodEnd: row.period_end?.toISOString() ?? null, cancelsAt: row.cancels_at?.toISOString() ?? null };
}

// Il blocco dei lavori a pagamento: un brand lavora solo con un abbonamento vivo (anche mentre Paddle riprova un
// pagamento non riuscito) e con crediti rimasti. Un lavoro già partito finisce anche se va un po' sotto zero. Si accende
// con BILLING_ENFORCED: finché è spento (la produzione prima del lancio dei pagamenti) si conta soltanto.
let enforced = false;

export function enforceBilling(on: boolean): void {
  enforced = on;
}

const SPENDING = new Set<SubscriptionStatus>(['active', 'trialing', 'past_due']);

function blockOf(subscription: BrandSubscription | null, remaining: number): SpendBlock | null {
  if (!enforced) return null;
  if (!subscription || !SPENDING.has(subscription.status)) return 'PLAN_REQUIRED';
  return remaining <= 0 ? 'NO_CREDITS' : null;
}

export async function assertCanSpend(db: Queryable, accountId: string, brandId: string): Promise<void> {
  if (!enforced) return;
  const { blocked } = await brandCredits(db, accountId, brandId);
  if (blocked === 'PLAN_REQUIRED') throw new ApiError(402, blocked, 'Attiva un piano per questo brand per continuare.');
  if (blocked === 'NO_CREDITS') throw new ApiError(402, blocked, 'Hai finito i crediti di questo brand: ricarica per continuare.');
}
