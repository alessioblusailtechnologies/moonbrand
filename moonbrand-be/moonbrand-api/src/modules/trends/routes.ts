import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { TrendSearchResponse, TrendsResponse } from '@moonbrand/shared/api/contract';
import { TREND_SEARCH } from '@moonbrand/shared/domain/trend';
import { matchLocale } from '@moonbrand/shared/i18n/locales';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { findBrandForIdeas } from '../ideas/repository';
import type { MediaStorage } from '../media/storage';
import { brandSearchesThisMonth, brandSearchesToday, listSearches, listTrends } from './repository';
import { SEARCHES_PER_DAY, searchTrends, type TrendBrand } from './search';
import type { SocialCrawl } from './socialcrawl';

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const searchBody = z.object({ query: z.string().trim().min(2, 'Scrivi almeno due lettere.').max(80, 'Al massimo 80 caratteri.') });

const LIST_LIMIT = 120;

// La tab Tendenze del brand: i video delle sue ricerche, le parole cercate e le ricerche che restano oggi.
export function registerTrendRoutes(app: FastifyInstance, pool: pg.Pool, storage: MediaStorage, crawl: SocialCrawl | null): void {
  const sign = (path: string) => storage.sign(path).catch(() => null);

  // Il brand deve essere dell'utente: si legge con la sua identità.
  const brandOf = async (identity: Identity, brandId: string): Promise<TrendBrand> => {
    const brand = await withIdentity(pool, identity, (db) => findBrandForIdeas(db, brandId));
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const { category, language } = brand.context.identity;
    return { id: brandId, accountId: identity.accountId, category: category ?? '', market: matchLocale(language) ?? 'it' };
  };

  const tab = async (db: Queryable, brand: TrendBrand): Promise<TrendsResponse> => {
    const [searches, trends, today, month] = await Promise.all([
      listSearches(db, brand.id),
      listTrends(db, brand.id, LIST_LIMIT, sign),
      brandSearchesToday(pool, brand.id),
      brandSearchesThisMonth(pool, brand.id),
    ]);
    return {
      market: brand.market,
      searches,
      trends,
      free: Math.max(0, TREND_SEARCH.freePerMonth - month),
      left: Math.max(0, SEARCHES_PER_DAY - today),
    };
  };

  app.get('/v1/brands/:brandId/trends', async (request): Promise<TrendsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const brand = await brandOf(request.identity, brandId);
    return withIdentity(pool, request.identity, (db) => tab(db, brand));
  });

  // La ricerca fuori dalla transazione: SocialCrawl ci mette fino a qualche decina di secondi.
  app.post('/v1/brands/:brandId/trends/search', async (request): Promise<TrendSearchResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { query } = searchBody.parse(request.body);
    const brand = await brandOf(request.identity, brandId);
    await searchTrends(pool, storage, crawl, brand, query, request.log);
    return { query, ...(await withIdentity(pool, request.identity, (db) => tab(db, brand))) };
  });
}
