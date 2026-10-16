import type pg from 'pg';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { Locale } from '@moonbrand/shared/i18n/locales';

import type { ToolUsage } from '../service/usage';

// La coda dei lavori (presenza.ai_jobs), l'assegnazione dei brand ai worker (presenza.brand_workers) e le generazioni
// dei tool (presenza.ai_usage): tutto l'SQL del worker sta qui.

// locale: la lingua dell'account, per tutto quello che si dice a chi usa moonbrand.
// content_language: la lingua del brand, per quello che si pubblica; null se il job non ha un brand o il brand non l'ha scelta.
export interface Job {
  id: string;
  kind: string;
  input: unknown;
  account_id: string;
  agent_token: string | null;
  locale: Locale;
  content_language: Locale | null;
}

export type JobStatus = 'done' | 'failed' | 'stopped';

const LEASE = '5 minutes';
const MAX_ATTEMPTS = 3;
const COST_WINDOW_DAYS = 30;

// I job rimasti «running» con il lease scaduto troppe volte si chiudono come falliti.
export async function failStaleJobs(pool: pg.Pool): Promise<void> {
  await pool.query(
    `update presenza.ai_jobs set status = 'failed', error = 'Interrotto troppe volte.', finished_at = now(), locked_until = null
     where status = 'running' and locked_until < now() and attempts >= $1`,
    [MAX_ATTEMPTS],
  );
}

