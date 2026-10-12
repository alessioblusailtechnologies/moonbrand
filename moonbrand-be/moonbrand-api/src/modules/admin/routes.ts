import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdminAccount, AdminAccountDetail, AdminJobsResponse, AdminOverview } from '@moonbrand/shared/api/contract';

import type { Config } from '../../config';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { listContents } from '../contents/repository';
import { summarize, withUrls } from '../contents/service';
import type { AuthGateway } from '../auth/gateway';
import { registerAdminActions } from './actions';
import { registerAdminInsights } from './insights';
import {
  ACCOUNT_SELECT,
  adminCheck,
  cost,
  iso,
  JOB_SELECT,
  JOBS_CLAUDE,
  MONTH_START,
  ROME_DAY,
  toAccount,
  toJob,
  USAGE_CLAUDE,
  USAGE_SERVICES,
  usd,
  type AccountRow,
  type JobRow,
} from './queries';

// La sezione admin dello studio: utenze, consumi e lavori di tutti, solo per le email di ADMIN_EMAILS. Si legge con il
// pool, senza l'identità di chi chiede: ai_usage e i dati degli altri account non sono leggibili da presenza_user.

const accountParams = z.object({ accountId: z.uuid('Utenza non trovata.') });

export function registerAdminRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  files: BrandFiles,
  gateway: AuthGateway,
  settings: Pick<Config, 'ADMIN_EMAILS'>,
): void {
  const isAdmin = adminCheck(pool, settings);

  void app.register(async (scope) => {
    scope.addHook('preHandler', async (request) => {
      if (!(await isAdmin(request.identity.accountId))) throw ApiError.forbidden('NOT_ADMIN', 'Questa sezione è solo per gli admin.');
    });

    scope.get('/v1/admin/overview', async (): Promise<AdminOverview> => {
      const [counts, costs, daily, byTask, failures] = await Promise.all([
        pool.query<Record<string, string>>(
          `select
             (select count(*) from presenza.accounts) as accounts,
             (select count(*) from presenza.accounts where ${ROME_DAY('created_at')} = ${ROME_DAY('now()')}) as new_today,
             (select count(*) from presenza.accounts where created_at > now() - interval '7 days') as new_7d,
             (select count(*) from presenza.accounts where last_sign_in_at > now() - interval '7 days') as active_7d,
             (select count(*) from presenza.brands) as brands,
             (select count(*) from presenza.contents) as contents,
             (select count(*) from presenza.contents where created_at > now() - interval '7 days') as contents_7d,
             (select count(*) from presenza.publications where status = 'published') as published,
             (select count(*) from presenza.ai_jobs where status = 'queued') as queued,
             (select count(*) from presenza.ai_jobs where status = 'running') as running,
             (select count(*) from presenza.ai_jobs where status = 'failed' and created_at > now() - interval '24 hours') as failed_24h,
             (select count(*) from presenza.ai_jobs where status = 'done' and created_at > now() - interval '24 hours') as done_24h`,
        ),
        pool.query<{ span: string; claude: string; generations: string }>(
          `with spans(span, since) as (values
             ('today', date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'),
             ('days7', now() - interval '7 days'),
             ('days30', now() - interval '30 days'))
           select s.span,
             ${JOBS_CLAUDE('created_at >= s.since')} + ${USAGE_CLAUDE('created_at >= s.since')} as claude,
             ${USAGE_SERVICES('created_at >= s.since')} as generations
           from spans s`,
        ),
        pool.query<{ date: string; claude: string; generations: string }>(
          `with days as (
             select to_char(d, 'YYYY-MM-DD') as date
             from generate_series((now() at time zone 'Europe/Rome')::date - 29, (now() at time zone 'Europe/Rome')::date, interval '1 day') d)
           select days.date,
             ${JOBS_CLAUDE(`${ROME_DAY('created_at')} = days.date`)} + ${USAGE_CLAUDE(`${ROME_DAY('created_at')} = days.date`)} as claude,
             ${USAGE_SERVICES(`${ROME_DAY('created_at')} = days.date`)} as generations
           from days order by days.date`,
        ),
        pool.query<{ task: string; model: string; count: string; usd: string }>(
          `select task, coalesce(model, '') as model, count(*) as count, coalesce(sum(cost_usd), 0) as usd
           from presenza.ai_usage where created_at > now() - interval '30 days'
           group by 1, 2 order by 4 desc limit 20`,
        ),
        pool.query<JobRow>(`${JOB_SELECT} where j.status = 'failed' order by j.created_at desc limit 10`),
      ]);
      const c = counts.rows[0];
      const span = (name: string) => {
        const row = costs.rows.find((item) => item.span === name);
        return cost(row?.claude, row?.generations);
      };
      return {
        accounts: { total: Number(c.accounts), newToday: Number(c.new_today), new7d: Number(c.new_7d), active7d: Number(c.active_7d) },
        brands: Number(c.brands),
        contents: { total: Number(c.contents), new7d: Number(c.contents_7d) },
        published: Number(c.published),
        jobs: { queued: Number(c.queued), running: Number(c.running), failed24h: Number(c.failed_24h), done24h: Number(c.done_24h) },
        cost: { today: span('today'), days7: span('days7'), days30: span('days30') },
        daily: daily.rows.map((row) => ({ date: row.date, ...cost(row.claude, row.generations) })),
        byTask: byTask.rows.map((row) => ({ task: row.task, model: row.model, count: Number(row.count), usd: usd(row.usd) })),
        failures: failures.rows.map(toJob),
      };
    });

    scope.get('/v1/admin/accounts', async (): Promise<AdminAccount[]> => {
      const { rows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} order by coalesce(
        (select max(created_at) from presenza.ai_jobs where account_id = a.id), a.last_sign_in_at, a.created_at) desc nulls last`);
      return rows.map(toAccount);
    });

    scope.get('/v1/admin/accounts/:accountId', async (request): Promise<AdminAccountDetail> => {
      const { accountId } = accountParams.parse(request.params);
      const { rows: accountRows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} where a.id = $1`, [accountId]);
      if (!accountRows[0]) throw ApiError.notFound('Utenza non trovata.');

      const [brands, conversations, jobs] = await Promise.all([
        pool.query<{
          id: string;
          name: string | null;
          category: string | null;
          plan: string;
          created_at: Date;
          credits_month: string;
          claude: string;
          generations: string;
        }>(
          `select b.id, b.identity->>'name' as name, b.identity->>'category' as category, b.plan, b.created_at,
             (select coalesce(-sum(amount), 0) from presenza.credit_movements
               where brand_id = b.id and amount < 0 and created_at >= ${MONTH_START}) as credits_month,
             ${JOBS_CLAUDE("input->>'brandId' = b.id::text")} + ${USAGE_CLAUDE('brand_id = b.id')} as claude,
             ${USAGE_SERVICES('brand_id = b.id')} as generations
           from presenza.brands b where b.account_id = $1 order by b.created_at`,
          [accountId],
        ),
        pool.query<{ id: string; brand_name: string | null; title: string; created_at: Date; turns: string; last_turn: Date | null }>(
          `select c.id, b.identity->>'name' as brand_name, c.title, c.created_at,
             (select count(*) from presenza.conversation_turns where conversation_id = c.id) as turns,
             (select max(created_at) from presenza.conversation_turns where conversation_id = c.id) as last_turn
           from presenza.conversations c left join presenza.brands b on b.id = c.brand_id
           where c.account_id = $1 order by c.updated_at desc limit 100`,
          [accountId],
        ),
        pool.query<JobRow>(`${JOB_SELECT} where j.account_id = $1 order by j.created_at desc limit 100`, [accountId]),
      ]);

      const names = new Map(brands.rows.map((brand) => [brand.id, brand.name]));
      const contents = (await Promise.all(brands.rows.map((brand) => listContents(pool, brand.id))))
        .flat()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 60)
        .map((content) => ({
          ...summarize(content, files, false),
          brandName: names.get(content.brandId) ?? null,
          videoUrl: withUrls(content, files).visual.files?.find((file) => file.role === 'video')?.url ?? null,
        }));

      return {
        account: toAccount(accountRows[0]),
        brands: brands.rows.map((brand) => ({
          id: brand.id,
          name: brand.name ?? 'Brand',
          category: brand.category,
          plan: brand.plan,
          createdAt: brand.created_at.toISOString(),
          creditsMonth: Math.round(Number(brand.credits_month)),
          cost: cost(brand.claude, brand.generations),
        })),
        conversations: conversations.rows.map((row) => ({
          id: row.id,
          brandName: row.brand_name,
          title: row.title,
          createdAt: row.created_at.toISOString(),
          turns: Number(row.turns),
          lastTurnAt: iso(row.last_turn),
        })),
        contents,
        jobs: jobs.rows.map(toJob),
      };
    });

    scope.get('/v1/admin/jobs', async (): Promise<AdminJobsResponse> => {
      const [active, failed, slowest] = await Promise.all([
        pool.query<JobRow>(`${JOB_SELECT} where j.status in ('queued', 'running') order by j.created_at`),
        pool.query<JobRow>(`${JOB_SELECT} where j.status = 'failed' and j.created_at > now() - interval '7 days' order by j.created_at desc limit 50`),
        pool.query<JobRow>(
          `${JOB_SELECT} where j.status = 'done' and j.started_at is not null and j.created_at > now() - interval '7 days'
           order by j.finished_at - j.started_at desc limit 20`,
        ),
      ]);
      return { active: active.rows.map(toJob), failed: failed.rows.map(toJob), slowest: slowest.rows.map(toJob) };
    });

    registerAdminInsights(scope, pool, files);
    registerAdminActions(scope, pool, gateway);
  });
}
