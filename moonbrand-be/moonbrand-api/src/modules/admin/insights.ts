import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdminContent, AdminContentsResponse, AdminCost, AdminCosts, AdminHealth, AdminJobTimeline } from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { COLUMNS, toContent, type ContentRow } from '../contents/repository';
import { summarize, withUrls } from '../contents/service';
import { cost, iso, JOB_SELECT, MONTH_START, toJob, usd, type JobRow } from './queries';

const total = (value: AdminCost) => value.claude + value.generations;

// Le pagine admin che guardano tutto il servizio: i contenuti di tutti, dove vanno i soldi, cosa non va, e dove va il
// tempo di un lavoro.

const PAGE = 48;

const contentsQuery = z.object({
  brandId: z.uuid().optional(),
  format: z.enum(['post', 'carousel', 'video', 'article']).optional(),
  status: z.enum(['draft', 'approved']).optional(),
  q: z.string().trim().max(200).optional(),
  offset: z.coerce.number().int().min(0).default(0),
});

const jobParams = z.object({ jobId: z.uuid('Lavoro non trovato.') });

// Il costo di ogni contenuto: i lavori fatti su di lui (content, content-edit, content-video) più quelli della
// conversazione da cui è nato. Una query per tutti, con i lavori raccolti una volta sola.
async function contentCosts(pool: pg.Pool, contentIds: string[]): Promise<Map<string, AdminCost>> {
  if (contentIds.length === 0) return new Map();
  const { rows } = await pool.query<{ content_id: string; claude: string; generations: string }>(
    `with x as (select id, conversation_id from presenza.contents where id = any($1::uuid[])),
          cj as (
            select x.id as content_id, j.id as job_id, j.cost_usd
            from x join presenza.ai_jobs j on j.input->>'contentId' = x.id::text
            union
            select x.id, j.id, j.cost_usd
            from x join presenza.conversation_turns t on t.conversation_id = x.conversation_id join presenza.ai_jobs j on j.id = t.job_id),
          jobs as (select content_id, sum(coalesce(cost_usd, 0)) as usd from cj group by content_id),
          usage as (
            select cj.content_id,
              coalesce(sum(u.cost_usd) filter (where u.model like 'claude%'), 0) as claude,
              coalesce(sum(u.cost_usd) filter (where coalesce(u.model, '') not like 'claude%'), 0) as services
            from cj join presenza.ai_usage u on u.job_id = cj.job_id group by cj.content_id)
     select x.id as content_id, coalesce(jobs.usd, 0) + coalesce(usage.claude, 0) as claude, coalesce(usage.services, 0) as generations
     from x left join jobs on jobs.content_id = x.id left join usage on usage.content_id = x.id`,
    [contentIds],
  );
  return new Map(rows.map((row) => [row.content_id, cost(row.claude, row.generations)]));
}

// La riga della sessione di Claude Code che serve qui: chi parla, quando, e i tool chiesti o le loro risposte.
interface SessionLine {
  type?: string;
  timestamp?: string;
  message?: { content?: unknown };
}

interface ContentPart {
  type?: string;
  id?: string;
  tool_use_id?: string;
  name?: string;
  input?: unknown;
}

const MAX_STEPS = 400;
const MAX_DETAIL = 180;
// I tool degli MCP di moonbrand si leggono meglio senza il prefisso: mcp__clip__gira_clip → gira_clip.
const toolName = (name: string) => name.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, '');

