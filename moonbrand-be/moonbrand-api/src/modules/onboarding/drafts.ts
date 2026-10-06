import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { OnboardingDraft } from '@moonbrand/shared/api/contract';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';

// La bozza dell'onboarding, una per account (presenza.onboarding_drafts): la scrive lo studio a ogni passo, e sparisce
// quando il brand nasce. Il server non entra nello stato: guarda solo il brandId, per non far rinascere una bozza il cui
// brand esiste già.

// Il logo sta nella bozza come data URI (fino a 3 milioni di caratteri), a volte due volte: c'è margine.
const BODY_LIMIT = 12 * 1024 * 1024;
const EMPTY: OnboardingDraft = { state: null, revision: 0 };

const saveSchema = z.object({
  state: z.object({ brandId: z.string().nullable().optional() }).loose(),
  revision: z.number().int().min(0),
});

export async function deleteOnboardingDraft(db: Queryable, accountId: string): Promise<void> {
  await db.query('delete from presenza.onboarding_drafts where account_id = $1', [accountId]);
}

function getDraft(pool: pg.Pool, identity: Identity): Promise<OnboardingDraft> {
  return withIdentity(pool, identity, async (db) => {
    const { rows } = await db.query<{ state: unknown; revision: number }>(
      'select state, revision from presenza.onboarding_drafts where account_id = $1',
      [identity.accountId],
    );
    return rows[0] ?? EMPTY;
  });
}

// Il brand della bozza è già nato: la bozza si toglie (fuori dalla transazione che fallisce, altrimenti tornerebbe) e la
// scheda rilegge.
async function saveDraft(pool: pg.Pool, identity: Identity, request: z.infer<typeof saveSchema>): Promise<OnboardingDraft> {
  const saved = await withIdentity(pool, identity, async (db) => {
    const { rows } = await db.query<{ revision: number }>(
      'select revision from presenza.onboarding_drafts where account_id = $1 for update',
      [identity.accountId],
    );
    const current = rows[0]?.revision ?? 0;
    if (request.revision !== current) throw ApiError.conflict('DRAFT_CHANGED', 'La bozza è cambiata in un’altra scheda.');
    const brandId = request.state.brandId;
    if (brandId) {
      const born = await db.query('select 1 from presenza.brands where id = $1', [brandId]);
      if (born.rowCount) {
        await deleteOnboardingDraft(db, identity.accountId);
        return null;
      }
    }
    const written = await db.query<{ revision: number }>(
      `insert into presenza.onboarding_drafts (account_id, state) values ($1, $2)
       on conflict (account_id) do update set state = excluded.state, revision = onboarding_drafts.revision + 1, updated_at = now()
       returning revision`,
      [identity.accountId, request.state],
    );
    return { state: request.state, revision: written.rows[0]!.revision };
  });
  if (!saved) throw ApiError.conflict('DRAFT_CHANGED', 'Questo brand è già stato creato.');
  return saved;
}

export function registerOnboardingRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/onboarding/draft', (request) => getDraft(pool, request.identity));

  app.put('/v1/onboarding/draft', { bodyLimit: BODY_LIMIT }, (request) => saveDraft(pool, request.identity, saveSchema.parse(request.body)));

  // Ricomincia: la bozza si butta, in tutte le schede.
  app.delete('/v1/onboarding/draft', async (request, reply) => {
    await withIdentity(pool, request.identity, (db) => deleteOnboardingDraft(db, request.identity.accountId));
    return reply.code(204).send();
  });
}
