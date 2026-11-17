import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type {
  AdAccountInfoResponse,
  AdAccountsResponse,
  AdAudiencesResponse,
  AdConnectResponse,
  AdConversionsResponse,
  AdExtensionsResponse,
  AdImagesResponse,
  AdInsightsResponse,
  AdInterestsResponse,
  AdKeywordIdeasResponse,
  AdKeywordsResponse,
  AdLocationsResponse,
  AdRecommendationsActionResponse,
  AdRecommendationsResponse,
  AdsResponse,
  AdSearchTermsResponse,
  AdStepJobInput,
} from '@moonbrand/shared/api/contract';
import {
  AD_BID_STRATEGIES,
  AD_CAMPAIGN_TYPES,
  AD_DEVICES,
  AD_IMAGES,
  AD_LIMITS,
  AD_STEPS,
  adLocations,
  CONVERSION_TYPES,
  DEMAND_GEN_CHANNELS,
  SNIPPET_HEADERS,
  type Ad,
  type AdCampaignType,
  type AdDevice,
  type AdDraft,
  type DemandGenChannel,
  type AdImageRole,
  type AdKeyword,
  type AdLocation,
  type AdSpec,
} from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { Config } from '../../config';
import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { insertJob } from '../ai/repository';
import { canSimulate } from '../billing/trial';
import type { BrandFiles } from '../brand-files/files';
import { uploadSchema } from '../media/routes';
import { adImageOptions, uploadAdImage } from './ad-images';
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
import { syncBrand, today, type AdsService, type LiveCampaign } from './service';
import { locationType, type AdsAccountRef, type ZernioAds } from './zernio-ads';

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const adParams = brandParams.extend({ adId: z.uuid('Campagna non trovata.') });
const keywordParams = adParams.extend({ keywordId: z.string().min(1).max(200) });
const audienceParams = brandParams.extend({ audienceId: z.string().min(1).max(200) });
const invitationParams = brandParams.extend({ invitationId: z.string().min(1).max(200) });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data non valida.');
const L = AD_LIMITS;

// L'id della lingua di Google per il Keyword Planner.
const LANGUAGE_CONSTANTS: Record<string, number> = { en: 1000, de: 1001, fr: 1002, es: 1003, it: 1004, nl: 1010, pt: 1014 };

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
const url = z.url({ protocol: /^https?$/, error: 'Il link deve essere un indirizzo web completo, es. https://www.tuosito.it' }).max(2000);
const keyword = z.object({ text: text(L.keywords.chars, 'Una parola chiave'), match: z.enum(['broad', 'phrase', 'exact']).default('phrase') });
const location = z.object({
  id: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  type: z.enum(['country', 'region', 'city', 'zip', 'metro']),
  path: z.string().max(300).optional(),
});
const radius = z.object({
  label: z.string().max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(1).max(500),
  unit: z.enum(['km', 'mi']),
});
const ref = z.object({ id: z.string().trim().min(1).max(100), name: z.string().trim().max(300) });
const bidding = z
  .object({
    strategy: z.enum(['auto', 'max_clicks', 'max_conversions', 'target_cpa', 'target_roas', 'manual_cpc']),
    amount: z.number().positive('L’importo dell’offerta deve essere maggiore di zero.').max(10000).nullable().optional(),
    roas: z.number().positive('Il ritorno sulla spesa deve essere maggiore di zero.').max(1000).nullable().optional(),
  })
  .refine((b) => !['max_clicks', 'target_cpa', 'manual_cpc'].includes(b.strategy) || (b.amount ?? 0) > 0, { message: 'Scrivi l’importo dell’offerta.' })
  .refine((b) => b.strategy !== 'target_roas' || (b.roas ?? 0) > 0, { message: 'Scrivi il ritorno sulla spesa che vuoi.' });
const network = z.object({ searchPartners: z.boolean(), displayNetwork: z.boolean() });
const tracking = {
  trackingUrlTemplate: z
    .string()
    .trim()
    .max(2000)
    .refine((value) => !value || value.includes('{lpurl}'), 'Il modello di monitoraggio deve contenere {lpurl}.')
    .optional(),
  finalUrlSuffix: z.string().trim().max(2000).optional(),
};
const images = z.object({
  landscape: z.array(z.string().max(500)).max(20).default([]),
  square: z.array(z.string().max(500)).max(20).default([]),
  portrait: z.array(z.string().max(500)).max(20).default([]),
  logo: z.array(z.string().max(500)).max(5).default([]),
});
const youtube = z.array(z.string().trim().regex(/^[\w-]{11}$/, 'Video YouTube non valido.')).max(L.youtube.max);
const pins = (max: number) => z.array(z.number().int().min(1).max(max).nullable()).optional();