// Prende il prossimo job: solo quelli dei brand di questo worker, o di brand che non hanno ancora un worker, che allora
// diventano suoi. Se nel frattempo un altro worker ha preso lo stesso brand nuovo, il job resta a lui e si cerca il prossimo.
export async function claimJob(pool: pg.Pool, workerId: string): Promise<Job | null> {
  const client = await pool.connect();
  try {
    for (;;) {
      await client.query('begin');
      const { rows: candidates } = await client.query<{ id: string; brand_id: string | null }>(
        `select j.id, j.input->>'brandId' as brand_id from presenza.ai_jobs j
         left join presenza.brand_workers w on w.brand_id = j.input->>'brandId'
         where (j.status = 'queued' or (j.status = 'running' and j.locked_until < now()))
           and (w.worker_id is null or w.worker_id = $1)
         order by j.created_at
         for update of j skip locked
         limit 1`,
        [workerId],
      );
      const candidate = candidates[0];
      if (!candidate) {
        await client.query('commit');
        return null;
      }
      if (candidate.brand_id) {
        await client.query('insert into presenza.brand_workers (brand_id, worker_id) values ($1, $2) on conflict (brand_id) do nothing', [candidate.brand_id, workerId]);
        const { rows: owners } = await client.query<{ worker_id: string }>('select worker_id from presenza.brand_workers where brand_id = $1', [candidate.brand_id]);
        if (owners[0]?.worker_id !== workerId) {
          await client.query('rollback');
          continue;
        }
      }
      const { rows } = await client.query<Job>(
        `update presenza.ai_jobs set status = 'running', attempts = attempts + 1, started_at = now(), locked_until = now() + $2::interval
         where id = $1
         returning id, kind, input, account_id, agent_token,
           (select locale from presenza.accounts where id = ai_jobs.account_id) as locale,
           coalesce((select identity->>'language' from presenza.brands where id::text = ai_jobs.input->>'brandId'),
                    ai_jobs.input->'brand'->'identity'->>'language') as content_language`,
        [candidate.id, LEASE],
      );
      await client.query('commit');
      return rows[0] ?? null;
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function extendLease(pool: pg.Pool, jobId: string): Promise<void> {
  await pool.query(`update presenza.ai_jobs set locked_until = now() + $2::interval where id = $1`, [jobId, LEASE]);
}

export async function saveSteps(pool: pg.Pool, jobId: string, steps: AiStep[]): Promise<void> {
  await pool.query('update presenza.ai_jobs set steps = $2::jsonb where id = $1', [jobId, JSON.stringify(steps)]);
}

// I job in corso di cui lo studio ha chiesto lo stop.
export async function stopRequests(pool: pg.Pool, jobIds: string[]): Promise<string[]> {
  if (jobIds.length === 0) return [];
  const { rows } = await pool.query<{ id: string }>('select id from presenza.ai_jobs where id = any($1) and cancel_requested', [jobIds]);
  return rows.map((row) => row.id);
}

// I job interrotti dallo spegnimento del worker tornano in coda.
export async function requeueJobs(pool: pg.Pool, jobIds: string[]): Promise<void> {
  if (jobIds.length > 0) await pool.query(`update presenza.ai_jobs set status = 'queued', locked_until = null where id = any($1)`, [jobIds]);
}

// cost: il costo che riporta Claude Code, cioè il totale della sessione anche quando il job ne riprende una: la parte del
// job è il totale meno quello del job prima nella stessa sessione.
export async function finishJob(
  pool: pg.Pool,
  jobId: string,
  fields: { status: JobStatus; result?: unknown; error?: string; steps?: AiStep[]; cost?: number; sessionId?: string },
): Promise<void> {
  const own = fields.cost !== undefined && fields.sessionId ? await ownCost(pool, jobId, fields.sessionId, fields.cost) : fields.cost;
  await pool.query(
    `update presenza.ai_jobs set status = $2, result = $3::jsonb, error = $4, steps = coalesce($5::jsonb, steps),
       cost_usd = $6, session_cost_usd = $7, session_id = $8, finished_at = now(), locked_until = null
     where id = $1`,
    [jobId, fields.status, fields.result === undefined ? null : JSON.stringify(fields.result), fields.error ?? null, fields.steps ? JSON.stringify(fields.steps) : null, own ?? null, fields.cost ?? null, fields.sessionId ?? null],
  );
}

async function ownCost(pool: pg.Pool, jobId: string, sessionId: string, total: number): Promise<number> {
  const { rows } = await pool.query<{ before: string }>(
    `select coalesce(session_cost_usd, cost_usd) as before from presenza.ai_jobs
     where session_id = $1 and id <> $2 and coalesce(session_cost_usd, cost_usd) is not null
       and created_at < (select created_at from presenza.ai_jobs where id = $2)
     order by created_at desc limit 1`,
    [sessionId, jobId],
  );
  const before = Number(rows[0]?.before ?? 0);
  return total >= before ? total - before : total;
}

export async function insertUsage(pool: pg.Pool, job: Job, usage: ToolUsage): Promise<void> {
  const brandId = (job.input as { brandId?: string } | null)?.brandId ?? null;
  await pool.query(
    `insert into presenza.ai_usage (account_id, brand_id, job_id, task, model, outcome, error, duration_ms, cost_usd, input_tokens, output_tokens, units, unit)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [job.account_id, brandId, job.id, usage.task, usage.model, usage.outcome, usage.error ?? null, Math.round(usage.durationMs), usage.costUsd ?? null, usage.inputTokens ?? 0, usage.outputTokens ?? 0, usage.units ?? null, usage.unit ?? null],
  );
}

// Il logo del brand com'è sul DB (data URI), null se non ce l'ha; undefined se il brand non è ancora sul DB (onboarding).
export async function findBrandLogo(pool: pg.Pool, brandId: string): Promise<string | null | undefined> {
  const { rows } = await pool.query<{ logo: string | null }>(`select visual->>'logoUri' as logo from presenza.brands where id = $1`, [brandId]);
  return rows[0] ? rows[0].logo : undefined;
}

// Quanto è costato fare un contenuto di ogni formato negli ultimi giorni (il job che lo ha fatto più le sue generazioni),
// in dollari: la mediana e l'80° percentile, con quanti campioni.
export async function measureContentCosts(pool: pg.Pool): Promise<{ format: string; n: number; typical: number; high: number }[]> {
  const { rows } = await pool.query<{ format: string; n: number; typical: number; high: number }>(
    `with made as (
       select j.input->>'format' as format,
         coalesce(j.cost_usd, 0) + coalesce((select sum(u.cost_usd) from presenza.ai_usage u where u.job_id = j.id), 0) as usd
       from presenza.ai_jobs j
       where j.status = 'done' and j.kind = 'content-video' and j.created_at > now() - make_interval(days => $1)
     )
     select format, count(*)::int as n,
       percentile_cont(0.5) within group (order by usd) as typical,
       percentile_cont(0.8) within group (order by usd) as high
     from made where format is not null group by format`,
    [COST_WINDOW_DAYS],
  );
  return rows.map((row) => ({ ...row, typical: Number(row.typical), high: Number(row.high) }));
}
