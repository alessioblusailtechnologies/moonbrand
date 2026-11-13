import { randomUUID } from 'node:crypto';

import type pg from 'pg';

import { instagramCode, TREND_COUNTRIES, TREND_SEARCH, type TrendMarket, type TrendPlatform } from '@moonbrand/shared/domain/trend';

import { ApiError } from '../../errors';
import { assertCanSpend } from '../credits/balance';
import type { MediaStorage } from '../media/storage';
import { brandSearchesThisMonth, brandSearchesToday, chargeTrendSearch, logTrendSearch, MIN_LIKES_INSTAGRAM, pruneTrends, setTrendThumbnail, upsertTrend, type TrendRecord } from './repository';
import { SocialCrawlError, type SocialCrawl, type SocialRow } from './socialcrawl';

// Le tendenze sono le ricerche dell'utente: una parola chiave, cercata su TikTok e Instagram nel mercato del brand (il
// paese della lingua dei post, più Stati Uniti e Regno Unito). Niente giro automatico: si paga solo quello che qualcuno
// cerca. Ogni chiamata e i suoi crediti vanno in presenza.trend_searches, e le due di una ricerca hanno lo stesso
// search_id: così si sa quanto costa una ricerca. Le prime del mese sono gratis, le altre scalano crediti (TREND_SEARCH).
export const SEARCHES_PER_DAY = TREND_SEARCH.perDay;
// Le ricerche più vecchie escono dalla tab.
const KEEP_DAYS = 21;
// Su TikTok sotto queste visualizzazioni un video non è una tendenza; si guarda indietro di tre mesi perché nei paesi
// piccoli i video sono pochi.
const MIN_VIEWS = 300;
// relevant_to accetta al massimo 200 caratteri.
const ABOUT_MAX = 200;

export interface TrendBrand {
  id: string;
  accountId: string;
  category: string;
  market: TrendMarket;
}

export interface TrendLog {
  warn(data: object, text: string): void;
}

function recordOf(brand: TrendBrand, platform: TrendPlatform, query: string, row: SocialRow): TrendRecord | null {
  const { post } = row;
  const externalId = platform === 'tiktok' ? post.id : instagramCode(post.url);
  if (!externalId || !post.url) return null;
  if (platform === 'instagram' && (post.engagement?.likes ?? 0) < MIN_LIKES_INSTAGRAM) return null;
  const music = post.ext?.music_title && !post.ext.music_is_original ? [post.ext.music_title, post.ext.music_artist].filter(Boolean).join(' · ') : null;
  return {
    category: brand.category,
    market: brand.market,
    platform,
    externalId,
    url: post.url,
    author: post.author?.username ?? '',
    caption: (post.content.text ?? '').slice(0, 2000),
    country: post.ext?.region ?? null,
    durationSeconds: post.content.duration_seconds || null,
    views: post.engagement?.views ?? null,
    likes: post.engagement?.likes ?? null,
    comments: post.engagement?.comments ?? null,
    shares: post.engagement?.shares ?? null,
    music,
    publishedAt: post.published_at ?? null,
    query,
    relevance: row.computed?.relevance?.p ?? null,
    brandId: brand.id,
  };
}

// Le parole dell'utente fanno anche da filtro di pertinenza: via i video che hanno solo l'hashtag in comune.
async function crawlSearch(crawl: SocialCrawl, platform: TrendPlatform, market: TrendMarket, query: string) {
  const common = { query, relevance: 'filter', relevant_to: query.slice(0, ABOUT_MAX) };
  const { data, credits } =
    platform === 'tiktok'
      ? await crawl.get<{ items: SocialRow[] }>('tiktok/search', {
          ...common,
          date_posted: 'last-3-months',
          limit: 30,
          country: TREND_COUNTRIES[market].join(','),
          min_views: MIN_VIEWS,
          sort_rows: 'views',
        })
      : await crawl.get<{ items: SocialRow[] }>('instagram/search/reels', { ...common, date_posted: 'last-month' });
  return { rows: data.items ?? [], credits };
}