const spec = z.object({
  linkUrl: url,
  headlines: z.array(z.string().trim().max(200)).transform((items) => unique(items.filter(Boolean))),
  headlinePins: pins(3),
  descriptions: z.array(z.string().trim().max(300)).transform((items) => unique(items.filter(Boolean))),
  descriptionPins: pins(2),
  longHeadlines: z.array(z.string().trim().max(L.pmax.longHeadlines.chars, `Un titolo lungo: al massimo ${L.pmax.longHeadlines.chars} caratteri.`)).transform((items) => unique(items.filter(Boolean))).optional(),
  businessName: z.string().trim().max(L.businessName, `Il nome dell’attività: al massimo ${L.businessName} caratteri.`).optional(),
  images: images.optional(),
  youtubeVideoIds: youtube.optional(),
  callToAction: z.string().trim().max(30).nullable().optional(),
  carouselCards: z.array(z.object({ headline: text(40, 'Il titolo di una scheda'), image: z.string().max(500), finalUrl: url.optional() })).max(L.carousel.max).optional(),
  keywords: z.array(keyword).max(L.keywords.max, `Al massimo ${L.keywords.max} parole chiave.`).default([]),
  negativeKeywords: z.array(keyword).max(L.negativeKeywords.max).optional(),
  sitelinks: z
    .array(
      z.object({
        text: text(L.sitelinks.text, 'Il testo di un sitelink'),
        linkUrl: url,
        description1: z.string().trim().max(L.sitelinks.description, `Una riga di sitelink: al massimo ${L.sitelinks.description} caratteri.`).optional(),
        description2: z.string().trim().max(L.sitelinks.description, `Una riga di sitelink: al massimo ${L.sitelinks.description} caratteri.`).optional(),
      }),
    )
    .max(L.sitelinks.max)
    .optional(),
  callouts: z.array(text(L.callouts.chars, 'Un callout')).max(L.callouts.max).optional(),
  snippet: z
    .object({
      header: z.enum(SNIPPET_HEADERS),
      values: z.array(text(L.snippetValues.chars, 'Un valore dello snippet')).min(L.snippetValues.min, `Lo snippet vuole almeno ${L.snippetValues.min} valori.`).max(L.snippetValues.max),
    })
    .nullable()
    .optional(),
  network: network.optional(),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/, 'Paese non valido.')).max(50).default([]),
  locations: z.array(location).max(200).optional(),
  excludedLocations: z.array(location).max(200).optional(),
  radius: z.array(radius).max(20).optional(),
  presenceOnly: z.boolean().optional(),
  languages: z.array(z.string().regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Lingua non valida.')).min(1, 'Scegli almeno una lingua.').max(20),
  ageMin: z.number().int().min(18).max(65).nullable().optional(),
  ageMax: z.number().int().min(18).max(65).nullable().optional(),
  ageRanges: z.array(z.object({ min: z.number().int().min(18).max(65), max: z.number().int().max(64).nullable() })).max(6).optional(),
  genders: z.array(z.enum(['male', 'female'])).max(2).optional(),
  incomeTop10: z.boolean().optional(),
  interests: z.array(ref).max(20).optional(),
  audiences: z.array(ref).max(20).optional(),
  excludedAudiences: z.array(ref).max(20).optional(),
  devices: z.array(z.enum(AD_DEVICES as [AdDevice, ...AdDevice[]])).max(4).optional(),
  channels: z.array(z.enum(DEMAND_GEN_CHANNELS as [DemandGenChannel, ...DemandGenChannel[]])).max(6).optional(),
  bidding: bidding.optional(),
  ...tracking,
});

