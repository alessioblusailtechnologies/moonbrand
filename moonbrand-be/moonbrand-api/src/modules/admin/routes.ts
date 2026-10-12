import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdminAccount, AdminAccountDetail, AdminCost, AdminJob, AdminJobsResponse, AdminOverview } from '@moonbrand/shared/api/contract';

import { adminEmails, type Config } from '../../config';
import { ApiError } from '../../errors';
import { accountEmail } from '../auth/accounts';
import type { BrandFiles } from '../brand-files/files';
import { listContents } from '../contents/repository';
import { summarize, withUrls } from '../contents/service';

// La sezione admin dello studio: utenze, consumi e lavori di tutti, solo per le email di ADMIN_EMAILS. Si legge con il
// pool, senza l'identità di chi chiede: ai_usage e i dati degli altri account non sono leggibili da presenza_user.
// I costi sono quelli veri in dollari: Claude dai job, i servizi (clip, immagini, musica...) da ai_usage. In ai_usage ci
// sono anche righe di Claude dei primi giorni (visual-style, video): contano come Claude, come nei crediti.

const MONTH_START = `date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'`;
const ROME_DAY = (column: string) => `to_char(${column} at time zone 'Europe/Rome', 'YYYY-MM-DD')`;
// Il costo di Claude e dei servizi da ai_usage, per le righe che soddisfano la condizione.
const USAGE_CLAUDE = (where: string) => `(select coalesce(sum(cost_usd), 0) from presenza.ai_usage where ${where} and model like 'claude%')`;
const USAGE_SERVICES = (where: string) =>
  `(select coalesce(sum(cost_usd), 0) from presenza.ai_usage where ${where} and coalesce(model, '') not like 'claude%')`;
const JOBS_CLAUDE = (where: string) => `(select coalesce(sum(cost_usd), 0) from presenza.ai_jobs where ${where})`;

const usd = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
const cost = (claude: unknown, generations: unknown): AdminCost => ({ claude: usd(claude), generations: usd(generations) });
const iso = (value: Date | null) => (value ? value.toISOString() : null);

// Un lavoro con chi l'ha chiesto, il brand, quanto è durato e quanto è costato. In coda: da quanto aspetta.
const JOB_SELECT = `
  select j.id, j.kind, j.status, j.account_id, a.email, b.identity->>'name' as brand_name,
    j.created_at, j.started_at, j.finished_at,
    case when j.status = 'queued' then extract(epoch from now() - j.created_at)
         when j.started_at is null then null
         else extract(epoch from coalesce(j.finished_at, now()) - j.started_at) end as seconds,
    coalesce(j.cost_usd, 0) + ${USAGE_CLAUDE('job_id = j.id')} as claude, ${USAGE_SERVICES('job_id = j.id')} as generations,
    j.error, t.message as request
  from presenza.ai_jobs j
  join presenza.accounts a on a.id = j.account_id
  left join presenza.brands b on b.id::text = j.input->>'brandId'
  left join lateral (select message from presenza.conversation_turns where job_id = j.id limit 1) t on true`;

interface JobRow {
  id: string;
  kind: string;
  status: AdminJob['status'];
  account_id: string;
  email: string;
  brand_name: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  seconds: string | null;
  claude: string;
  generations: string;
  error: string | null;
  request: string | null;
}

const MAX_TEXT = 300;
const short = (text: string | null) => (text && text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);

function toJob(row: JobRow): AdminJob {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    accountId: row.account_id,
    email: row.email,
    brandName: row.brand_name,
    createdAt: row.created_at.toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    seconds: row.seconds === null ? null : Math.round(Number(row.seconds)),
    cost: cost(row.claude, row.generations),
    error: short(row.error),
    request: short(row.request),
  };
}

interface AccountRow {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  last_sign_in_at: Date | null;
  confirmed: boolean;
  brands: string;
  contents: string;
  jobs: string;
  last_activity: Date | null;
  claude: string;
  generations: string;
  credits_month: string;
}

const ACCOUNT_SELECT = `
  select a.id, a.email, a.name, a.created_at, a.last_sign_in_at, a.email_confirmed_at is not null as confirmed,
    (select count(*) from presenza.brands where account_id = a.id) as brands,
    (select count(*) from presenza.contents where account_id = a.id) as contents,
    (select count(*) from presenza.ai_jobs where account_id = a.id) as jobs,
    (select max(created_at) from presenza.ai_jobs where account_id = a.id) as last_activity,
    ${JOBS_CLAUDE('account_id = a.id')} + ${USAGE_CLAUDE('account_id = a.id')} as claude,
    ${USAGE_SERVICES('account_id = a.id')} as generations,
    (select coalesce(-sum(amount), 0) from presenza.credit_movements
      where account_id = a.id and amount < 0 and created_at >= ${MONTH_START}) as credits_month
  from presenza.accounts a`;

function toAccount(row: AccountRow): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    lastSignInAt: iso(row.last_sign_in_at),
    emailConfirmed: row.confirmed,
    brands: Number(row.brands),
    contents: Number(row.contents),
    jobs: Number(row.jobs),
    lastActivityAt: iso(row.last_activity),
    cost: cost(row.claude, row.generations),
    creditsMonth: Math.round(Number(row.credits_month)),
  };
}

const accountParams = z.object({ accountId: z.uuid('Utenza non trovata.') });

export function registerAdminRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  files: BrandFiles,
  settings: Pick<Config, 'ADMIN_EMAILS'>,
): void {
  const admins = adminEmails(settings);

  void app.register(async (scope) => {
    scope.addHook('preHandler', async (request) => {
      const email = await accountEmail(pool, request.identity.accountId);
      if (!email || !admins.has(email.toLowerCase())) throw ApiError.forbidden('NOT_ADMIN', 'Questa sezione è solo per gli admin.');
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
        pool.query<{ id: string; name: string | null; category: string | null; created_at: Date; credits_month: string; claude: string; generations: string }>(
          `select b.id, b.identity->>'name' as name, b.identity->>'category' as category, b.created_at,
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
  });
}