// La copertina va sul nostro Storage: quelle dei social sono link firmati che scadono. Se non si scarica, la card mostra
// la didascalia.
async function saveThumbnail(storage: MediaStorage, platform: TrendPlatform, externalId: string, url: string): Promise<string | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
  if (!response?.ok) return null;
  const path = `trends/${platform}/${externalId}.jpg`;
  const bytes = new Uint8Array(await response.arrayBuffer());
  await storage.upload(path, bytes, response.headers.get('content-type') ?? 'image/jpeg').catch((error: unknown) => {
    // Già caricata da una ricerca di prima (upsert spento): va bene così.
    if (!String(error).includes('exists')) throw error;
  });
  return path;
}

// Una chiamata: i video salvati con la copertina e la riga con i crediti. Se SocialCrawl fallisce la riga resta
// (failed) e l'errore sale.
async function searchOn(
  pool: pg.Pool,
  storage: MediaStorage,
  crawl: SocialCrawl,
  brand: TrendBrand,
  searchId: string,
  platform: TrendPlatform,
  query: string,
): Promise<void> {
  const entry = { searchId, brandId: brand.id, category: brand.category, market: brand.market, platform, query };
  let found: { rows: SocialRow[]; credits: number };
  try {
    found = await crawlSearch(crawl, platform, brand.market, query);
  } catch (error) {
    await logTrendSearch(pool, { ...entry, results: 0, credits: 0, failed: true }).catch(() => undefined);
    throw error;
  }
  let saved = 0;
  for (const row of found.rows) {
    const record = recordOf(brand, platform, query, row);
    if (!record) continue;
    const { id, thumbnailPath } = await upsertTrend(pool, record);
    saved += 1;
    const thumbnail = row.post.content.thumbnail_url;
    if (!thumbnailPath && thumbnail) {
      const path = await saveThumbnail(storage, platform, record.externalId, thumbnail).catch(() => null);
      if (path) await setTrendThumbnail(pool, id, path);
    }
  }
  await logTrendSearch(pool, { ...entry, results: saved, credits: found.credits, failed: false }).catch(() => undefined);
}

// La ricerca dalla tab: le due chiamate insieme; la tab si rilegge dopo (routes.ts).
export async function searchTrends(
  pool: pg.Pool,
  storage: MediaStorage,
  crawl: SocialCrawl | null,
  brand: TrendBrand,
  query: string,
  log: TrendLog,
): Promise<void> {
  if (!crawl) throw new ApiError(503, 'TRENDS_OFF', 'La ricerca delle tendenze non è attiva.');
  if ((await brandSearchesToday(pool, brand.id)) >= SEARCHES_PER_DAY) {
    throw new ApiError(429, 'TOO_MANY_SEARCHES', `Hai fatto ${SEARCHES_PER_DAY} ricerche nelle ultime 24 ore: riprova domani.`);
  }
  // Finite quelle gratis del mese, la ricerca si paga: si ferma prima se il brand non ha un piano o ha finito i crediti.
  const paid = (await brandSearchesThisMonth(pool, brand.id)) >= TREND_SEARCH.freePerMonth;
  if (paid) await assertCanSpend(pool, brand.accountId, brand.id);
  const searchId = randomUUID();
  const platforms: TrendPlatform[] = ['tiktok', 'instagram'];
  const results = await Promise.allSettled(platforms.map((platform) => searchOn(pool, storage, crawl, brand, searchId, platform, query)));
  results.forEach((result, index) => {
    if (result.status === 'rejected') log.warn({ err: result.reason, platform: platforms[index], query }, 'ricerca delle tendenze non riuscita');
  });
  if (results.every((result) => result.status === 'rejected')) {
    // Crediti SocialCrawl finiti: è un problema nostro, riprovare non serve finché non si ricarica.
    const noCredits = results.some((result) => result.status === 'rejected' && result.reason instanceof SocialCrawlError && result.reason.status === 402);
    if (noCredits) throw new ApiError(503, 'TRENDS_UNAVAILABLE', 'La ricerca delle tendenze al momento non è disponibile.');
    throw new ApiError(502, 'TRENDS_FAILED', 'La ricerca non è riuscita: riprova tra poco.');
  }
  // Basta un social riuscito perché la ricerca conti, e si paghi se non è più tra quelle gratis.
  if (paid) await chargeTrendSearch(pool, brand.accountId, brand.id, searchId, TREND_SEARCH.credits);
  await pruneTrends(pool, brand.id, KEEP_DAYS);
}
