import type { Pool } from 'pg';

// Quanto consuma il lavoro di un video (agente e tool, senza le clip, che si stimano al secondo), per il consumo stimato
// che la chat dice prima di partire. Si misura sui video finiti negli ultimi giorni in questo ambiente, di tutti i brand:
// così la stima segue modello, prezzi e video come sono adesso. Un video è nuovo al primo export della sua conversazione
// (o del suo contenuto, nei job dello studio), una correzione agli export dopo.

export interface CreditRange {
  typical: number;
  high: number;
}

export interface VideoEstimate {
  new: CreditRange;
  edit: CreditRange;
}

const WINDOW_DAYS = 30;
// Sotto questi video la misura non regge e si usa la riserva: vale per il primo video di un ambiente nuovo.
const MIN_SAMPLES = 10;
// La riserva, prudente: dalle prove di inizio ottobre 2026 su Opus 5.5 (tipico 120-150, alto 190-260).
export const FALLBACK_ESTIMATE: VideoEstimate = { new: { typical: 150, high: 300 }, edit: { typical: 100, high: 200 } };

const ENV_NEW = 'MOONBRAND_VIDEO_CREDITS_NEW';
const ENV_EDIT = 'MOONBRAND_VIDEO_CREDITS_EDIT';

// 1 credito = 1 centesimo di dollaro di costo vero; la stima si arrotonda alle decine.
const credits = (usd: number, round: (value: number) => number) => round((usd * 100) / 10) * 10;

export async function measureVideoEstimate(pool: Pool): Promise<VideoEstimate> {
  const { rows } = await pool.query<{ first: boolean; n: number; typical: number; high: number }>(
    `with exports as (
       select j.id, j.created_at, coalesce(j.cost_usd, 0) as job_usd, coalesce(t.conversation_id::text, j.input->>'contentId') as video
       from presenza.ai_jobs j
       left join presenza.conversation_turns t on t.job_id = j.id
       where j.status = 'done' and j.kind in ('chat', 'content-video') and j.created_at > now() - make_interval(days => $1)
         and exists (select 1 from presenza.ai_usage u where u.job_id = j.id and u.model = 'remotion-lambda' and u.outcome = 'ok')
     ),
     costs as (
       select e.job_usd + coalesce((select sum(u.cost_usd) from presenza.ai_usage u where u.job_id = e.id and u.task <> 'clip'), 0) as usd,
         row_number() over (partition by e.video order by e.created_at) = 1 as first
       from exports e
       where e.video is not null
     )
     select first, count(*)::int as n,
       percentile_cont(0.5) within group (order by usd) as typical,
       percentile_cont(0.8) within group (order by usd) as high
     from costs
     group by first`,
    [WINDOW_DAYS],
  );
  const range = (first: boolean, fallback: CreditRange): CreditRange => {
    const row = rows.find((item) => item.first === first);
    if (!row || row.n < MIN_SAMPLES) return fallback;
    return { typical: credits(row.typical, Math.floor), high: credits(row.high, Math.ceil) };
  };
  return { new: range(true, FALLBACK_ESTIMATE.new), edit: range(false, FALLBACK_ESTIMATE.edit) };
}

// Dal worker allo script della chat, per variabile d'ambiente.
export function videoEstimateEnv(estimate: VideoEstimate): Record<string, string> {
  return { [ENV_NEW]: `${estimate.new.typical}-${estimate.new.high}`, [ENV_EDIT]: `${estimate.edit.typical}-${estimate.edit.high}` };
}

function parseRange(value: string | undefined, fallback: CreditRange): CreditRange {
  const [typical, high] = (value ?? '').split('-').map(Number);
  return typical > 0 && high >= typical ? { typical, high } : fallback;
}

export function videoEstimateFromEnv(env: Record<string, string | undefined>): VideoEstimate {
  return { new: parseRange(env[ENV_NEW], FALLBACK_ESTIMATE.new), edit: parseRange(env[ENV_EDIT], FALLBACK_ESTIMATE.edit) };
}