// I limiti di Google per tipo: titoli, descrizioni, immagini, parole chiave e offerte.
function checkType(draft: { campaignType: AdCampaignType; spec: z.infer<typeof spec> }, ctx: z.RefinementCtx) {
  const { campaignType: type, spec: s } = draft;
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  const limits = L[type];
  const count = (items: string[], rule: { min: number; max: number; chars: number }, what: string) => {
    if (items.length < rule.min) issue(`Servono almeno ${rule.min} ${what} diversi.`);
    if (items.length > rule.max) issue(`Al massimo ${rule.max} ${what}.`);
    if (items.some((item) => item.length > rule.chars)) issue(`${what[0]!.toUpperCase()}${what.slice(1)}: al massimo ${rule.chars} caratteri l’uno.`);
  };
  count(s.headlines, limits.headlines, 'titoli');
  count(s.descriptions, limits.descriptions, 'descrizioni');
  if (type !== 'search') count(s.longHeadlines ?? [], limits.longHeadlines, 'titoli lunghi');
  if (type !== 'search' && !s.businessName) issue('Scrivi il nome dell’attività.');
  if (type === 'search' && s.keywords.length < L.keywords.min) issue('Aggiungi almeno una parola chiave.');
  if (adLocations(s).length === 0) issue('Scegli almeno un luogo.');
  const carousel = type === 'demand_gen' && (s.carouselCards?.length ?? 0) > 0;
  if (carousel && (s.carouselCards!.length < L.carousel.min)) issue(`Il carosello vuole almeno ${L.carousel.min} schede.`);
  const rules = AD_IMAGES[type];
  for (const role of Object.keys(rules) as AdImageRole[]) {
    const rule = rules[role]!;
    const chosen = s.images?.[role]?.length ?? 0;
    if (carousel && role !== 'logo') continue;
    if (chosen < rule.min) issue(`Manca un’immagine: ${ROLE_NAMES[role]}.`);
    if (chosen > rule.max) issue(`Troppe immagini: ${ROLE_NAMES[role]} al massimo ${rule.max}.`);
  }
  if (type === 'demand_gen' && !carousel && !(s.youtubeVideoIds?.length) && !(s.images?.landscape?.length || s.images?.square?.length || s.images?.portrait?.length)) {
    issue('Aggiungi almeno un’immagine o un video di YouTube.');
  }
  if (type === 'demand_gen' && s.youtubeVideoIds?.length && !(s.longHeadlines?.length)) issue('Gli annunci video vogliono almeno un titolo lungo.');
  if (s.bidding && !AD_BID_STRATEGIES[type].includes(s.bidding.strategy)) issue('Questa offerta non c’è per questo tipo di campagna.');
  if (s.ageMin && s.ageMax && s.ageMax < s.ageMin) issue('L’età massima viene prima della minima.');
}
const ROLE_NAMES: Record<AdImageRole, string> = { landscape: 'orizzontale', square: 'quadrata', portrait: 'verticale', logo: 'logo' };

export const draftSchema = z
  .object({
    name: text(L.name, 'Il nome'),
    campaignType: z.enum(AD_CAMPAIGN_TYPES as [AdCampaignType, ...AdCampaignType[]]).default('search'),
    goal: z.enum(['traffic', 'awareness', 'engagement']).default('traffic'),
    spec,
    dailyBudget: z
      .number()
      .int('Il budget è in unità intere.')
      .min(L.dailyBudget.min, `Almeno ${L.dailyBudget.min} al giorno.`)
      .max(L.dailyBudget.max, `Al massimo ${L.dailyBudget.max} al giorno.`),
    startsOn: day,
    endsOn: day.nullable(),
  })
  .superRefine(checkType)
  .refine((draft) => !draft.endsOn || draft.endsOn >= draft.startsOn, { message: 'La fine viene prima dell’inizio.' })
  .refine((draft) => !draft.endsOn || (Date.parse(draft.endsOn) - Date.parse(draft.startsOn)) / 86_400_000 < L.days, {
    message: `Al massimo ${L.days} giorni: oltre lasciala senza fine.`,
  });

// La bozza mentre si compila nel wizard: si controlla solo la forma grossa, i limiti valgono al salvataggio.
const assistSchema = z.object({
  step: z.enum(AD_STEPS),
  instruction: z.string().trim().min(1, 'Scrivi cosa vuoi.').max(2000),
  draft: z
    .object({
      name: z.string().max(200).optional(),
      campaignType: z.enum(AD_CAMPAIGN_TYPES as [AdCampaignType, ...AdCampaignType[]]).optional(),
      goal: z.enum(['traffic', 'awareness', 'engagement']).optional(),
      spec: z.record(z.string(), z.unknown()).optional(),
      dailyBudget: z.number().nullable().optional(),
      startsOn: z.string().max(10).optional(),
      endsOn: z.string().max(10).nullable().optional(),
    })
    .refine((draft) => JSON.stringify(draft).length < 60_000, 'La campagna è troppo lunga.')
    .default({}),
});

