import type { BrandSubscription, CreditsResponse, SpendBlock, SubscriptionStatus } from '@moonbrand/shared/api/contract';
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { isFreeUltra } from '../billing/free-plan';

// I crediti di un brand, dal registro dei movimenti (migration credits) che scalano i trigger. Piani e crediti sono per
// brand (migration brand_credits); senza brandId vale il brand attivo.
// - Un brand con l'abbonamento su Dodo Payments (migration dodo), in qualunque stato, conta solo i crediti pagati: quelli del
//   piano del periodo in corso, che scadono a fine periodo, più le ricariche, che restano. Senza un periodo pagato in
//   corso (un rinnovo non ancora pagato, l'abbonamento finito, i secondi prima del primo pagamento) restano solo le
//   ricariche: niente crediti regalati.
// - Un brand che non ha mai avuto l'abbonamento conta come prima, a mese di calendario a Roma: i crediti del piano scelto
//   più quelli aggiunti nel mese dall'admin. Con BILLING_ENFORCED è comunque fermo finché non attiva un piano, a meno
//   che l'utenza abbia il piano Ultra in omaggio (free-plan.ts): allora il piano è Ultra e conta come un abbonamento
//   attivo senza pagamento.
export async function brandCredits(db: Queryable, accountId: string, brandId: string | null): Promise<CreditsResponse> {
  const subscription = await brandSubscription(db, accountId, brandId);
  if (subscription) {
    const paid = await paidCredits(db, accountId, brandId, subscription);
    return { ...paid, subscription, blocked: blockOf(subscription, paid.remaining) };
  }
  const { rows } = await db.query<{ plan: SubscriptionPlanId | null; email: string; used: string; added: string; renews_on: string }>(
    `with month as (select date_trunc('month', now() at time zone 'Europe/Rome') as start),
          brand as (
            select b.id, b.plan from presenza.brands b
            where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
          )
     select (select plan from brand) as plan, (select email from presenza.accounts where id = $1) as email,
       coalesce(-sum(m.amount) filter (where m.amount < 0 and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as used,
       coalesce(sum(m.amount) filter (where m.amount > 0 and m.kind = 'topup' and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as added,
       to_char(month.start + interval '1 month', 'YYYY-MM-DD') as renews_on
     from month left join presenza.credit_movements m on m.brand_id = (select id from brand)
     group by month.start`,
    [accountId, brandId],
  );
  const free = isFreeUltra(rows[0].email);
  const plan = free ? 'ultra' : (rows[0].plan ?? DEFAULT_SUBSCRIPTION_PLAN);
  const monthlyCredits = SUBSCRIPTION_PLANS[plan].monthlyCredits + Math.round(Number(rows[0].added));
  const usedThisMonth = Math.round(Number(rows[0].used));
  const remaining = monthlyCredits - usedThisMonth;
  const granted: BrandSubscription | null = free ? { plan: 'ultra', status: 'active', periodEnd: null, cancelsAt: null, free: true } : null;
  return { plan, monthlyCredits, usedThisMonth, remaining, renewsOn: rows[0].renews_on, subscription: granted, blocked: blockOf(granted, remaining) };
}

// I crediti pagati. Ogni periodo ha i crediti del suo piano (l'ultimo movimento plan del periodo: un passaggio di piano a
// metà ne scrive un altro). Si consuma prima il piano: quello che in un periodo chiuso è andato oltre il piano è uscito
// dalle ricariche. Fuori da un periodo pagato si consumano solo le ricariche, dalla fine dell'ultimo periodo.
async function paidCredits(
  db: Queryable,
  accountId: string,
  brandId: string | null,
  subscription: BrandSubscription,
): Promise<Omit<CreditsResponse, 'subscription' | 'blocked'>> {
  const { rows } = await db.query<{ period_amount: string | null; used: string; topups: string; overflow: string; renews_on: string }>(
    `with brand as (
       select b.id from presenza.brands b
       where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
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
     ), current as (
       select * from spent where period_start <= now() and period_end > now() order by period_start desc limit 1
     ), since as (
       select coalesce((select max(period_end) from periods where period_end <= now()), now()) as at
     )
     select (select amount from current) as period_amount,
       coalesce((select used from current),
                (select -sum(m.amount) from presenza.credit_movements m
                 where m.brand_id = (select id from brand) and m.amount < 0 and m.created_at >= (select at from since)), 0) as used,
       coalesce((select sum(m.amount) from presenza.credit_movements m
                 where m.brand_id = (select id from brand) and m.kind = 'topup'), 0) as topups,
       coalesce((select sum(greatest(s.used - s.amount, 0)) from spent s where s.period_end <= now()), 0) as overflow,
       to_char(coalesce((select period_end from current), $3::timestamptz, now()) at time zone 'Europe/Rome', 'YYYY-MM-DD') as renews_on`,
    [accountId, brandId, subscription.periodEnd],
  );
  const row = rows[0];
  const leftover = Math.max(Number(row.topups) - Number(row.overflow), 0);
  const monthlyCredits = Math.round(Number(row.period_amount ?? 0) + leftover);
  const usedThisMonth = Math.round(Number(row.used));
  return { plan: subscription.plan, monthlyCredits, usedThisMonth, remaining: monthlyCredits - usedThisMonth, renewsOn: row.renews_on };
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

// Il blocco dei lavori a pagamento: un brand lavora solo con un abbonamento vivo (anche mentre un rinnovo non pagato
// aspetta la carta nuova) e con crediti rimasti. Un lavoro già partito finisce anche se va un po' sotto zero. Si accende
// con BILLING_ENFORCED: finché è spento (la produzione prima del lancio dei pagamenti) si conta soltanto.
let enforced = false;

export function enforceBilling(on: boolean): void {
  enforced = on;
}

const SPENDING = new Set<SubscriptionStatus>(['active', 'past_due', 'on_hold']);

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
