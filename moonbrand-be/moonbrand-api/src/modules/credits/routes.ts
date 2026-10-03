import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

import type { CreditsResponse } from '@moonbrand/shared/api/contract';

import { withIdentity } from '../../db/identity';

// Il saldo e il consumo del mese, dal registro dei movimenti (migration credits): i crediti li scalano i trigger.
export function registerCreditRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/credits', (request) =>
    withIdentity(pool, request.identity, async (db): Promise<CreditsResponse> => {
      const { rows } = await db.query<{ balance: string; used: string }>(
        `select coalesce(sum(amount), 0) as balance,
           coalesce(-sum(amount) filter (
             where amount < 0 and created_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'
           ), 0) as used
         from presenza.credit_movements where account_id = $1`,
        [request.identity.accountId],
      );
      return { balance: Math.round(Number(rows[0].balance)), usedThisMonth: Math.round(Number(rows[0].used)) };
    }),
  );
}