// Il tempo di un lavoro dalla sua sessione. Le chat riprendono la stessa sessione a ogni turno: contano solo le righe
// tra l'inizio e la fine del lavoro. Il modello pensa dal momento in cui riceve qualcosa (il messaggio o le risposte dei
// tool) alla sua risposta successiva; ogni tool dura dalla richiesta alla sua risposta.
export function sessionTimeline(text: string, from: number, to: number): Omit<AdminJobTimeline, 'job' | 'available'> {
  const asked = new Map<string, { at: number; name: string; detail: string }>();
  const steps: AdminJobTimeline['steps'] = [];
  const tools = new Map<string, { calls: number; seconds: number; maxSeconds: number }>();
  let waitingSince: number | null = null;
  let model = 0;
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue;
    let line: SessionLine;
    try {
      line = JSON.parse(raw) as SessionLine;
    } catch {
      continue;
    }
    const at = line.timestamp ? Date.parse(line.timestamp) : NaN;
    if (!Number.isFinite(at) || at < from || at > to) continue;
    const parts = Array.isArray(line.message?.content) ? (line.message.content as ContentPart[]) : [];
    if (line.type === 'assistant') {
      if (waitingSince !== null) model += at - waitingSince;
      waitingSince = null;
      for (const part of parts) {
        if (part.type !== 'tool_use' || !part.id) continue;
        const detail = JSON.stringify(part.input ?? {});
        asked.set(part.id, { at, name: toolName(part.name ?? 'tool'), detail: detail.length > MAX_DETAIL ? `${detail.slice(0, MAX_DETAIL)}…` : detail });
      }
    } else if (line.type === 'user') {
      waitingSince = at;
      for (const part of parts) {
        const call = part.type === 'tool_result' && part.tool_use_id ? asked.get(part.tool_use_id) : undefined;
        if (!call) continue;
        const seconds = Math.max(0, Math.round((at - call.at) / 1000));
        const tool = tools.get(call.name) ?? { calls: 0, seconds: 0, maxSeconds: 0 };
        tools.set(call.name, { calls: tool.calls + 1, seconds: tool.seconds + seconds, maxSeconds: Math.max(tool.maxSeconds, seconds) });
        if (steps.length < MAX_STEPS) steps.push({ at: new Date(call.at).toISOString(), seconds, tool: call.name, detail: call.detail });
      }
    }
  }
  steps.sort((a, b) => a.at.localeCompare(b.at));
  return {
    modelSeconds: Math.round(model / 1000),
    tools: [...tools.entries()].map(([name, tool]) => ({ name, ...tool })).sort((a, b) => b.seconds - a.seconds),
    steps,
  };
}

