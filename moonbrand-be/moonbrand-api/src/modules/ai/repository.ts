import type { AiJob } from '@moonbrand/shared/api/contract';

import type { Queryable } from '../../db/pool';

export async function insertJob(db: Queryable, accountId: string, kind: string, input: unknown): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    'insert into presenza.ai_jobs (account_id, kind, input) values ($1, $2, $3::jsonb) returning id',
    [accountId, kind, JSON.stringify(input)],
  );
  return rows[0].id;
}

export async function findJob(db: Queryable, jobId: string): Promise<AiJob | null> {
  const { rows } = await db.query<AiJob>('select id, kind, status, steps, result, error from presenza.ai_jobs where id = $1', [jobId]);
  return rows[0] ?? null;
}
