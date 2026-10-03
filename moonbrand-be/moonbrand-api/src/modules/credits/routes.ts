import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

import type { CreditsResponse } from '@moonbrand/shared/api/contract';
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS } from '@moonbrand/shared/domain/subscription';

import { withIdentity } from '../../db/identity';

// I crediti del mese: quelli del piano meno i consumi dal primo del mese a Roma, dal registro dei movimenti (migration
// credits), che scalano i trigger. Finché non ci sono i pagamenti il piano è quello medio per tutti.
export function registerCreditRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/credits', (request) =>
    withIdentity(pool, request.identity, async (db): Promise<CreditsResponse> => {
      const { rows } = await db.query<{ used: string; renews_on: string }>(
        `with month as (select date_trunc('month', now() at time zone 'Europe/Rome') as start)
         select coalesce(-sum(amount) filter (where amount < 0 and created_at >= month.start at time zone 'Europe/Rome'), 0) as used,
           to_char(month.start + interval '1 month', 'YYYY-MM-DD') as renews_on
         from month left join presenza.credit_movements on account_id = $1
         group by month.start`,
        [request.identity.accountId],
      );
      const plan = DEFAULT_SUBSCRIPTION_PLAN;
      const { monthlyCredits } = SUBSCRIPTION_PLANS[plan];
      const usedThisMonth = Math.round(Number(rows[0].used));
      return { plan, monthlyCredits, usedThisMonth, remaining: monthlyCredits - usedThisMonth, renewsOn: rows[0].renews_on };
    }),
  );
}
