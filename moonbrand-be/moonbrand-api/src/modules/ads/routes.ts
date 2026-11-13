import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdAccountsResponse, AdConnectResponse, AdsResponse } from '@moonbrand/shared/api/contract';
import { SEARCH_LIMITS, type Ad, type AdDraft } from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { Config } from '../../config';
import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { canSimulate } from '../billing/trial';
import {
  chooseAdAccount,
  deleteConnection,
  findAd,
  findConnection,
  insertDraft,
  isSimulatedConnection,
  listAds,
  saveConnection,
  toAd,
  toConnection,
  updateDraft,
  type AdRow,
  type ConnectionRow,
} from './repository';
import { syncBrand, type AdsService } from './service';
import type { ZernioAds } from './zernio-ads';

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const adParams = brandParams.extend({ adId: z.uuid('Campagna non trovata.') });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida.');
const L = SEARCH_LIMITS;

// Toglie i doppioni senza badare a maiuscole e spazi, come fa Google.
const unique = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const text = (max: number, what: string) => z.string().trim().min(1).max(max, `${what}: al massimo ${max} caratteri.`);

export const draftSchema = z
  .object({
    name: text(L.name, 'Il nome'),
    spec: z.object({
      headlines: z.array(text(L.headlines.chars, 'Un titolo')).transform(unique).pipe(
        z.array(z.string()).min(L.headlines.min, `Servono almeno ${L.headlines.min} titoli diversi.`).max(L.headlines.max, `Al massimo ${L.headlines.max} titoli.`),
      ),
      descriptions: z.array(text(L.descriptions.chars, 'Una descrizione')).transform(unique).pipe(
        z
          .array(z.string())
          .min(L.descriptions.min, `Servono almeno ${L.descriptions.min} descrizioni diverse.`)
          .max(L.descriptions.max, `Al massimo ${L.descriptions.max} descrizioni.`),
      ),
      keywords: z
        .array(z.object({ text: text(L.keywords.chars, 'Una parola chiave'), match: z.enum(['broad', 'phrase', 'exact']).default('phrase') }))
        .min(L.keywords.min, 'Aggiungi almeno una parola chiave.')
        .max(L.keywords.max, `Al massimo ${L.keywords.max} parole chiave.`),
      linkUrl: z.url({ protocol: /^https?$/, error: 'Il link deve essere un indirizzo web completo, es. https://www.tuosito.it' }).max(2000),
      countries: z.array(z.string().regex(/^[A-Z]{2}$/, 'Paese non valido.')).min(1, 'Scegli almeno un paese.').max(20),
      languages: z.array(z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Lingua non valida.')).min(1, 'Scegli almeno una lingua.').max(10),
    }),
    dailyBudget: z.number().int('Il budget è in euro interi.').min(L.dailyBudget.min, `Almeno ${L.dailyBudget.min} al giorno.`).max(L.dailyBudget.max, `Al massimo ${L.dailyBudget.max} al giorno.`),
    startsOn: day,
    endsOn: day.nullable(),
  })
  .refine((draft) => !draft.endsOn || draft.endsOn >= draft.startsOn, { message: 'La fine viene prima dell’inizio.' })
  .refine((draft) => !draft.endsOn || (Date.parse(draft.endsOn) - Date.parse(draft.startsOn)) / 86_400_000 < L.days, {
    message: `Al massimo ${L.days} giorni: oltre lasciala senza fine.`,
  }) satisfies z.ZodType<AdDraft, unknown>;

const connectSchema = z.object({ redirectUrl: z.url({ protocol: /^https?$/, error: 'Indirizzo di ritorno non valido.' }) });
const confirmSchema = z.object({ accountId: z.string().trim().min(1).max(100) });
const accountSchema = z.object({ adAccountId: z.string().trim().min(1).max(40) });

// La sezione Campagne: il collegamento Google Ads del brand e le sue campagne (PIANO-ADS.md §0). Tutto con l'identità
// della persona; la spesa non passa da noi, la addebita Google sul suo account.
export function registerAdsRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  ads: AdsService,
  client: () => ZernioAds,
  settings: Pick<Config, 'STUDIO_ORIGINS' | 'SIMULATE_SOCIAL'>,
): void {
  const origins = (settings.STUDIO_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const run = <T>(identity: Identity, fn: (db: Queryable) => Promise<T>) => withIdentity(pool, identity, fn);

  const own = async (identity: Identity, brandId: string) => {
    const { rows } = await run(identity, (db) =>
      db.query<{ site: string | null; language: string | null }>(
        "select identity ->> 'site' as site, identity ->> 'language' as language from presenza.brands where id = $1",
        [brandId],
      ),
    );
    if (!rows[0]) throw ApiError.notFound('Brand non trovato.');
    return rows[0];
  };
  // Il sito del brand come link: con https davanti se manca.
  const siteUrl = (site: string | null) => {
    const value = site?.trim() ?? '';
    if (!value) return '';
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  };
  const adOf = async (identity: Identity, brandId: string, adId: string): Promise<AdRow> => {
    const row = await run(identity, (db) => findAd(db, brandId, adId));
    if (!row) throw ApiError.notFound('Campagna non trovata.');
    return row;
  };
  const connectionOf = async (identity: Identity, brandId: string): Promise<ConnectionRow> => {
    const row = await run(identity, (db) => findConnection(db, brandId, 'google'));
    if (!row) throw ApiError.invalid('Collega prima Google Ads.');
    return row;
  };

  // Dopo il collegamento si leggono gli account Google Ads: se ce n'è uno solo usabile si sceglie da solo.
  const withAccounts = async (identity: Identity, connection: ConnectionRow): Promise<AdAccountsResponse> => {
    if (isSimulatedConnection(connection)) {
      const simulated = { id: '1234567890', name: 'Account di prova', currency: 'EUR', status: 'ENABLED', selected: true };
      const chosen = connection.ad_account_id ? connection : await run(identity, (db) => chooseAdAccount(db, connection.id, simulated));
      return { connection: toConnection(chosen), accounts: [simulated] };
    }
    const accounts = await client().adAccounts(connection.zernio_account_id);
    const usable = accounts.filter((account) => account.selected && account.status?.toUpperCase() !== 'CLOSED');
    if (!connection.ad_account_id && usable.length === 1) {
      const chosen = await run(identity, (db) => chooseAdAccount(db, connection.id, usable[0]!));
      return { connection: toConnection(chosen), accounts };
    }
    return { connection: toConnection(connection), accounts };
  };

  app.get('/v1/brands/:brandId/ads', async (request): Promise<AdsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const brand = await own(request.identity, brandId);
    // Le campagne vive non lette da qualche minuto si rileggono adesso, così i numeri sono freschi.
    await run(request.identity, (db) => syncBrand(db, ads, brandId, request.log));
    const [connection, rows] = await run(request.identity, (db) => Promise.all([findConnection(db, brandId, 'google'), listAds(db, brandId)]));
    return {
      connection: connection ? toConnection(connection) : null,
      ads: rows.map(toAd),
      simulation: await canSimulate(pool, settings.SIMULATE_SOCIAL, request.identity.accountId, brandId),
      defaults: { linkUrl: siteUrl(brand.site), language: brand.language ?? 'it' },
    };
  });

  // Collega: la pagina di consenso di Google. Se il profilo Zernio del brand ha già Google Ads, si salva subito.
  app.post('/v1/brands/:brandId/ads/google/connect', async (request): Promise<AdConnectResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { redirectUrl } = connectSchema.parse(request.body);
    if (origins.length > 0 && !origins.includes(new URL(redirectUrl).origin)) throw ApiError.invalid('Indirizzo di ritorno non valido.');
    await own(request.identity, brandId);
    const result = await client().connectGoogle(brandId, redirectUrl);
    if ('authUrl' in result) return { authUrl: result.authUrl, connection: null };
    const saved = await run(request.identity, (db) =>
      saveConnection(db, { accountId: request.identity.accountId, brandId, platform: 'google', zernioAccountId: result.accountId, name: result.name }),
    );
    return { authUrl: null, connection: (await withAccounts(request.identity, saved)).connection };
  });

  // Il ritorno da Google: l'account deve essere davvero nel profilo del brand.
  app.post('/v1/brands/:brandId/ads/google/confirm', async (request): Promise<AdAccountsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { accountId } = confirmSchema.parse(request.body);
    await own(request.identity, brandId);
    const account = await client().googleAccount(brandId, accountId);
    if (!account) throw ApiError.invalid('Il collegamento di Google Ads non è andato a buon fine: riprova.');
    const saved = await run(request.identity, (db) =>
      saveConnection(db, { accountId: request.identity.accountId, brandId, platform: 'google', zernioAccountId: account.accountId, name: account.name }),
    );
    return withAccounts(request.identity, saved);
  });

  app.post('/v1/brands/:brandId/ads/google/simulate', async (request): Promise<AdAccountsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    await own(request.identity, brandId);
    if (!(await canSimulate(pool, settings.SIMULATE_SOCIAL, request.identity.accountId, brandId))) {
      throw ApiError.forbidden('SIMULATION_OFF', 'Il collegamento simulato è solo per la prova gratuita: collega Google Ads per davvero.');
    }
    const saved = await run(request.identity, (db) =>
      saveConnection(db, { accountId: request.identity.accountId, brandId, platform: 'google', zernioAccountId: `${SIMULATED_ACCOUNT}googleads`, name: 'Google Ads di prova' }),
    );
    return withAccounts(request.identity, saved);
  });

  app.get('/v1/brands/:brandId/ads/google/accounts', async (request): Promise<AdAccountsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    return withAccounts(request.identity, await connectionOf(request.identity, brandId));
  });

  app.post('/v1/brands/:brandId/ads/google/account', async (request): Promise<AdAccountsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { adAccountId } = accountSchema.parse(request.body);
    const connection = await connectionOf(request.identity, brandId);
    const { accounts } = await withAccounts(request.identity, connection);
    const chosen = accounts.find((account) => account.id === adAccountId);
    if (!chosen) throw ApiError.invalid('Account Google Ads non trovato: ricollega Google Ads.');
    if (!chosen.selected) throw ApiError.invalid('Questo account non è tra quelli collegati: ricollega Google Ads e sceglilo.');
    const saved = await run(request.identity, (db) => chooseAdAccount(db, connection.id, chosen));
    return { connection: toConnection(saved), accounts };
  });

  // Scollega: le campagne su Google restano come sono (si fermano da Google Ads); qui non si gestiscono più.
  app.delete('/v1/brands/:brandId/ads/google', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const connection = await connectionOf(request.identity, brandId);
    if (!isSimulatedConnection(connection)) await client().disconnect(connection.zernio_account_id);
    await run(request.identity, (db) => deleteConnection(db, connection.id));
    return reply.code(204).send();
  });

  app.post('/v1/brands/:brandId/ads', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const draft = draftSchema.parse(request.body);
    await own(request.identity, brandId);
    const row = await run(request.identity, (db) => insertDraft(db, { accountId: request.identity.accountId, brandId }, draft, 'studio'));
    return reply.code(201).send(toAd(row));
  });

  app.put('/v1/brands/:brandId/ads/:adId', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const draft = draftSchema.parse(request.body);
    const row = await adOf(request.identity, brandId, adId);
    if (row.status !== 'draft' && row.status !== 'failed') throw ApiError.conflict('AD_NOT_DRAFT', 'La campagna è già su Google: si può mettere in pausa o eliminare.');
    return toAd(await run(request.identity, (db) => updateDraft(db, adId, draft)));
  });

  // Avvia: da qui si spendono soldi veri, solo con il pulsante della persona (mai dalla chat).
  app.post('/v1/brands/:brandId/ads/:adId/launch', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const row = await adOf(request.identity, brandId, adId);
    return toAd(await run(request.identity, (db) => ads.launch(db, row)));
  });

  app.post('/v1/brands/:brandId/ads/:adId/pause', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const row = await adOf(request.identity, brandId, adId);
    return toAd(await run(request.identity, (db) => ads.pause(db, row)));
  });

  app.post('/v1/brands/:brandId/ads/:adId/resume', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const row = await adOf(request.identity, brandId, adId);
    return toAd(await run(request.identity, (db) => ads.resume(db, row)));
  });

  app.delete('/v1/brands/:brandId/ads/:adId', async (request, reply) => {
    const { brandId, adId } = adParams.parse(request.params);
    const row = await adOf(request.identity, brandId, adId);
    await run(request.identity, (db) => ads.remove(db, row));
    return reply.code(204).send();
  });
}
