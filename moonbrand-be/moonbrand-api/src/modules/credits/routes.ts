import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type {
  CreditActivity,
  CreditActivityKind,
  CreditCategory,
  CreditsResponse,
  CreditUsageResponse,
} from '@moonbrand/shared/api/contract';
import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { withIdentity } from '../../db/identity';
import { ApiError } from '../../errors';

// I crediti del mese di un brand: quelli del suo piano meno i suoi consumi dal primo del mese a Roma, dal registro dei
// movimenti (migration credits), che scalano i trigger. Piani e crediti sono per brand (migration brand_credits); senza
// brandId vale il brand attivo. Finché non ci sono i pagamenti ogni brand è Pro.
const querySchema = z.object({ brandId: z.uuid('Brand non trovato.').optional() });

export function registerCreditRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/credits', (request) =>
    withIdentity(pool, request.identity, async (db): Promise<CreditsResponse> => {
      const { brandId } = querySchema.parse(request.query);
      const { rows } = await db.query<{ plan: SubscriptionPlanId | null; used: string; renews_on: string }>(
        `with month as (select date_trunc('month', now() at time zone 'Europe/Rome') as start),
              brand as (
                select b.id, b.plan from presenza.brands b
                where b.id = coalesce($2::uuid, (select a.active_brand_id from presenza.accounts a where a.id = $1))
              )
         select (select plan from brand) as plan,
           coalesce(-sum(m.amount) filter (where m.amount < 0 and m.created_at >= month.start at time zone 'Europe/Rome'), 0) as used,
           to_char(month.start + interval '1 month', 'YYYY-MM-DD') as renews_on
         from month left join presenza.credit_movements m on m.brand_id = (select id from brand)
         group by month.start`,
        [request.identity.accountId, brandId ?? null],
      );
      const plan = rows[0].plan ?? DEFAULT_SUBSCRIPTION_PLAN;
      const { monthlyCredits } = SUBSCRIPTION_PLANS[plan];
      const usedThisMonth = Math.round(Number(rows[0].used));
      return { plan, monthlyCredits, usedThisMonth, remaining: monthlyCredits - usedThisMonth, renewsOn: rows[0].renews_on };
    }),
  );

  // Il dettaglio di un mese, attività per attività. Il brand si controlla con l'identità di chi chiede; i movimenti si
  // leggono poi con il pool, perché ai_usage non è leggibile da presenza_user (dice anche servizi e modelli), sempre
  // filtrati per account e brand.
  app.get('/v1/credits/usage', async (request): Promise<CreditUsageResponse> => {
    const { brandId, month } = usageSchema.parse(request.query);
    const { accountId } = request.identity;
    const owned = await withIdentity(pool, request.identity, async (db) => {
      const { rowCount } = await db.query('select 1 from presenza.brands where id = $1', [brandId]);
      return rowCount === 1;
    });
    if (!owned) throw ApiError.notFound('Brand non trovato.');

    const { rows: monthRows } = await pool.query<{ month: string }>(
      `select to_char(now() at time zone 'Europe/Rome', 'YYYY-MM') as month
       union
       select to_char(m.created_at at time zone 'Europe/Rome', 'YYYY-MM')
       from presenza.credit_movements m where m.account_id = $1 and m.brand_id = $2 and m.amount < 0
       order by month desc`,
      [accountId, brandId],
    );
    // Dal più recente: il primo è il mese in corso.
    const months = monthRows.map((row) => row.month);
    const shown = month ?? months[0];

    const { rows } = await pool.query<MovementRow>(
      `select m.id, m.amount, m.kind, m.job_id, m.created_at, u.task, u.units, u.unit,
         j.kind as job_kind, j.created_at as job_at, c.title as conversation_title, t.message, ct.title as content_title
       from presenza.credit_movements m
       left join presenza.ai_usage u on u.id = m.usage_id
       left join presenza.ai_jobs j on j.id = m.job_id
       left join presenza.conversation_turns t on t.job_id = j.id
       left join presenza.conversations c on c.id = t.conversation_id
       left join presenza.contents ct on ct.id::text = j.input->>'contentId'
       where m.account_id = $1 and m.brand_id = $2 and m.amount < 0
         and to_char(m.created_at at time zone 'Europe/Rome', 'YYYY-MM') = $3
       order by m.created_at`,
      [accountId, brandId, shown],
    );
    return { month: shown, months, ...summarize(rows) };
  });
}