export function registerAdminInsights(scope: FastifyInstance, pool: pg.Pool, files: BrandFiles): void {
  scope.get('/v1/admin/contents', async (request): Promise<AdminContentsResponse> => {
    const filters = contentsQuery.parse(request.query);
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (condition: string, value: unknown) => {
      params.push(value);
      where.push(condition.replace('?', `$${params.length}`));
    };
    if (filters.brandId) add('brand_id = ?', filters.brandId);
    if (filters.format) add('format = ?', filters.format);
    if (filters.status) add('status = ?', filters.status);
    if (filters.q) add('title ilike ?', `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`);
    const filter = where.length > 0 ? `where ${where.join(' and ')}` : '';

    const [rows, count, brands] = await Promise.all([
      pool.query<ContentRow & { brand_name: string | null; owner_id: string; email: string }>(
        `select x.*, b.identity->>'name' as brand_name, a.id as owner_id, a.email
         from (select ${COLUMNS} from presenza.contents ${filter} order by created_at desc limit ${PAGE} offset ${filters.offset}) x
         join presenza.brands b on b.id = x.brand_id
         join presenza.accounts a on a.id = b.account_id
         order by x.created_at desc`,
        params,
      ),
      pool.query<{ total: string }>(`select count(*) as total from presenza.contents ${filter}`, params),
      pool.query<{ id: string; name: string | null; email: string }>(
        `select b.id, b.identity->>'name' as name, a.email from presenza.brands b join presenza.accounts a on a.id = b.account_id
         where exists (select 1 from presenza.contents c where c.brand_id = b.id) order by a.email, name`,
      ),
    ]);
    const costs = await contentCosts(pool, rows.rows.map((row) => row.id));
    const items = rows.rows.map((row): AdminContent => {
      const content = toContent(row);
      return {
        ...summarize(content, files, false),
        brandId: content.brandId,
        brandName: row.brand_name,
        accountId: row.owner_id,
        email: row.email,
        createdAt: content.createdAt,
        videoUrl: withUrls(content, files).visual.files?.find((file) => file.role === 'video')?.url ?? null,
        cost: costs.get(row.id) ?? cost(0, 0),
      };
    });
    return {
      items,
      total: Number(count.rows[0].total),
      brands: brands.rows.map((brand) => ({ id: brand.id, name: brand.name ?? 'Brand', email: brand.email })),
    };
  });

  scope.get('/v1/admin/costs', async (): Promise<AdminCosts> => {
    const [byKind, byFormat, brands] = await Promise.all([
      pool.query<{ kind: string; jobs: string; avg_usd: string; avg_seconds: string | null; total_usd: string }>(
        `with j as (
           select j.kind, j.status, extract(epoch from j.finished_at - j.started_at) as seconds,
             coalesce(j.cost_usd, 0) + coalesce((select sum(cost_usd) from presenza.ai_usage u where u.job_id = j.id), 0) as usd
           from presenza.ai_jobs j where j.created_at > now() - interval '30 days')
         select kind, count(*) as jobs, avg(usd) as avg_usd, avg(seconds) filter (where status = 'done') as avg_seconds, sum(usd) as total_usd
         from j group by kind order by total_usd desc`,
      ),
      pool.query<{ id: string; format: string }>(`select id, format from presenza.contents where created_at > now() - interval '30 days'`),
      pool.query<{ id: string; name: string | null; plan: SubscriptionPlanId; account_id: string; email: string; used: string }>(
        `select b.id, b.identity->>'name' as name, b.plan, b.account_id, a.email,
           (select coalesce(-sum(amount), 0) from presenza.credit_movements
             where brand_id = b.id and amount < 0 and created_at >= ${MONTH_START}) as used
         from presenza.brands b join presenza.accounts a on a.id = b.account_id`,
      ),
    ]);
    const costs = await contentCosts(pool, byFormat.rows.map((row) => row.id));
    const formats = new Map<string, number[]>();
    for (const row of byFormat.rows) formats.set(row.format, [...(formats.get(row.format) ?? []), total(costs.get(row.id) ?? cost(0, 0))]);
    const used = brands.rows.map((brand) => ({ ...brand, used: Math.round(Number(brand.used)) }));
    const plans = (Object.keys(SUBSCRIPTION_PLANS) as SubscriptionPlanId[]).map((plan) => {
      const { name, monthlyCredits } = SUBSCRIPTION_PLANS[plan];
      const list = used.filter((brand) => brand.plan === plan);
      return {
        plan,
        name,
        monthlyCredits,
        brands: list.length,
        avgUsed: list.length > 0 ? Math.round(list.reduce((sum, brand) => sum + brand.used, 0) / list.length) : 0,
        maxUsed: list.reduce((max, brand) => Math.max(max, brand.used), 0),
        over: list.filter((brand) => brand.used > monthlyCredits).length,
      };
    });
    return {
      byKind: byKind.rows.map((row) => ({
        kind: row.kind,
        jobs: Number(row.jobs),
        avgUsd: usd(row.avg_usd),
        avgSeconds: Math.round(Number(row.avg_seconds ?? 0)),
        totalUsd: usd(row.total_usd),
      })),
      byFormat: [...formats.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([format, values]) => ({
          format,
          contents: values.length,
          avgUsd: usd(values.reduce((sum, value) => sum + value, 0) / values.length),
          maxUsd: usd(Math.max(...values)),
        })),
      plans,
      topBrands: used
        .filter((brand) => brand.used > 0)
        .sort((a, b) => b.used - a.used)
        .slice(0, 10)
        .map((brand) => ({
          brandId: brand.id,
          name: brand.name ?? 'Brand',
          accountId: brand.account_id,
          email: brand.email,
          plan: brand.plan,
          used: brand.used,
          // 1 credito = 1 centesimo di costo vero.
          usd: usd(brand.used / 100),
        })),
    };
  });

  scope.get('/v1/admin/health', async (): Promise<AdminHealth> => {
    const [times, stuck, lost, publications, generations] = await Promise.all([
      pool.query<{ last_started: Date | null; last_finished: Date | null; oldest_queued: string | null }>(
        `select max(started_at) as last_started, max(finished_at) as last_finished,
           (select extract(epoch from now() - min(created_at)) from presenza.ai_jobs where status = 'queued') as oldest_queued
         from presenza.ai_jobs`,
      ),
      pool.query<JobRow>(
        `${JOB_SELECT} where j.status = 'running' and (j.started_at < now() - interval '30 minutes' or j.locked_until < now())
         order by j.started_at`,
      ),
      pool.query<{ brand_id: string; brand_name: string | null; account_id: string; email: string; channel: string }>(
        `select b.id as brand_id, b.identity->>'name' as brand_name, a.id as account_id, a.email, ch.key as channel
         from presenza.brands b join presenza.accounts a on a.id = b.account_id, jsonb_each(b.channels) ch
         where jsonb_typeof(ch.value) = 'object' and ch.value->>'lost' = 'true'
         order by a.email`,
      ),
      pool.query<{ id: string; brand_name: string | null; email: string; channel: string; error: string | null; updated_at: Date }>(
        `select p.id, b.identity->>'name' as brand_name, a.email, p.channel, p.error, p.updated_at
         from presenza.publications p join presenza.brands b on b.id = p.brand_id join presenza.accounts a on a.id = p.account_id
         where p.status = 'failed' and p.updated_at > now() - interval '7 days' order by p.updated_at desc limit 50`,
      ),
      pool.query<{ created_at: Date; task: string; model: string | null; duration_ms: number | null; error: string | null; email: string | null }>(
        `select u.created_at, u.task, u.model, u.duration_ms, u.error, a.email
         from presenza.ai_usage u left join presenza.accounts a on a.id = u.account_id
         where u.outcome <> 'ok' and u.created_at > now() - interval '7 days' order by u.created_at desc limit 50`,
      ),
    ]);
    const time = times.rows[0];
    return {
      lastStartedAt: iso(time?.last_started ?? null),
      lastFinishedAt: iso(time?.last_finished ?? null),
      oldestQueuedSeconds: time?.oldest_queued === null || time?.oldest_queued === undefined ? null : Math.round(Number(time.oldest_queued)),
      stuck: stuck.rows.map(toJob),
      lostChannels: lost.rows.map((row) => ({
        brandId: row.brand_id,
        brandName: row.brand_name ?? 'Brand',
        accountId: row.account_id,
        email: row.email,
        channel: row.channel,
      })),
      failedPublications: publications.rows.map((row) => ({
        id: row.id,
        brandName: row.brand_name ?? 'Brand',
        email: row.email,
        channel: row.channel,
        error: row.error,
        at: row.updated_at.toISOString(),
      })),
      failedGenerations: generations.rows.map((row) => ({
        at: row.created_at.toISOString(),
        task: row.task,
        model: row.model ?? '',
        seconds: row.duration_ms === null ? null : Math.round(row.duration_ms / 1000),
        error: row.error,
        email: row.email,
      })),
    };
  });

  scope.get('/v1/admin/jobs/:jobId/timeline', async (request): Promise<AdminJobTimeline> => {
    const { jobId } = jobParams.parse(request.params);
    const { rows } = await pool.query<JobRow & { session_id: string | null; brand_id: string | null }>(
      `${JOB_SELECT.replace('select j.id,', 'select j.session_id, j.input->>\'brandId\' as brand_id, j.id,')} where j.id = $1`,
      [jobId],
    );
    const row = rows[0];
    if (!row) throw ApiError.notFound('Lavoro non trovato.');
    const job = toJob(row);
    const empty = { job, available: false, modelSeconds: 0, tools: [], steps: [] };
    if (!row.session_id || !row.brand_id || !row.started_at) return empty;
    const text = await files.session(row.brand_id, row.session_id);
    if (!text) return empty;
    // Qualche secondo di margine: le righe della sessione e le date del DB vengono da orologi diversi.
    const from = row.started_at.getTime() - 5_000;
    const to = (row.finished_at ?? new Date()).getTime() + 5_000;
    return { job, available: true, ...sessionTimeline(text, from, to) };
  });
}
