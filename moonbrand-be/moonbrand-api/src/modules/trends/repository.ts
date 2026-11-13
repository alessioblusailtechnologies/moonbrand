import type { Trend, TrendMarket, TrendPlatform, TrendSearchSummary } from '@moonbrand/shared/domain/trend';

import type { Queryable } from '../../db/pool';

export interface TrendRecord {
  // La categoria del brand al momento della ricerca ('' se non ne ha), per capire poi cosa si cerca.
  category: string;
  market: TrendMarket;
  platform: TrendPlatform;
  externalId: string;
  url: string;
  author: string;
  caption: string;
  country: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  music: string | null;
  publishedAt: string | null;
  query: string;
  relevance: number | null;
  // Il brand che l'ha trovato con una sua ricerca: lo vede solo lui.
  brandId: string;
}

interface TrendRow {
  id: string;
  brand_id: string;
  query: string;
  category: string;
  market: TrendMarket;
  platform: TrendPlatform;
  external_id: string;
  url: string;
  author: string;
  caption: string;
  thumbnail_path: string | null;
  country: string | null;
  duration_seconds: number | null;
  views: string | null;
  likes: string | null;
  comments: string | null;
  shares: string | null;
  music: string | null;
  published_at: Date | null;
  collected_at: Date;
}

const count = (value: string | null) => (value === null ? null : Number(value));

function toTrend(row: TrendRow, thumbnailUrl: string | null): Trend {
  return {
    id: row.id,
    query: row.query,
    platform: row.platform,
    externalId: row.external_id,
    url: row.url,
    author: row.author,
    caption: row.caption,
    thumbnailUrl,
    country: row.country,
    durationSeconds: row.duration_seconds,
    views: count(row.views),
    likes: count(row.likes),
    comments: count(row.comments),
    shares: count(row.shares),
    music: row.music,
    publishedAt: row.published_at?.toISOString() ?? null,
    collectedAt: row.collected_at.toISOString(),
  };
}

export type StoredTrend = TrendRow;

// Ritrovato dallo stesso brand, il video tiene la sua riga e la sua copertina: cambiano i numeri, la ricerca che l'ha
// trovato per ultima e quando.
export async function upsertTrend(db: Queryable, record: TrendRecord): Promise<{ id: string; thumbnailPath: string | null }> {
  const { rows } = await db.query<{ id: string; thumbnail_path: string | null }>(
    `insert into presenza.trend_videos (category, market, platform, external_id, url, author, caption, country, duration_seconds,
       views, likes, comments, shares, music, published_at, query, relevance, brand_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
     on conflict (brand_id, platform, external_id) do update set
       caption = excluded.caption, views = excluded.views, likes = excluded.likes, comments = excluded.comments,
       shares = excluded.shares, relevance = excluded.relevance, query = excluded.query, collected_at = now()
     returning id, thumbnail_path`,
    [
      record.category,
      record.market,
      record.platform,
      record.externalId,
      record.url,
      record.author,
      record.caption,
      record.country,
      record.durationSeconds,
      record.views,
      record.likes,
      record.comments,
      record.shares,
      record.music,
      record.publishedAt,
      record.query,
      record.relevance,
      record.brandId,
    ],
  );
  return { id: rows[0].id, thumbnailPath: rows[0].thumbnail_path };
}

export async function setTrendThumbnail(db: Queryable, id: string, path: string): Promise<void> {
  await db.query('update presenza.trend_videos set thumbnail_path = $2 where id = $1', [id, path]);
}

// I video delle ricerche più vecchie di keepDays giorni escono dalla tab.
export async function pruneTrends(db: Queryable, brandId: string, keepDays: number): Promise<number> {
  const { rowCount } = await db.query(
    'delete from presenza.trend_videos where brand_id = $1 and collected_at < now() - make_interval(days => $2)',
    [brandId, keepDays],
  );
  return rowCount ?? 0;
}

// Instagram nella ricerca non dà le visualizzazioni: sotto questi like un reel non è una tendenza e non si salva.
export const MIN_LIKES_INSTAGRAM = 50;
const ORDER = 'coalesce(views, likes * 30, 0) desc';

// I video delle ricerche del brand, i più visti per primi; su Instagram la ricerca non dà le visualizzazioni, allora
// contano i like (un like ogni ~30 viste).
export async function listTrends(db: Queryable, brandId: string, limit: number, sign: (path: string) => Promise<string | null>): Promise<Trend[]> {
  const { rows } = await db.query<TrendRow>(
    `select * from presenza.trend_videos where brand_id = $1 order by ${ORDER} limit $2`,
    [brandId, limit],
  );
  return Promise.all(rows.map(async (row) => toTrend(row, row.thumbnail_path ? await sign(row.thumbnail_path) : null)));
}

// Le parole cercate dal brand che hanno ancora video, la più recente per prima: i filtri della tab.
export async function listSearches(db: Queryable, brandId: string): Promise<TrendSearchSummary[]> {
  const { rows } = await db.query<{ query: string; count: string; last: Date }>(
    `select query, count(*) as count, max(collected_at) as last from presenza.trend_videos where brand_id = $1
     group by query order by last desc limit 12`,
    [brandId],
  );
  return rows.map((row) => ({ query: row.query, count: Number(row.count), searchedAt: row.last.toISOString() }));
}

// Il video da ricreare, solo se è del brand della conversazione.
export async function findTrend(db: Queryable, id: string, brandId: string): Promise<StoredTrend | null> {
  const { rows } = await db.query<TrendRow>('select * from presenza.trend_videos where id = $1 and brand_id = $2', [id, brandId]);
  return rows[0] ?? null;
}

// Ogni chiamata a SocialCrawl, con i crediti che è costata; le due di una ricerca hanno lo stesso searchId.
export interface TrendSearchLog {
  searchId: string;
  brandId: string;
  category: string;
  market: string;
  platform: TrendPlatform;
  query: string;
  results: number;
  credits: number;
  failed: boolean;
}

export async function logTrendSearch(db: Queryable, entry: TrendSearchLog): Promise<void> {
  await db.query(
    `insert into presenza.trend_searches (search_id, brand_id, category, market, platform, query, results, credits, failed)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [entry.searchId, entry.brandId, entry.category, entry.market, entry.platform, entry.query, entry.results, entry.credits, entry.failed],
  );
}

// Le ricerche del brand nelle ultime 24 ore; quelle fallite su tutti e due i social non contano.
export async function brandSearchesToday(db: Queryable, brandId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(distinct search_id) as n from presenza.trend_searches
     where brand_id = $1 and not failed and created_at > now() - interval '1 day'`,
    [brandId],
  );
  return Number(rows[0]?.n ?? 0);
}

// Le ricerche riuscite del brand nel mese in corso a Roma: le prime TREND_SEARCH.freePerMonth sono gratis.
export async function brandSearchesThisMonth(db: Queryable, brandId: string): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(distinct search_id) as n from presenza.trend_searches
     where brand_id = $1 and not failed
       and created_at >= date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'`,
    [brandId],
  );
  return Number(rows[0]?.n ?? 0);
}

// Una ricerca a pagamento: il movimento che scala i crediti dal piano del brand, uno per ricerca.
export async function chargeTrendSearch(db: Queryable, accountId: string, brandId: string, searchId: string, credits: number): Promise<void> {
  await db.query(
    `insert into presenza.credit_movements (account_id, brand_id, amount, kind, trend_search_id)
     values ($1, $2, $3, 'trends', $4) on conflict (trend_search_id) do nothing`,
    [accountId, brandId, -credits, searchId],
  );
}
