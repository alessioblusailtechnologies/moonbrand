import type { AiJob } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';

import type { Queryable } from '../../db/pool';

// agentToken: il token con cui i tool del job chiamano l'API (solo per i job della chat).
// free: il job non scala crediti (onboarding, creazione del brand, saluti del mattino); i trigger dei crediti lo saltano.
export async function insertJob(
  db: Queryable,
  accountId: string,
  kind: string,
  input: unknown,
  { agentToken, free = false }: { agentToken?: string; free?: boolean } = {},
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into presenza.ai_jobs (account_id, kind, input, agent_token, free) values ($1, $2, $3::jsonb, $4, $5) returning id',
    [accountId, kind, JSON.stringify(input), agentToken ?? null, free],
  );
  return rows[0].id;
}

// Un brand ancora in bozza (l'onboarding): la cartella c'è, la riga in brands arriva solo alla fine.
export async function isDraftBrand(db: Queryable, brandId: string): Promise<boolean> {
  const { rows } = await db.query('select 1 from presenza.brands where id = $1', [brandId]);
  return rows.length === 0;
}

export async function findJob(db: Queryable, jobId: string): Promise<{ job: AiJob; brandId: string | null } | null> {
  const { rows } = await db.query<AiJob & { brand_id: string | null }>(
    `select id, kind, status, steps, result, error, input->>'brandId' as brand_id from presenza.ai_jobs where id = $1`,
    [jobId],
  );
  if (!rows[0]) return null;
  const { brand_id, ...job } = rows[0];
  return { job, brandId: brand_id };
}

export interface ExamplesJob {
  status: string;
  sessionId: string | null;
  brandId: string | null;
  dir: string;
  channels: ChannelId[] | null;
}

// Un job di esempi (generazione o modifica) da cui riprendere la sessione.
// La cartella: una modifica la eredita, una generazione la prende dal suo id (come examplesDir in moonbrand-ai).
export async function findExamplesJob(db: Queryable, jobId: string): Promise<ExamplesJob | null> {
  const { rows } = await db.query<{ status: string; session_id: string | null; brand_id: string | null; dir: string; channels: ChannelId[] | null }>(
    `select status, session_id, input->>'brandId' as brand_id, coalesce(input->>'dir', 'esempi/' || id) as dir,
       coalesce(input->'brand'->'channels', input->'channels') as channels
     from presenza.ai_jobs where id = $1 and kind in ('visual', 'visual-edit')`,
    [jobId],
  );
  const row = rows[0];
  return row ? { status: row.status, sessionId: row.session_id, brandId: row.brand_id, dir: row.dir, channels: row.channels } : null;
}