const usageSchema = z.object({
  brandId: z.uuid('Brand non trovato.'),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mese non valido.')
    .optional(),
});

interface MovementRow {
  id: string;
  amount: string;
  kind: 'claude' | 'generation' | 'plan' | 'topup' | 'adjustment';
  job_id: string | null;
  created_at: Date;
  task: string | null;
  units: string | null;
  unit: string | null;
  job_kind: string | null;
  job_at: Date | null;
  conversation_title: string | null;
  message: string | null;
  content_title: string | null;
}

// Le voci del consumo dai task di ai_usage, compresi quelli dei primi mesi; quello che non si riconosce è «altro».
const CATEGORY_BY_TASK: Record<string, CreditCategory> = {
  image: 'image',
  cutout: 'image',
  'video-cover': 'image',
  clip: 'clip',
  'video-clip': 'clip',
  'video-scene': 'clip',
  music: 'music',
  song: 'music',
  voice: 'voice',
  'sound-effect': 'sound',
  'word-timing': 'subtitles',
  'voice-isolation': 'subtitles',
  vision: 'check',
  'video-frame': 'check',
  'video-export': 'export',
  'social-download': 'download',
  transcription: 'dictation',
};

const ACTIVITY_BY_JOB: Record<string, CreditActivityKind> = {
  chat: 'chat',
  content: 'content',
  'content-edit': 'content',
  'content-video': 'content',
  ideas: 'ideas',
  website: 'brand',
  visual: 'brand',
  'visual-edit': 'brand',
  style: 'brand',
  'video-setup': 'brand',
  welcome: 'welcome',
};

const MAX_REQUEST = 140;
const round = (value: number) => Math.round(value * 100) / 100;

function summarize(rows: MovementRow[]): Omit<CreditUsageResponse, 'month' | 'months'> {
  const activities = new Map<string, CreditActivity>();
  const totals = new Map<CreditCategory, number>();
  for (const row of rows) {
    const credits = -Number(row.amount);
    const category: CreditCategory = row.kind === 'claude' ? 'assistant' : (CATEGORY_BY_TASK[row.task ?? ''] ?? 'other');
    totals.set(category, (totals.get(category) ?? 0) + credits);

    // Un'attività è un lavoro; le generazioni senza lavoro (la dettatura) sono un'attività ciascuna.
    const key = row.job_id ?? row.id;
    let activity = activities.get(key);
    if (!activity) {
      const request = row.message?.replace(/\s+/g, ' ').trim() ?? null;
      activity = {
        id: key,
        at: (row.job_at ?? row.created_at).toISOString(),
        kind: row.job_kind ? (ACTIVITY_BY_JOB[row.job_kind] ?? 'other') : category === 'dictation' ? 'dictation' : 'other',
        title: row.conversation_title ?? row.content_title ?? null,
        request: request && request.length > MAX_REQUEST ? `${request.slice(0, MAX_REQUEST - 1)}…` : request,
        credits: 0,
        parts: [],
      };
      activities.set(key, activity);
    }
    activity.credits += credits;
    let part = activity.parts.find((item) => item.category === category);
    if (!part) {
      part = { category, credits: 0, count: 0 };
      activity.parts.push(part);
    }
    part.credits += credits;
    part.count += 1;
    if (row.unit === 'secondi' && row.units) part.seconds = (part.seconds ?? 0) + Number(row.units);
  }

  const list = [...activities.values()]
    .map((activity) => ({
      ...activity,
      credits: round(activity.credits),
      parts: activity.parts
        .map((part) => ({ ...part, credits: round(part.credits), ...(part.seconds !== undefined && { seconds: round(part.seconds) }) }))
        .sort((a, b) => b.credits - a.credits),
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const categories = [...totals.entries()].map(([category, credits]) => ({ category, credits: round(credits) })).sort((a, b) => b.credits - a.credits);
  return { used: round(list.reduce((sum, activity) => sum + activity.credits, 0)), categories, activities: list };
}
