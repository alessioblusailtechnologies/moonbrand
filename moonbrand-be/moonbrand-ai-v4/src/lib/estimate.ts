import type { Pool } from 'pg';

import type { MeasuredPrice, MeasuredPrices } from './prices';

// Quanto consumano di solito un carosello e un video nuovi, per la stima che la chat dice prima di partire. Si misura sui
// contenuti salvati dalla chat negli ultimi giorni: un contenuto costa i turni della sua conversazione dal salvataggio
// prima (o dall'inizio) al suo, Claude più le generazioni in ai_usage. Così la stima segue modello, prezzi e lavori come
// sono adesso.

export interface CreditRange {
  typical: number;
  high: number;
}

export interface Estimates {
  carousel: CreditRange;
  video: CreditRange;
}

const WINDOW_DAYS = 30;
// Sotto questi contenuti la misura non regge e si usa la riserva.
const MIN_SAMPLES = 5;
// La riserva, prudente: dalle prove del 17 ottobre 2026 (un reel con 5 clip circa 5 $, un carosello circa 1,5 $).
const FALLBACK: Estimates = { carousel: { typical: 150, high: 300 }, video: { typical: 400, high: 800 } };
const CACHE_MS = 10 * 60_000;

let cached: { at: number; estimates: Estimates } | undefined;

// 1 credito = 1 centesimo di dollaro di costo vero; la stima si arrotonda alle decine.
const credits = (usd: number, round: (value: number) => number) => round((usd * 100) / 10) * 10;

export async function measureEstimates(pool: Pool): Promise<Estimates> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.estimates;
  const { rows } = await pool.query<{ format: 'carousel' | 'video'; n: number; typical: number; high: number }>(
    `with saved as (
       select c.format, c.conversation_id, c.created_at,
         lag(c.created_at) over (partition by c.conversation_id order by c.created_at) as previous
       from presenza.contents c
       where c.conversation_id is not null and c.created_at > now() - make_interval(days => $1)
     ),
     costs as (
       select s.format,
         (select coalesce(sum(coalesce(j.cost_usd, 0) + coalesce((select sum(u.cost_usd) from presenza.ai_usage u where u.job_id = j.id), 0)), 0)
          from presenza.ai_jobs j
          where j.kind = 'chat' and j.input->>'conversationId' = s.conversation_id::text
            and j.created_at <= s.created_at and (s.previous is null or j.created_at > s.previous)) as usd
       from saved s
       where s.format in ('carousel', 'video')
     )
     select format, count(*)::int as n,
       percentile_cont(0.5) within group (order by usd) as typical,
       percentile_cont(0.8) within group (order by usd) as high
     from costs
     where usd > 0
     group by format`,
    [WINDOW_DAYS],
  );
  const range = (format: keyof Estimates): CreditRange => {
    const row = rows.find((item) => item.format === format);
    if (!row || row.n < MIN_SAMPLES) return FALLBACK[format];
    return { typical: credits(row.typical, Math.floor), high: credits(row.high, Math.ceil) };
  };
  const estimates = { carousel: range('carousel'), video: range('video') };
  cached = { at: Date.now(), estimates };
  return estimates;
}

// Quanto costa per unità ogni generazione, misurato su ai_usage degli ultimi giorni: per modello (la stima di Atlas prima
// di partire) e per tipo di lavoro (i crediti che la chat dice all'utente). Niente listini: solo quanto si è pagato davvero.
// Ogni modello o lavoro prende l'unità con più misure.
const PRICE_MIN_SAMPLES = 3;

let cachedPrices: { at: number; prices: MeasuredPrices } | undefined;

export async function measurePrices(pool: Pool): Promise<MeasuredPrices> {
  if (cachedPrices && Date.now() - cachedPrices.at < CACHE_MS) return cachedPrices.prices;
  const { rows } = await pool.query<{ task: string; model: string; unit: string; usd: string; units: string; n: number }>(
    `select task, model, unit, sum(cost_usd) as usd, sum(units) as units, count(*)::int as n
     from presenza.ai_usage
     where outcome = 'ok' and cost_usd is not null and units > 0 and unit is not null
       and created_at > now() - make_interval(days => $1)
     group by task, model, unit`,
    [WINDOW_DAYS],
  );
  const perKey = (key: (row: (typeof rows)[number]) => string): Record<string, MeasuredPrice> => {
    const sums = new Map<string, { name: string; unit: string; usd: number; units: number; n: number }>();
    for (const row of rows) {
      const id = `${key(row)}\n${row.unit}`;
      const sum = sums.get(id) ?? { name: key(row), unit: row.unit, usd: 0, units: 0, n: 0 };
      sum.usd += Number(row.usd);
      sum.units += Number(row.units);
      sum.n += row.n;
      sums.set(id, sum);
    }
    const prices: Record<string, MeasuredPrice> = {};
    for (const sum of sums.values()) {
      if (sum.n < PRICE_MIN_SAMPLES || !(sum.units > 0)) continue;
      if (!prices[sum.name] || prices[sum.name]!.samples < sum.n) prices[sum.name] = { unit: sum.unit, usdPerUnit: sum.usd / sum.units, samples: sum.n };
    }
    return prices;
  };
  const prices = { models: perKey((row) => row.model), tasks: perKey((row) => row.task) };
  cachedPrices = { at: Date.now(), prices };
  return prices;
}

// Dal worker allo script della chat, per variabile d'ambiente.
const ENV = 'MOONBRAND_STIME';

export function estimatesEnv(estimates: Estimates): Record<string, string> {
  return { [ENV]: JSON.stringify(estimates) };
}

export function estimatesFromEnv(env: Record<string, string | undefined>): Estimates {
  try {
    const parsed = JSON.parse(env[ENV] ?? '') as Estimates;
    if (parsed.carousel?.typical > 0 && parsed.video?.typical > 0) return parsed;
  } catch {
    // la riserva
  }
  return FALLBACK;
}
