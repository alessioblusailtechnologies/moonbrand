import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdminFreeJobs, AdminSpending, CreditCategory } from '@moonbrand/shared/api/contract';

import { categoryOf, JOB_SELECT, toJob, toParts, usd, type JobRow } from './queries';

// Dove vanno i soldi per voce (Claude, clip, immagini...) e i lavori gratuiti, mese per mese. Le righe di costo sono
// la parte di Claude dei lavori (ai_jobs.cost_usd, quando il lavoro finisce) e quelle di ai_usage (quando la
// generazione finisce); le voci sono quelle dei crediti, con tutte le chiamate dirette a Claude sotto «assistant».

const monthQuery = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mese non valido.')
    .optional(),
});

const ROME_MONTH = (column: string) => `to_char(${column} at time zone 'Europe/Rome', 'YYYY-MM')`;
const JOB_AT = 'coalesce(j.finished_at, j.created_at)';
const MAX_FREE_JOBS = 300;

const LINES = `
  select j.id as job_id, j.free, ${JOB_AT} as at, j.cost_usd as usd, 'job' as task, 'claude' as model, null::numeric as units, null as unit
  from presenza.ai_jobs j where coalesce(j.cost_usd, 0) <> 0
  union all
  select u.job_id, coalesce(j.free, false), u.created_at, u.cost_usd, u.task, u.model, u.units, u.unit
  from presenza.ai_usage u left join presenza.ai_jobs j on j.id = u.job_id where u.cost_usd > 0`;

interface LineRow {
  job_id: string | null;
  free: boolean;
  usd: string;
  task: string;
  model: string | null;
  units: string | null;
  unit: string | null;
}

// I mesi con dei costi, dal più recente, con quello in corso; il mese chiesto o quello in corso.
async function months(pool: pg.Pool, month: string | undefined): Promise<{ shown: string; list: string[] }> {
  const { rows } = await pool.query<{ month: string }>(
    `select ${ROME_MONTH('now()')} as month
     union select ${ROME_MONTH('created_at')} from presenza.ai_usage where cost_usd > 0
     union select ${ROME_MONTH('coalesce(finished_at, created_at)')} from presenza.ai_jobs where coalesce(cost_usd, 0) <> 0
     order by month desc`,
  );
  const list = rows.map((row) => row.month);
  return { shown: month ?? list[0], list };
}

export function registerAdminSpending(scope: FastifyInstance, pool: pg.Pool): void {
  scope.get('/v1/admin/spending', async (request): Promise<AdminSpending> => {
    const { shown, list } = await months(pool, monthQuery.parse(request.query).month);
    const { rows } = await pool.query<LineRow>(`select * from (${LINES}) x where ${ROME_MONTH('at')} = $1`, [shown]);

    const categories = new Map<CreditCategory, { paid: number; free: number; count: number; seconds: number | null; tasks: Map<string, number> }>();
    for (const line of rows) {
      const category = categoryOf(line.task, line.model);
      const value = Number(line.usd);
      const entry = categories.get(category) ?? { paid: 0, free: 0, count: 0, seconds: null, tasks: new Map() };
      entry[line.free ? 'free' : 'paid'] += value;
      entry.count += 1;
      if (line.unit === 'secondi' && line.units) entry.seconds = (entry.seconds ?? 0) + Number(line.units);
      entry.tasks.set(line.task, (entry.tasks.get(line.task) ?? 0) + value);
      categories.set(category, entry);
    }
    const items = [...categories.entries()]
      .map(([category, entry]) => ({
        category,
        paidUsd: usd(entry.paid),
        freeUsd: usd(entry.free),
        count: entry.count,
        seconds: entry.seconds === null ? null : Math.round(entry.seconds),
        tasks: [...entry.tasks.entries()].map(([task, value]) => ({ task, usd: usd(value) })).sort((a, b) => b.usd - a.usd),
      }))
      .sort((a, b) => b.paidUsd + b.freeUsd - (a.paidUsd + a.freeUsd));
    return {
      month: shown,
      months: list,
      paidUsd: usd([...categories.values()].reduce((sum, entry) => sum + entry.paid, 0)),
      freeUsd: usd([...categories.values()].reduce((sum, entry) => sum + entry.free, 0)),
      categories: items,
    };
  });

  scope.get('/v1/admin/free-jobs', async (request): Promise<AdminFreeJobs> => {
    const { shown, list } = await months(pool, monthQuery.parse(request.query).month);
    const [jobs, lines] = await Promise.all([
      pool.query<JobRow>(`${JOB_SELECT} where j.free and ${ROME_MONTH(JOB_AT)} = $1 order by j.created_at desc`, [shown]),
      pool.query<LineRow>(`select * from (${LINES}) x where x.free and ${ROME_MONTH('at')} = $1`, [shown]),
    ]);

    // Le voci di ogni lavoro e del mese. Le righe seguono il mese del costo, i lavori quello in cui sono finiti: una
    // generazione a cavallo della mezzanotte del primo può finire in un mese diverso dal suo lavoro.
    const parts = new Map<string, Map<CreditCategory, number>>();
    const totals = new Map<CreditCategory, number>();
    for (const line of lines.rows) {
      const category = categoryOf(line.task, line.model);
      const value = Number(line.usd);
      totals.set(category, (totals.get(category) ?? 0) + value);
      if (!line.job_id) continue;
      const job = parts.get(line.job_id) ?? new Map<CreditCategory, number>();
      job.set(category, (job.get(category) ?? 0) + value);
      parts.set(line.job_id, job);
    }

    const all = jobs.rows.map((row) => ({
      ...toJob(row),
      parts: toParts(parts.get(row.id) ?? new Map()),
    }));
    const kinds = new Map<string, { jobs: number; usd: number }>();
    for (const job of all) {
      const kind = kinds.get(job.kind) ?? { jobs: 0, usd: 0 };
      kinds.set(job.kind, { jobs: kind.jobs + 1, usd: kind.usd + job.cost.claude + job.cost.generations });
    }
    return {
      month: shown,
      months: list,
      totalUsd: usd([...totals.values()].reduce((sum, value) => sum + value, 0)),
      byKind: [...kinds.entries()].map(([kind, entry]) => ({ kind, jobs: entry.jobs, usd: usd(entry.usd) })).sort((a, b) => b.usd - a.usd),
      byCategory: toParts(totals),
      jobs: all.slice(0, MAX_FREE_JOBS),
    };
  });
}