const connectSchema = z.object({ redirectUrl: z.url({ protocol: /^https?$/, error: 'Indirizzo di ritorno non valido.' }) });
const confirmSchema = z.object({ accountId: z.string().trim().min(1).max(100) });
const accountSchema = z.object({ adAccountId: z.string().trim().min(1).max(40) });
const searchQuery = z.object({ q: z.string().trim().min(1, 'Scrivi cosa cercare.').max(100) });
const rangeQuery = z.object({ from: day.optional(), to: day.optional() });
const ideasSchema = z.object({
  seedKeywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  seedUrl: url.optional().or(z.literal('').transform(() => undefined)),
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)).max(10).default([]),
  language: z.string().max(10).default('it'),
});
const settingsSchema = z.object({
  dailyBudget: z.number().int().min(L.dailyBudget.min).max(L.dailyBudget.max).optional(),
  endsOn: day.nullable().optional(),
  bidding: bidding.optional(),
  network: network.optional(),
  ...tracking,
});
const creativeSchema = z.object({
  headlines: spec.shape.headlines.optional(),
  headlinePins: spec.shape.headlinePins,
  descriptions: spec.shape.descriptions.optional(),
  descriptionPins: spec.shape.descriptionPins,
  longHeadlines: spec.shape.longHeadlines,
  businessName: spec.shape.businessName,
  linkUrl: url.optional(),
  images: images.optional(),
  youtubeVideoIds: youtube.optional(),
  callToAction: spec.shape.callToAction,
});
const targetingSchema = z.object({
  locations: z.array(location).min(1, 'Scegli almeno un luogo.').max(200).optional(),
  excludedLocations: z.array(location).max(200).optional(),
  radius: z.array(radius).max(20).optional(),
  languages: spec.shape.languages.optional(),
  devices: spec.shape.devices,
  presenceOnly: z.boolean().optional(),
});
const keywordsAddSchema = z.object({ keywords: z.array(keyword).min(1).max(200), negative: z.boolean().default(false) });
const keywordStatusSchema = z.object({ status: z.enum(['active', 'paused']) });
const negativesSchema = z.object({ negatives: z.array(keyword).max(L.negativeKeywords.max) });
const extensionsAddSchema = z.object({
  sitelinks: spec.shape.sitelinks,
  callouts: spec.shape.callouts,
  snippets: z.array(spec.shape.snippet.unwrap().unwrap()).max(5).optional(),
});
const resourcesSchema = z.object({ resources: z.array(z.string().min(1).max(300)).min(1).max(100) });
const audienceSchema = z.object({
  type: z.enum(['customer_list', 'website', 'lookalike']),
  name: text(200, 'Il nome'),
  description: z.string().trim().max(500).optional(),
  retentionDays: z.number().int().min(1).max(540).optional(),
  urlContains: z.string().trim().max(300).optional(),
  sourceAudienceId: z.string().max(200).optional(),
  size: z.enum(['narrow', 'balanced', 'broad']).optional(),
});
const usersSchema = z.object({ emails: z.array(z.string().trim().toLowerCase().max(320)).min(1).max(10_000) });
const conversionSchema = z.object({ name: text(100, 'Il nome'), type: z.enum(CONVERSION_TYPES), primary: z.boolean().default(true) });
const goalSchema = z.object({ category: z.string().min(1).max(100), origin: z.string().min(1).max(100), biddable: z.boolean() });
const invitationSchema = z.object({
  email: z.email('Email non valida.').max(320),
  role: z.enum(['ADMIN', 'STANDARD', 'READ_ONLY', 'EMAIL_ONLY']),
});

// I paesi con il nome in italiano e in inglese, per cercarli senza Google.
const COUNTRY_CODES = (() => {
  const it = new Intl.DisplayNames(['it'], { type: 'region' });
  const en = new Intl.DisplayNames(['en'], { type: 'region' });
  const codes: { id: string; it: string; en: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = it.of(code);
      if (name && name !== code && !/^(EU|EZ|UN|QO|XA|XB|ZZ)$/.test(code)) codes.push({ id: code, it: name, en: en.of(code) ?? name });
    }
  }
  return codes;
})();
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function searchCountries(q: string): AdLocation[] {
  const query = fold(q.trim());
  return COUNTRY_CODES.filter((c) => fold(c.it).includes(query) || fold(c.en).includes(query) || c.id.toLowerCase() === query)
    .sort((a, b) => Number(!fold(a.it).startsWith(query)) - Number(!fold(b.it).startsWith(query)))
    .slice(0, 15)
    .map((c) => ({ id: c.id, name: c.it, type: 'country' as const }));
}

const daysAgo = (days: number) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(Date.now() - days * 86_400_000));

