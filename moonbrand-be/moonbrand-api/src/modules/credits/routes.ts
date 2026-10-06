import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { CreditsResponse } from '@moonbrand/shared/api/contract';
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { withIdentity } from '../../db/identity';

// I crediti del mese di un brand: quelli del suo piano meno i suoi consumi dal primo del mese a Roma, dal registro dei
// movimenti (migration credits), che scalano i trigger. Piani e crediti sono per brand (migration brand_credits); senza
// brandId vale il brand attivo. Finché non ci sono i pagamenti ogni brand è Pro.
const querySchema = z.object({ brandId: z.uuid('Brand non trovato.').optional() });

export function registerCreditRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/credits', (request) =>
    withIdentity(pool, request.identity, async (db): Promise<CreditsResponse> => {
      const { brandId } = querySchema.parse(request.query);
      const { rows } = await db.query<{ plan: SubscriptionPlanId | null; used: string; renews_on: string }>(
        `with month as (select date_trunc('month', now() at time zone 'Europe/Rome') as start),
              brand as (
                select b.id, b.plan from presenza.brands b
                where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
              )
         select (select plan from brand) as plan,
           coalesce(-sum(m.amount) filter (where m.amount < 0 and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as used,
           to_char(month.start + interval '1 month', 'YYYY-MM-DD') as renews_on
         from month left join presenza.credit_movements m on m.brand_id = (select id from brand)
         group by month.start`,
        [request.identity.accountId, brandId ?? null],
      );
      const plan = rows[0].plan ?? DEFAULT_SUBSCRIPTION_PLAN;
      const { monthlyCredits } = SUBSCRIPTION_PLANS[plan];
      const usedThisMonth = Math.round(Number(rows[0].used));
      return { plan, monthlyCredits, usedThisMonth, remaining: monthlyCredits - usedThisMonth, renewsOn: rows[0].renews_on };
    }),
  );
}