// La sezione Campagne: il collegamento Google Ads del brand, le sue campagne e gli strumenti di Google (PIANO-ADS.md §0).
// Tutto con l'identità della persona; la spesa non passa da noi, la addebita Google sul suo account.
export function registerAdsRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  ads: AdsService,
  files: BrandFiles,
  settings: Pick<Config, 'STUDIO_ORIGINS' | 'SIMULATE_SOCIAL'>,
): void {
  const origins = (settings.STUDIO_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const run = <T>(identity: Identity, fn: (db: Queryable) => Promise<T>) => withIdentity(pool, identity, fn);
  // Il client vero, per collegare e scollegare.
  const zernio = (): ZernioAds => ads.clientFor({ zernio_account_id: '' });

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
  // Il collegamento pronto per lavorare (account scelto) con il client giusto.
  const google = async (identity: Identity, brandId: string): Promise<{ client: ZernioAds; ref: AdsAccountRef; connection: ConnectionRow }> => {
    const connection = await connectionOf(identity, brandId);
    if (connection.lost) throw ApiError.invalid('Google ha chiuso l’accesso: ricollega Google Ads.');
    if (!connection.ad_account_id) throw ApiError.invalid('Scegli prima l’account Google Ads.');
    return { client: ads.clientFor(connection), ref: { accountId: connection.zernio_account_id, adAccountId: connection.ad_account_id }, connection };
  };
  // Una campagna su Google, pronta per le chiamate.
  const campaignOf = async (identity: Identity, brandId: string, adId: string): Promise<{ row: AdRow; campaign: LiveCampaign }> => {
    const row = await adOf(identity, brandId, adId);
    return { row, campaign: await run(identity, (db) => ads.live(db, row)) };
  };
  const searchOnly = (row: AdRow) => {
    if (row.campaign_type !== 'search') throw ApiError.invalid('Le parole chiave ci sono solo nelle campagne sulla rete di ricerca.');
  };

  // Dopo il collegamento si leggono gli account Google Ads: se ce n'è uno solo usabile si sceglie da solo.
  const withAccounts = async (identity: Identity, connection: ConnectionRow): Promise<AdAccountsResponse> => {
    const accounts = await ads.clientFor(connection).adAccounts(connection.zernio_account_id);
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
    const result = await zernio().connectGoogle(brandId, redirectUrl);
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
    const account = await zernio().googleAccount(brandId, accountId);
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
    if (!isSimulatedConnection(connection)) await zernio().disconnect(connection.zernio_account_id);
    await run(request.identity, (db) => deleteConnection(db, connection.id));
    return reply.code(204).send();
  });

  // --- Strumenti per la bozza ---

  app.get('/v1/brands/:brandId/ads/images', async (request): Promise<AdImagesResponse> => {
    const { brandId } = brandParams.parse(request.params);
    await own(request.identity, brandId);
    return { images: await run(request.identity, (db) => adImageOptions(db, files, brandId)) };
  });

  app.post('/v1/brands/:brandId/ads/images', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const { dataUri } = uploadSchema.parse(request.body);
    await own(request.identity, brandId);
    return reply.code(201).send(await uploadAdImage(files, brandId, dataUri));
  });

  app.get('/v1/brands/:brandId/ads/google/locations', async (request): Promise<AdLocationsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { q } = searchQuery.parse(request.query);
    // Senza Google Ads collegato (o senza account scelto) non si può chiedere a Google: si cercano solo i paesi.
    const connection = await run(request.identity, (db) => findConnection(db, brandId, 'google'));
    if (!connection || connection.lost || !connection.ad_account_id) {
      await own(request.identity, brandId);
      return { locations: searchCountries(q) };
    }
    const { client, ref: account } = await google(request.identity, brandId);
    const found = await client.searchTargeting(account, q, 'geo');
    return {
      locations: found
        .filter((item) => item.id && item.name)
        .map((item) => ({ id: item.id, name: item.name, type: locationType(item.type), ...(item.path.length && { path: item.path.join(', ') }) })),
    };
  });

  app.get('/v1/brands/:brandId/ads/google/interests', async (request): Promise<AdInterestsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { q } = searchQuery.parse(request.query);
    const { client, ref: account } = await google(request.identity, brandId);
    const found = await client.searchTargeting(account, q, 'interest');
    return { interests: found.filter((item) => item.id).map((item) => ({ id: item.id, name: item.path.length ? `${item.name} (${item.path.join(' › ')})` : item.name })) };
  });

  app.post('/v1/brands/:brandId/ads/google/keyword-ideas', async (request): Promise<AdKeywordIdeasResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const body = ideasSchema.parse(request.body);
    if (body.seedKeywords.length === 0 && !body.seedUrl) throw ApiError.invalid('Scrivi qualche parola o il sito da cui partire.');
    const { client, ref: account } = await google(request.identity, brandId);
    const ideas = await client.keywordIdeas(account, {
      seedKeywords: body.seedKeywords,
      seedUrl: body.seedUrl,
      countries: body.countries.length ? body.countries : ['IT'],
      languageConstantId: LANGUAGE_CONSTANTS[body.language.slice(0, 2)] ?? 1004,
    });
    return { ideas: ideas.filter((idea) => idea.text).sort((a, b) => (b.monthlySearches ?? 0) - (a.monthlySearches ?? 0)) };
  });

  // Il wizard: la richiesta in linguaggio naturale di un passaggio diventa un lavoro breve del worker (ad-step), che
  // risponde con i campi da cambiare. Lo studio lo segue come gli altri lavori AI (/v1/ai/jobs/:id).
  app.post('/v1/brands/:brandId/ads/assist', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const body = assistSchema.parse(request.body);
    const id = await run(request.identity, async (db) => {
      const { rows } = await db.query<{ name: string; sector: string; pitch: string; site: string; language: string | null }>(
        `select identity ->> 'name' as name, coalesce(identity ->> 'sector', '') as sector, coalesce(identity ->> 'pitch', '') as pitch,
           coalesce(identity ->> 'site', '') as site, identity ->> 'language' as language
         from presenza.brands where id = $1`,
        [brandId],
      );
      const brand = rows[0];
      if (!brand) throw ApiError.notFound('Brand non trovato.');
      const input: AdStepJobInput = {
        step: body.step,
        instruction: body.instruction,
        draft: body.draft as AdStepJobInput['draft'],
        brandId,
        today: today(),
        brand: { ...brand, language: brand.language ?? 'it' },
      };
      return insertJob(db, request.identity.accountId, 'ad-step', input);
    });
    return reply.code(202).send({ id });
  });

  // --- Bozze e ciclo di vita ---

  app.post('/v1/brands/:brandId/ads', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const draft = draftSchema.parse(request.body) as AdDraft;
    await own(request.identity, brandId);
    const row = await run(request.identity, (db) => insertDraft(db, { accountId: request.identity.accountId, brandId }, draft, 'studio'));
    return reply.code(201).send(toAd(row));
  });

  app.put('/v1/brands/:brandId/ads/:adId', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const draft = draftSchema.parse(request.body) as AdDraft;
    const row = await adOf(request.identity, brandId, adId);
    if (row.status !== 'draft' && row.status !== 'failed') throw ApiError.conflict('AD_NOT_DRAFT', 'La campagna è già su Google: cambiala dal suo dettaglio.');
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

  // --- Una campagna su Google: modifiche ---

  app.put('/v1/brands/:brandId/ads/:adId/settings', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const body = settingsSchema.parse(request.body);
    const row = await adOf(request.identity, brandId, adId);
    if (body.bidding && !AD_BID_STRATEGIES[row.campaign_type].includes(body.bidding.strategy)) throw ApiError.invalid('Questa offerta non c’è per questo tipo di campagna.');
    return toAd(await run(request.identity, (db) => ads.updateSettings(db, row, body)));
  });

  app.put('/v1/brands/:brandId/ads/:adId/creative', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const body = creativeSchema.parse(request.body);
    const row = await adOf(request.identity, brandId, adId);
    // I limiti del tipo, sulla campagna com'è dopo la modifica.
    draftSchema.parse({ ...toAd(row), spec: { ...row.spec, ...body } });
    return toAd(await run(request.identity, (db) => ads.updateCreative(db, row, body)));
  });

  app.put('/v1/brands/:brandId/ads/:adId/targeting', async (request): Promise<Ad> => {
    const { brandId, adId } = adParams.parse(request.params);
    const body = targetingSchema.parse(request.body);
    const row = await adOf(request.identity, brandId, adId);
    return toAd(await run(request.identity, (db) => ads.updateTargeting(db, row, body)));
  });

  // --- Una campagna su Google: letture e strumenti ---

  app.get('/v1/brands/:brandId/ads/:adId/insights', async (request): Promise<AdInsightsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const range = rangeQuery.parse(request.query);
    const from = range.from ?? daysAgo(29);
    const to = range.to ?? today();
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    const [daily, share, groups] = await Promise.all([
      campaign.client.daily(campaign.ref, campaign.campaignId, from, to),
      row.campaign_type === 'search' ? campaign.client.impressionShare(campaign.ref, campaign.campaignId, from, to).catch(() => null) : null,
      row.campaign_type === 'pmax' ? campaign.client.assetGroups(campaign.ref, campaign.campaignId).catch(() => []) : [],
    ]);
    return {
      insights: {
        daily: daily.daily,
        impressionShare: share,
        adStrength: groups[0]?.adStrength ?? null,
        policy: row.rejection_reason ? { approval: 'DISAPPROVED', topics: [row.rejection_reason] } : null,
      },
    };
  });

  const keywordsOf = async (campaign: LiveCampaign): Promise<AdKeywordsResponse> => {
    const [keywords, negatives] = await Promise.all([
      campaign.client.keywords(campaign.ref, campaign.campaignId),
      campaign.client.campaignNegatives(campaign.ref, campaign.campaignId),
    ]);
    return { keywords, negatives };
  };

  app.get('/v1/brands/:brandId/ads/:adId/keywords', async (request): Promise<AdKeywordsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    return keywordsOf(campaign);
  });

  app.post('/v1/brands/:brandId/ads/:adId/keywords', async (request): Promise<AdKeywordsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const body = keywordsAddSchema.parse(request.body);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    if (!row.platform_ad_group_id) throw ApiError.invalid('Il gruppo di annunci non è ancora su Google: riprova tra poco.');
    await campaign.client.addKeywords(campaign.ref, row.platform_ad_group_id, body.keywords as AdKeyword[], body.negative);
    if (!body.negative) {
      const known = new Set(row.spec.keywords.map((k) => k.text.toLowerCase()));
      const spec: AdSpec = { ...row.spec, keywords: [...row.spec.keywords, ...(body.keywords as AdKeyword[]).filter((k) => !known.has(k.text.toLowerCase()))] };
      await run(request.identity, (db) => db.query('update presenza.ads set spec = $2, updated_at = now() where id = $1', [row.id, JSON.stringify(spec)]));
    }
    return keywordsOf(campaign);
  });

  app.patch('/v1/brands/:brandId/ads/:adId/keywords/:keywordId', async (request): Promise<AdKeywordsResponse> => {
    const { brandId, adId, keywordId } = keywordParams.parse(request.params);
    const { status } = keywordStatusSchema.parse(request.body);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    await campaign.client.setKeywordStatus(keywordId, status);
    return keywordsOf(campaign);
  });

  app.delete('/v1/brands/:brandId/ads/:adId/keywords/:keywordId', async (request): Promise<AdKeywordsResponse> => {
    const { brandId, adId, keywordId } = keywordParams.parse(request.params);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    await campaign.client.deleteKeyword(keywordId);
    return keywordsOf(campaign);
  });

  app.put('/v1/brands/:brandId/ads/:adId/negatives', async (request): Promise<AdKeywordsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const { negatives } = negativesSchema.parse(request.body);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    await campaign.client.setCampaignNegatives(campaign.ref, campaign.campaignId, negatives as AdKeyword[]);
    const spec: AdSpec = { ...row.spec, negativeKeywords: negatives as AdKeyword[] };
    await run(request.identity, (db) => db.query('update presenza.ads set spec = $2, updated_at = now() where id = $1', [row.id, JSON.stringify(spec)]));
    return keywordsOf(campaign);
  });

  app.get('/v1/brands/:brandId/ads/:adId/search-terms', async (request): Promise<AdSearchTermsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const range = rangeQuery.parse(request.query);
    const { row, campaign } = await campaignOf(request.identity, brandId, adId);
    searchOnly(row);
    const terms = await campaign.client.searchTerms(campaign.ref, campaign.campaignId, range.from ?? daysAgo(29), range.to ?? today());
    return { terms: terms.filter((term) => term.term) };
  });

  app.get('/v1/brands/:brandId/ads/:adId/extensions', async (request): Promise<AdExtensionsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const { campaign } = await campaignOf(request.identity, brandId, adId);
    return { extensions: await campaign.client.extensions(campaign.ref, campaign.campaignId) };
  });

  app.post('/v1/brands/:brandId/ads/:adId/extensions', async (request): Promise<AdExtensionsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const body = extensionsAddSchema.parse(request.body);
    if (!body.sitelinks?.length && !body.callouts?.length && !body.snippets?.length) throw ApiError.invalid('Aggiungi almeno un’estensione.');
    const { campaign } = await campaignOf(request.identity, brandId, adId);
    await campaign.client.addExtensions(campaign.ref, campaign.campaignId, body as Parameters<ZernioAds['addExtensions']>[2]);
    return { extensions: await campaign.client.extensions(campaign.ref, campaign.campaignId) };
  });

  app.delete('/v1/brands/:brandId/ads/:adId/extensions', async (request): Promise<AdExtensionsResponse> => {
    const { brandId, adId } = adParams.parse(request.params);
    const { resources } = resourcesSchema.parse(request.body);
    const { campaign } = await campaignOf(request.identity, brandId, adId);
    await campaign.client.removeExtensions(campaign.ref, campaign.campaignId, resources);
    return { extensions: await campaign.client.extensions(campaign.ref, campaign.campaignId) };
  });

  // --- L'account Google Ads del brand ---

  app.get('/v1/brands/:brandId/ads/google/recommendations', async (request): Promise<AdRecommendationsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { client, ref: account } = await google(request.identity, brandId);
    const [list, rows] = await Promise.all([client.recommendations(account), run(request.identity, (db) => listAds(db, brandId))]);
    const byCampaign = new Map(rows.filter((row) => row.platform_campaign_id).map((row) => [row.platform_campaign_id!, row.id]));
    return { recommendations: list.map((item) => ({ ...item, adId: (item.campaignId && byCampaign.get(item.campaignId)) || null })) };
  });

  app.post('/v1/brands/:brandId/ads/google/recommendations/apply', async (request): Promise<AdRecommendationsActionResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { resources } = resourcesSchema.parse(request.body);
    const { client, ref: account } = await google(request.identity, brandId);
    return { results: await client.applyRecommendations(account, resources) };
  });

  app.post('/v1/brands/:brandId/ads/google/recommendations/dismiss', async (request): Promise<AdRecommendationsActionResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { resources } = resourcesSchema.parse(request.body);
    const { client, ref: account } = await google(request.identity, brandId);
    return { results: await client.dismissRecommendations(account, resources) };
  });

  app.get('/v1/brands/:brandId/ads/google/audiences', async (request): Promise<AdAudiencesResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { client, ref: account } = await google(request.identity, brandId);
    return { audiences: await client.audiences(account) };
  });

  app.post('/v1/brands/:brandId/ads/google/audiences', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const body = audienceSchema.parse(request.body);
    if (body.type === 'lookalike' && !body.sourceAudienceId) throw ApiError.invalid('Scegli il pubblico di partenza.');
    const { client, ref: account } = await google(request.identity, brandId);
    return reply.code(201).send(await client.createAudience(account, body));
  });

  app.post('/v1/brands/:brandId/ads/google/audiences/:audienceId/users', async (request) => {
    const { brandId, audienceId } = audienceParams.parse(request.params);
    const { emails } = usersSchema.parse(request.body);
    const { client } = await google(request.identity, brandId);
    return client.addAudienceUsers(audienceId, [...new Set(emails)]);
  });

  app.delete('/v1/brands/:brandId/ads/google/audiences/:audienceId', async (request, reply) => {
    const { brandId, audienceId } = audienceParams.parse(request.params);
    const { client } = await google(request.identity, brandId);
    await client.deleteAudience(audienceId);
    return reply.code(204).send();
  });

  const conversionsOf = async (client: ZernioAds, account: AdsAccountRef): Promise<AdConversionsResponse> => {
    const [actions, goals] = await Promise.all([client.conversionActions(account), client.conversionGoals(account).catch(() => [])]);
    return { actions, goals };
  };

  app.get('/v1/brands/:brandId/ads/google/conversions', async (request): Promise<AdConversionsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { client, ref: account } = await google(request.identity, brandId);
    return conversionsOf(client, account);
  });

  app.post('/v1/brands/:brandId/ads/google/conversions', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const body = conversionSchema.parse(request.body);
    const { client, ref: account } = await google(request.identity, brandId);
    return reply.code(201).send(await client.createConversionAction(account, body));
  });

  app.patch('/v1/brands/:brandId/ads/google/conversions/goals', async (request): Promise<AdConversionsResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const body = goalSchema.parse(request.body);
    const { client, ref: account } = await google(request.identity, brandId);
    await client.setConversionGoal(account, body);
    return conversionsOf(client, account);
  });

  app.get('/v1/brands/:brandId/ads/google/account', async (request): Promise<AdAccountInfoResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { client, ref: account } = await google(request.identity, brandId);
    const [billing, invitations] = await Promise.all([
      client.billing(account).catch(() => ({ ready: null, detail: null })),
      client.invitations(account).catch(() => []),
    ]);
    return { billing, invitations };
  });

  app.post('/v1/brands/:brandId/ads/google/invitations', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const body = invitationSchema.parse(request.body);
    const { client, ref: account } = await google(request.identity, brandId);
    return reply.code(201).send(await client.invite(account, body.email, body.role));
  });

  app.delete('/v1/brands/:brandId/ads/google/invitations/:invitationId', async (request, reply) => {
    const { brandId, invitationId } = invitationParams.parse(request.params);
    const { client, ref: account } = await google(request.identity, brandId);
    await client.cancelInvitation(account, invitationId);
    return reply.code(204).send();
  });
}
