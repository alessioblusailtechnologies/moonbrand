import type {
  AdAccount,
  AdAudience,
  AdBilling,
  AdConversionAction,
  AdConversionGoal,
  AdDailyMetrics,
  AdExtensions,
  AdImpressionShare,
  AdInvitation,
  AdKeyword,
  AdKeywordIdea,
  AdKeywordRow,
  AdLocation,
  AdLocationType,
  AdMetrics,
  AdRecommendation,
  AdSearchTerm,
  AdSitelink,
  AdSnippet,
} from '@moonbrand/shared/domain/ads';

import { ApiError } from '../../errors';

// Zernio Ads (docs.zernio.com/platforms/google-ads): il collegamento Google Ads del profilo del brand, le campagne create da
// noi e tutto quello che Zernio permette di farci sopra. Il profilo Zernio del brand si chiama con l'id del brand, come per i
// social (social/zernio.ts). Dove la documentazione non dà i nomi esatti dei campi di risposta, si leggono più nomi possibili.

const API = 'https://zernio.com/api/v1';
const TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

// Le risposte d'errore di Zernio: error è il messaggio, code quello stabile (ad_account_not_selected, rate_limited…).
interface ZernioError {
  error?: string;
  message?: string;
  code?: string;
  type?: string;
  platformError?: { code?: string; message?: string; details?: unknown };
  details?: unknown;
}

// Gli errori che la persona può risolvere, detti in chiaro; gli altri con il messaggio di Zernio o di Google.
const MESSAGES: Record<string, string> = {
  ad_account_not_selected: 'Questo account Google Ads non è tra quelli collegati: ricollega Google Ads e sceglilo.',
  ad_account_unusable: 'L’account Google Ads non si può usare: controlla in Google Ads metodo di pagamento e stato dell’account.',
  ad_account_payment_required: 'L’account Google Ads non ha un metodo di pagamento: aggiungilo in Google Ads → Fatturazione.',
  payment_required: 'L’account Google Ads non ha un metodo di pagamento: aggiungilo in Google Ads → Fatturazione.',
  ads_addon_required: 'La pubblicità non è attiva sul nostro servizio di collegamento: scrivici a info@moonbrand.app.',
  ads_allowance_exceeded: 'La pubblicità non è momentaneamente disponibile: scrivici a info@moonbrand.app.',
  ads_connection_required: 'Il collegamento con Google Ads va rifatto: ricollegalo.',
  rate_limited: 'Google sta ricevendo troppe richieste: riprova tra un minuto.',
  invalid_credentials: 'Il collegamento con Google Ads è scaduto: ricollegalo.',
  TOKEN_EXPIRED: 'Il collegamento con Google Ads è scaduto: ricollegalo.',
  reconnect_required: 'Il collegamento con Google Ads è scaduto: ricollegalo.',
  insufficient_permissions: 'Google non ha dato i permessi per la pubblicità: ricollega Google Ads e lascia spuntata la casella di Google Ads.',
  feature_not_available: 'Google non permette questa operazione su questo tipo di campagna.',
  RESPONSIVE_SEARCH_ADS_PER_AD_GROUP: 'Il gruppo ha già il numero massimo di annunci.',
  NOT_ENOUGH_SQUARE_MARKETING_IMAGE_ASSET: 'Manca l’immagine quadrata.',
  NOT_ENOUGH_MARKETING_IMAGE_ASSET: 'Manca l’immagine orizzontale.',
  LISTING_SOURCE_NOT_ALLOWED: 'L’account Google Ads non è collegato a un Merchant Center.',
  MISSING_TRACKING_URL_TEMPLATE_TAG: 'Il modello di monitoraggio deve contenere {lpurl}.',
  MALFORMED_TRACKING_URL_TEMPLATE: 'Il modello di monitoraggio non è un indirizzo valido.',
  INVALID_TAG_IN_TRACKING_URL_TEMPLATE: 'Il modello di monitoraggio contiene un parametro che Google non conosce.',
};

export class ZernioAdsError extends ApiError {
  constructor(
    status: number,
    readonly zernioCode: string | null,
    message: string,
    readonly raw: ZernioError | null,
  ) {
    super(status, 'ADS_FAILED', message);
  }
}

export interface ZernioAd {
  _id: string;
  name?: string;
  platform?: string;
  status?: string;
  configuredStatus?: string;
  reviewStatus?: string | null;
  rejectionReason?: string | null;
  platformAdId?: string | null;
  platformCampaignId?: string | null;
  platformAdSetId?: string | null;
  metrics?: Record<string, unknown> | null;
}

// Chi fa la chiamata: l'account googleads del brand su Zernio e l'account Google Ads scelto.
export interface AdsAccountRef {
  accountId: string;
  adAccountId: string;
}

// Un pubblico di partenza per la creazione.
export interface AudienceCreate {
  type: string;
  name: string;
  description?: string;
  retentionDays?: number;
  urlContains?: string;
  sourceAudienceId?: string;
  size?: string;
}

export interface AssetGroup {
  id: string;
  status: string | null;
  adStrength: string | null;
}

export interface ZernioAds {
  // L'account googleads già nel profilo del brand, se c'è; altrimenti la pagina di consenso di Google.
  connectGoogle(brandId: string, redirectUrl: string): Promise<{ authUrl: string } | { accountId: string; name: string | null }>;
  // L'account googleads del profilo del brand con quell'id, solo se c'è davvero.
  googleAccount(brandId: string, accountId: string): Promise<{ accountId: string; name: string | null } | null>;
  adAccounts(accountId: string): Promise<AdAccount[]>;
  disconnect(accountId: string): Promise<void>;
  // Un file su Zernio, per le immagini degli annunci: torna l'indirizzo pubblico.
  upload(name: string, contentType: string, bytes: Uint8Array): Promise<string>;

  // Campagne.
  create(body: Record<string, unknown>, idempotencyKey: string): Promise<ZernioAd>;
  ad(adId: string): Promise<ZernioAd | null>;
  setCampaignStatus(campaignId: string, status: 'active' | 'paused'): Promise<void>;
  setAdSetStatus(adSetId: string, status: 'active' | 'paused'): Promise<void>;
  updateAd(adId: string, body: Record<string, unknown>): Promise<void>;
  updateCampaign(ref: AdsAccountRef, campaignId: string, body: Record<string, unknown>): Promise<void>;
  setCampaignTargeting(ref: AdsAccountRef, campaignId: string, targeting: Record<string, unknown>): Promise<void>;
  assetGroups(ref: AdsAccountRef, campaignId: string): Promise<AssetGroup[]>;
  setAssetGroupStatus(ref: AdsAccountRef, campaignId: string, groupId: string, status: 'ENABLED' | 'PAUSED'): Promise<void>;
  linkAssetGroupAssets(ref: AdsAccountRef, campaignId: string, groupId: string, assets: Record<string, unknown>[]): Promise<void>;
  deleteAd(adId: string): Promise<void>;
  deleteCampaign(ref: AdsAccountRef, campaignId: string): Promise<void>;

  // Letture.
  daily(ref: AdsAccountRef, campaignId: string, from: string, to: string): Promise<{ daily: AdDailyMetrics[]; total: AdMetrics | null }>;
  impressionShare(ref: AdsAccountRef, campaignId: string, from: string, to: string): Promise<AdImpressionShare | null>;
  keywords(ref: AdsAccountRef, campaignId: string): Promise<AdKeywordRow[]>;
  addKeywords(ref: AdsAccountRef, adSetId: string, keywords: AdKeyword[], negative: boolean): Promise<void>;
  setKeywordStatus(keywordId: string, status: 'active' | 'paused'): Promise<void>;
  deleteKeyword(keywordId: string): Promise<void>;
  campaignNegatives(ref: AdsAccountRef, campaignId: string): Promise<AdKeyword[]>;
  setCampaignNegatives(ref: AdsAccountRef, campaignId: string, keywords: AdKeyword[]): Promise<void>;
  searchTerms(ref: AdsAccountRef, campaignId: string, from: string, to: string): Promise<AdSearchTerm[]>;
  extensions(ref: AdsAccountRef, campaignId: string): Promise<AdExtensions>;
  addExtensions(ref: AdsAccountRef, campaignId: string, add: { sitelinks?: AdSitelink[]; callouts?: string[]; snippets?: AdSnippet[] }): Promise<void>;
  removeExtensions(ref: AdsAccountRef, campaignId: string, resources: string[]): Promise<void>;

  // Strumenti di Google.
  keywordIdeas(ref: AdsAccountRef, request: { seedKeywords: string[]; seedUrl?: string; countries: string[]; languageConstantId: number }): Promise<AdKeywordIdea[]>;
  searchTargeting(ref: AdsAccountRef, q: string, dimension: 'geo' | 'interest' | 'language'): Promise<{ id: string; name: string; type: string; path: string[] }[]>;
  recommendations(ref: AdsAccountRef): Promise<Omit<AdRecommendation, 'adId'>[]>;
  applyRecommendations(ref: AdsAccountRef, resources: string[]): Promise<{ resource: string; status: 'applied' | 'dismissed' | 'failed'; error: string | null }[]>;
  dismissRecommendations(ref: AdsAccountRef, resources: string[]): Promise<{ resource: string; status: 'applied' | 'dismissed' | 'failed'; error: string | null }[]>;
  audiences(ref: AdsAccountRef): Promise<AdAudience[]>;
  createAudience(ref: AdsAccountRef, audience: AudienceCreate): Promise<AdAudience>;
  addAudienceUsers(audienceId: string, emails: string[]): Promise<{ received: number; invalid: number }>;
  deleteAudience(audienceId: string): Promise<void>;
  conversionActions(ref: AdsAccountRef): Promise<AdConversionAction[]>;
  createConversionAction(ref: AdsAccountRef, action: { name: string; type: string; primary: boolean }): Promise<AdConversionAction>;
  conversionGoals(ref: AdsAccountRef): Promise<AdConversionGoal[]>;
  setConversionGoal(ref: AdsAccountRef, goal: { category: string; origin: string; biddable: boolean }): Promise<void>;
  billing(ref: AdsAccountRef): Promise<AdBilling>;
  invitations(ref: AdsAccountRef): Promise<AdInvitation[]>;
  invite(ref: AdsAccountRef, email: string, role: string): Promise<AdInvitation>;
  cancelInvitation(ref: AdsAccountRef, invitationId: string): Promise<void>;
}

export const num = (value: unknown): number | null => {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : typeof value === 'number' ? String(value) : null);
const micros = (value: unknown): number | null => {
  const n = num(value);
  return n === null ? null : n / 1_000_000;
};
// Il primo elenco che c'è tra i nomi possibili.
const list = (body: unknown, ...keys: string[]): Record<string, unknown>[] => {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const record = (body ?? {}) as Record<string, unknown>;
  for (const key of keys) if (Array.isArray(record[key])) return record[key] as Record<string, unknown>[];
  return [];
};

// I nomi dentro metrics non sono tutti documentati: si prendono i più probabili.
export function normalizeMetrics(raw: Record<string, unknown> | null | undefined): AdMetrics | null {
  if (!raw) return null;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = num(raw[key]);
      if (value !== null) return value;
    }
    return null;
  };
  const spend = pick('spend', 'amountSpent', 'cost', 'spent') ?? micros(raw['costMicros']);
  const impressions = pick('impressions');
  const clicks = pick('clicks', 'linkClicks');
  const ctr = pick('ctr') ?? (impressions && clicks !== null ? (clicks / impressions) * 100 : null);
  const cpc = pick('cpc') ?? (clicks && spend !== null ? spend / clicks : null);
  const conversions = pick('conversions', 'results');
  const cpm = pick('cpm') ?? (impressions && spend !== null ? (spend / impressions) * 1000 : null);
  return { spend, impressions, clicks, ctr, cpc, conversions, cpm };
}

const LOCATION_TYPES: readonly AdLocationType[] = ['country', 'region', 'city', 'zip', 'metro'];
export const locationType = (value: unknown): AdLocationType => {
  const type = String(value ?? '').toLowerCase();
  if ((LOCATION_TYPES as readonly string[]).includes(type)) return type as AdLocationType;
  if (type.includes('postal') || type.includes('zip')) return 'zip';
  if (type.includes('province') || type.includes('state') || type.includes('region')) return 'region';
  if (type.includes('dma') || type.includes('metro')) return 'metro';
  return 'city';
};

// I luoghi divisi per tipo come li vuole Zernio: i paesi con il codice ISO, gli altri come {key} con l'id di Google.
export function geoTargeting(locations: AdLocation[]): Record<string, unknown> {
  const out: Record<string, unknown[]> = {};
  const add = (key: string, value: unknown) => (out[key] ??= []).push(value);
  for (const location of locations) {
    if (location.type === 'country') add('countries', location.id);
    else add(`${location.type === 'city' ? 'cities' : `${location.type}s`}`, { key: location.id });
  }
  return out;
}

export function zernioAds(apiKey: string): ZernioAds {
  const call = async <T>(path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeout),
    }).catch(() => {
      throw new ZernioAdsError(502, null, 'Il servizio della pubblicità non risponde: riprova.', null);
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ZernioError | null;
      const code = body?.code ?? null;
      const google = body?.platformError?.code ?? null;
      const detail = body?.platformError?.message ?? body?.error ?? body?.message;
      const message =
        (code && MESSAGES[code]) ??
        (google && MESSAGES[google]) ??
        (response.status === 404 ? 'Su Google Ads non c’è più.' : `Google Ads non ha accettato la richiesta${detail ? `: ${detail}` : ''}.`);
      const status = response.status === 404 ? 404 : response.status === 429 ? 429 : response.status === 409 ? 409 : response.status >= 500 ? 502 : 400;
      throw new ZernioAdsError(status, code ?? google, message, body);
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  };
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
  const query = (params: Record<string, string | number | boolean | null | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== null && value !== undefined && value !== '') search.set(key, String(value));
    return search.toString();
  };
  const ignore404 = (error: unknown) => {
    if (!(error instanceof ZernioAdsError && error.status === 404)) throw error;
  };
  const refQuery = (ref: AdsAccountRef, extra: Record<string, string | number | boolean | null | undefined> = {}) =>
    query({ accountId: ref.accountId, adAccountId: ref.adAccountId, ...extra });
  const enc = encodeURIComponent;

  const profileId = async (brandId: string, create: boolean): Promise<string | null> => {
    const { profiles } = await call<{ profiles: { _id: string }[] }>(`/profiles?name=${enc(brandId)}`);
    if (profiles[0] || !create) return profiles[0]?._id ?? null;
    const created = await call<{ profile?: { _id: string }; _id?: string }>('/profiles', json('POST', { name: brandId, description: 'Brand di moonbrand', timezone: 'Europe/Rome' }));
    return created.profile?._id ?? created._id ?? null;
  };

  const results = (body: unknown) =>
    list(body, 'results').map((item) => ({
      resource: str(item['resourceName']) ?? '',
      status: (item['status'] === 'applied' || item['status'] === 'dismissed' ? item['status'] : 'failed') as 'applied' | 'dismissed' | 'failed',
      error: str(item['error']),
    }));

  const audience = (item: Record<string, unknown>): AdAudience => ({
    id: str(item['_id']) ?? str(item['id']) ?? '',
    platformId: str(item['platformAudienceId']) ?? str(item['platformId']) ?? null,
    name: str(item['name']) ?? '',
    type: str(item['type']) ?? 'customer_list',
    size: num(item['size']) ?? num(item['audienceSize']) ?? num(item['approximateCount']),
    status: str(item['status']),
  });

  const invitation = (item: Record<string, unknown>): AdInvitation => ({
    id: str(item['invitationId']) ?? str(item['id']) ?? '',
    email: str(item['emailAddress']) ?? str(item['email']) ?? '',
    role: str(item['accessRole']) ?? str(item['role']) ?? 'STANDARD',
    status: str(item['status']) ?? 'PENDING',
  });

  const conversionAction = (item: Record<string, unknown>): AdConversionAction => ({
    id: str(item['id']) ?? '',
    name: str(item['name']) ?? '',
    type: str(item['type']),
    status: str(item['status']),
  });

  return {
    async connectGoogle(brandId, redirectUrl) {
      const profile = await profileId(brandId, true);
      if (!profile) throw new ZernioAdsError(502, null, 'Il collegamento di Google Ads non è riuscito: riprova.', null);
      const result = await call<{ authUrl?: string; alreadyConnected?: boolean; accountId?: string; displayName?: string; username?: string }>(
        `/connect/googleads/ads?${query({ profileId: profile, redirect_url: redirectUrl })}`,
      );
      if (result.alreadyConnected && result.accountId) return { accountId: result.accountId, name: result.displayName ?? result.username ?? null };
      if (!result.authUrl) throw new ZernioAdsError(502, null, 'Il collegamento di Google Ads non è riuscito: riprova.', null);
      return { authUrl: result.authUrl };
    },

    async googleAccount(brandId, accountId) {
      const profile = await profileId(brandId, false);
      if (!profile) return null;
      const { accounts } = await call<{ accounts: { _id: string; platform?: string; displayName?: string; username?: string; isActive?: boolean }[] }>(
        `/accounts?${query({ profileId: profile, platform: 'googleads' })}`,
      );
      const account = accounts.find((item) => item._id === accountId && (!item.platform || item.platform === 'googleads'));
      if (!account || account.isActive === false) return null;
      return { accountId: account._id, name: account.displayName ?? account.username ?? null };
    },

    async adAccounts(accountId) {
      const { accounts } = await call<{ accounts: { id: string; name?: string; currency?: string; accountStatus?: string; selected?: boolean }[] }>(
        `/ads/accounts?${query({ accountId })}`,
      );
      return accounts.map((account) => ({
        id: account.id,
        name: account.name ?? account.id,
        currency: account.currency ?? null,
        status: account.accountStatus ?? null,
        selected: account.selected ?? true,
      }));
    },

    async disconnect(accountId) {
      await call(`/accounts/${enc(accountId)}`, { method: 'DELETE' }).catch(ignore404);
    },

    async upload(name, contentType, bytes) {
      const { uploadUrl, publicUrl } = await call<{ uploadUrl: string; publicUrl: string }>(
        '/media/presign',
        json('POST', { filename: name, contentType, size: bytes.length }),
      );
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      }).catch(() => null);
      if (!put?.ok) throw new ZernioAdsError(502, null, `Il caricamento di ${name} non è riuscito.`, null);
      return publicUrl;
    },

    async create(body, idempotencyKey) {
      const { ad } = await call<{ ad: ZernioAd }>('/ads/create', { ...json('POST', body), headers: { 'idempotency-key': idempotencyKey } }, 90_000);
      return ad;
    },

    async ad(adId) {
      try {
        const { ad } = await call<{ ad: ZernioAd }>(`/ads/${enc(adId)}`);
        return ad;
      } catch (error) {
        if (error instanceof ZernioAdsError && error.status === 404) return null;
        throw error;
      }
    },

    // Il corpo vuole active/paused in minuscolo (pagina update-ad-campaign-status); Google risponde ENABLED/PAUSED.
    async setCampaignStatus(campaignId, status) {
      await call(`/ads/campaigns/${enc(campaignId)}/status`, json('PUT', { status, platform: 'google' }));
    },

    async setAdSetStatus(adSetId, status) {
      await call(`/ads/ad-sets/${enc(adSetId)}/status`, json('PUT', { status, platform: 'google' }));
    },

    async updateAd(adId, body) {
      await call(`/ads/${enc(adId)}`, json('PUT', body));
    },

    async updateCampaign(ref, campaignId, body) {
      await call(`/ads/campaigns/${enc(campaignId)}?${query({ accountId: ref.accountId })}`, json('PUT', { platform: 'google', ...body }));
    },

    async setCampaignTargeting(ref, campaignId, targeting) {
      await call(`/ads/campaigns/${enc(campaignId)}/targeting?${query({ accountId: ref.accountId })}`, json('PUT', { platform: 'google', targeting }));
    },

    async assetGroups(ref, campaignId) {
      const body = await call<unknown>(`/ads/campaigns/${enc(campaignId)}/asset-groups?${refQuery(ref)}`);
      return list(body, 'assetGroups').map((group) => ({
        id: str(group['id']) ?? '',
        status: str(group['status']),
        adStrength: str(group['adStrength']),
      }));
    },

    async setAssetGroupStatus(ref, campaignId, groupId, status) {
      await call(`/ads/campaigns/${enc(campaignId)}/asset-groups/${enc(groupId)}?${refQuery(ref)}`, json('PATCH', { ...ref, status }));
    },

    async linkAssetGroupAssets(ref, campaignId, groupId, assets) {
      if (assets.length === 0) return;
      await call(`/ads/campaigns/${enc(campaignId)}/asset-groups/${enc(groupId)}/assets?${refQuery(ref)}`, json('POST', { ...ref, link: assets }));
    },

    async deleteAd(adId) {
      await call(`/ads/${enc(adId)}`, { method: 'DELETE' }).catch(ignore404);
    },

    // Google cancella solo le campagne vuote (409 invalid_resource_state): in quel caso resta in pausa, che basta.
    async deleteCampaign(ref, campaignId) {
      await call(`/ads/campaigns/${enc(campaignId)}?${query({ accountId: ref.accountId })}`, json('DELETE', { platform: 'google', accountId: ref.accountId })).catch(
        (error: unknown) => {
          if (!(error instanceof ZernioAdsError && (error.status === 404 || error.status === 409 || error.zernioCode === 'invalid_resource_state'))) throw error;
        },
      );
    },

    async daily(ref, campaignId, from, to) {
      const body = await call<{ campaigns?: Record<string, unknown>[] }>(
        `/ads/tree?${query({
          accountId: ref.accountId,
          platform: 'google',
          adAccountId: ref.adAccountId,
          campaignId,
          fromDate: from,
          toDate: to,
          timeIncrement: 1,
          dailyLevel: 'campaign',
          depth: 'campaign',
        })}`,
      );
      const campaign = body.campaigns?.[0];
      if (!campaign) return { daily: [], total: null };
      const daily = list(campaign, 'daily')
        .map((day) => ({ date: String(day['date'] ?? day['day'] ?? day['dateStart'] ?? '').slice(0, 10), ...normalizeMetrics((day['metrics'] as Record<string, unknown>) ?? day)! }))
        .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date))
        .sort((a, b) => a.date.localeCompare(b.date));
      return { daily, total: normalizeMetrics(campaign['metrics'] as Record<string, unknown>) };
    },

    async impressionShare(ref, campaignId, from, to) {
      const body = await call<{ analytics?: { summary?: Record<string, unknown> } }>(
        `/ads/campaigns/${enc(campaignId)}/analytics?${refQuery(ref, { platform: 'google', fromDate: from, toDate: to })}`,
      );
      const summary = body.analytics?.summary;
      if (!summary) return null;
      const share = {
        share: num(summary['searchImpressionShare']),
        lostToBudget: num(summary['searchBudgetLostImpressionShare']),
        lostToRank: num(summary['searchRankLostImpressionShare']),
        top: num(summary['searchTopImpressionShare']),
        absoluteTop: num(summary['searchAbsoluteTopImpressionShare']),
      };
      return Object.values(share).some((value) => value !== null) ? share : null;
    },

    async keywords(ref, campaignId) {
      const body = await call<unknown>(`/ads/keywords?${refQuery(ref, { campaignId, limit: 500 })}`);
      return list(body, 'keywords', 'data').map((row) => {
        const metrics = (row['metrics'] ?? {}) as Record<string, unknown>;
        const match = String(row['matchType'] ?? 'broad').toLowerCase();
        return {
          id: str(row['id']) ?? str(row['_id']) ?? '',
          text: str(row['keyword']) ?? str(row['text']) ?? '',
          match: (match === 'exact' || match === 'phrase' ? match : 'broad') as AdKeyword['match'],
          status: row['status'] === 'paused' ? 'paused' : 'active',
          negative: row['negative'] === true,
          qualityScore: num(row['qualityScore']),
          clicks: num(metrics['clicks']),
          impressions: num(metrics['impressions']),
          cost: num(metrics['cost']) ?? micros(metrics['costMicros']),
          conversions: num(metrics['conversions']),
          firstPageCpc: num(metrics['firstPageCpc']) ?? micros(metrics['firstPageCpcMicros']),
        };
      });
    },

    async addKeywords(ref, adSetId, keywords, negative) {
      await call('/ads/keywords', json('POST', { ...ref, adSetId, negative, keywords: keywords.map((k) => ({ text: k.text, matchType: k.match })) }));
    },

    async setKeywordStatus(keywordId, status) {
      await call(`/ads/keywords/${enc(keywordId)}`, json('PATCH', { status }));
    },

    async deleteKeyword(keywordId) {
      await call(`/ads/keywords/${enc(keywordId)}`, { method: 'DELETE' }).catch(ignore404);
    },

    async campaignNegatives(ref, campaignId) {
      const body = await call<unknown>(`/ads/campaigns/${enc(campaignId)}/negative-keywords?${refQuery(ref)}`);
      return list(body, 'keywords', 'negativeKeywords', 'data').map((row) => {
        const match = String(row['matchType'] ?? 'broad').toLowerCase();
        return { text: str(row['text']) ?? str(row['keyword']) ?? '', match: (match === 'exact' || match === 'phrase' ? match : 'broad') as AdKeyword['match'] };
      });
    },

    async setCampaignNegatives(ref, campaignId, keywords) {
      await call(
        `/ads/campaigns/${enc(campaignId)}/negative-keywords?${refQuery(ref)}`,
        json('PUT', { ...ref, platform: 'google', keywords: keywords.map((k) => ({ text: k.text, matchType: k.match })) }),
      );
    },

    async searchTerms(ref, campaignId, from, to) {
      const body = await call<unknown>(`/ads/search-terms?${refQuery(ref, { campaignId, fromDate: from, toDate: to })}`);
      return list(body, 'searchTerms', 'data', 'terms', 'rows').map((row) => ({
        term: str(row['searchTerm']) ?? '',
        status: str(row['status']) ?? 'NONE',
        match: str(row['matchType']),
        impressions: num(row['impressions']) ?? 0,
        clicks: num(row['clicks']) ?? 0,
        cost: micros(row['costMicros']) ?? num(row['cost']) ?? 0,
        conversions: num(row['conversions']) ?? 0,
      }));
    },

    async extensions(ref, campaignId) {
      const body = await call<Record<string, unknown>>(`/ads/campaigns/${enc(campaignId)}/assets?${refQuery(ref)}`);
      return {
        sitelinks: list(body, 'sitelinks').map((item) => ({
          text: str(item['text']) ?? '',
          linkUrl: str(item['linkUrl']) ?? '',
          description1: str(item['description1']) ?? undefined,
          description2: str(item['description2']) ?? undefined,
          resource: str(item['campaignAssetResourceName']) ?? '',
        })),
        callouts: list(body, 'callouts').map((item) => ({ text: str(item['calloutText']) ?? str(item['text']) ?? '', resource: str(item['campaignAssetResourceName']) ?? '' })),
        snippets: list(body, 'structuredSnippets').map((item) => ({
          header: (str(item['header']) ?? 'Types') as AdSnippet['header'],
          values: Array.isArray(item['values']) ? (item['values'] as unknown[]).map(String) : [],
          resource: str(item['campaignAssetResourceName']) ?? '',
        })),
      };
    },

    async addExtensions(ref, campaignId, add) {
      await call(
        `/ads/campaigns/${enc(campaignId)}/assets`,
        json('POST', {
          ...ref,
          ...(add.sitelinks?.length && { sitelinks: add.sitelinks }),
          ...(add.callouts?.length && { callouts: add.callouts }),
          ...(add.snippets?.length && { structuredSnippets: add.snippets }),
        }),
      );
    },

    async removeExtensions(ref, campaignId, resources) {
      if (resources.length === 0) return;
      await call(`/ads/campaigns/${enc(campaignId)}/assets`, json('DELETE', { ...ref, campaignAssetResourceNames: resources }));
    },

    async keywordIdeas(ref, request) {
      const body = await call<unknown>(
        '/ads/keywords/ideas',
        json('POST', {
          accountId: ref.accountId,
          customerId: ref.adAccountId,
          ...(request.seedKeywords.length && { seedKeywords: request.seedKeywords }),
          ...(request.seedUrl && { seedUrl: request.seedUrl }),
          countries: request.countries,
          languageConstantId: request.languageConstantId,
          pageSize: 60,
        }),
      );
      return list(body, 'data', 'ideas', 'results').map((row) => {
        const metrics = (row['keywordIdeaMetrics'] ?? {}) as Record<string, unknown>;
        const competition = str(metrics['competition']);
        return {
          text: str(row['text']) ?? '',
          monthlySearches: num(metrics['avgMonthlySearches']),
          competition: (competition && ['LOW', 'MEDIUM', 'HIGH', 'UNSPECIFIED'].includes(competition) ? competition : null) as AdKeywordIdea['competition'],
          lowBid: micros(metrics['lowTopOfPageBidMicros']),
          highBid: micros(metrics['highTopOfPageBidMicros']),
        };
      });
    },

    async searchTargeting(ref, q, dimension) {
      const body = await call<unknown>(`/ads/targeting/search?${query({ accountId: ref.accountId, q, dimension, limit: 25 })}`);
      return list(body, 'results', 'data', 'options', 'items').map((item) => ({
        id: str(item['id']) ?? str(item['platformId']) ?? '',
        name: str(item['name']) ?? '',
        type: str(item['type']) ?? '',
        path: Array.isArray(item['path']) ? (item['path'] as unknown[]).map(String) : [],
      }));
    },

    async recommendations(ref) {
      const body = await call<unknown>(`/ads/recommendations?${refQuery(ref)}`);
      return list(body, 'recommendations').map((item) => ({
        resource: str(item['resourceName']) ?? '',
        type: str(item['type']) ?? 'UNKNOWN',
        campaignId: str(item['campaignId']),
        impact: (item['impact'] as Record<string, unknown> | null) ?? null,
        details: (item['details'] as Record<string, unknown> | null) ?? null,
      }));
    },

    async applyRecommendations(ref, resources) {
      return results(await call('/ads/recommendations/apply', json('POST', { ...ref, recommendations: resources.map((resourceName) => ({ resourceName })) })));
    },

    async dismissRecommendations(ref, resources) {
      return results(await call('/ads/recommendations/dismiss', json('POST', { ...ref, resourceNames: resources })));
    },

    async audiences(ref) {
      const body = await call<unknown>(`/ads/audiences?${refQuery(ref)}`);
      return list(body, 'audiences', 'data').map(audience);
    },

    async createAudience(ref, created) {
      const body = await call<{ audience?: Record<string, unknown> }>('/ads/audiences', json('POST', { ...ref, ...created }));
      return audience(body.audience ?? {});
    },

    async addAudienceUsers(audienceId, emails) {
      const body = await call<{ numReceived?: number; numInvalid?: number }>(
        `/ads/audiences/${enc(audienceId)}/users`,
        json('POST', { users: emails.map((email) => ({ email })) }),
        90_000,
      );
      return { received: body.numReceived ?? emails.length, invalid: body.numInvalid ?? 0 };
    },

    async deleteAudience(audienceId) {
      await call(`/ads/audiences/${enc(audienceId)}`, { method: 'DELETE' }).catch(ignore404);
    },

    async conversionActions(ref) {
      const body = await call<unknown>(`/ads/conversions/destinations?${refQuery(ref)}`);
      return list(body, 'destinations').map(conversionAction);
    },

    async createConversionAction(ref, action) {
      const body = await call<{ destination?: Record<string, unknown> }>(
        '/ads/conversions/destinations',
        json('POST', { ...ref, name: action.name, type: action.type, primaryForGoal: action.primary }),
      );
      return conversionAction(body.destination ?? {});
    },

    async conversionGoals(ref) {
      const body = await call<unknown>(`/ads/conversions/goals?${refQuery(ref)}`);
      return list(body, 'goals').map((goal) => ({
        category: str(goal['category']) ?? '',
        origin: str(goal['origin']) ?? '',
        biddable: goal['biddable'] === true,
        actions: list(goal, 'conversionActions').map((action) => ({ name: str(action['name']) ?? '', primary: action['primaryForGoal'] === true })),
      }));
    },

    async setConversionGoal(ref, goal) {
      await call('/ads/conversions/goals', json('PATCH', { ...ref, goals: [goal] }));
    },

    // Senza una configurazione di fatturazione approvata Google non fa partire niente. I nomi dentro la risposta non sono
    // tutti documentati: se non si capisce, ready resta null e non si avvisa.
    async billing(ref) {
      const body = await call<Record<string, unknown>>(`/ads/accounts/billing?${refQuery(ref)}`);
      const setups = list(body, 'billingSetups', 'setups');
      const budgets = list(body, 'accountBudgets', 'budgets');
      if (setups.length === 0 && budgets.length === 0 && !('billingSetups' in body) && !('setups' in body)) return { ready: null, detail: null };
      const approved = setups.some((setup) => String(setup['status'] ?? '').toUpperCase().startsWith('APPROVED'));
      const pending = setups.find((setup) => String(setup['status'] ?? '').toUpperCase() === 'PENDING');
      return { ready: approved || budgets.length > 0, detail: pending ? 'PENDING' : approved ? null : 'MISSING' };
    },

    async invitations(ref) {
      const body = await call<unknown>(`/ads/accounts/user-invitations?${refQuery(ref)}`);
      return list(body, 'invitations', 'data').map(invitation);
    },

    async invite(ref, email, role) {
      const body = await call<Record<string, unknown>>('/ads/accounts/user-invitations', json('POST', { ...ref, emailAddress: email, accessRole: role }));
      return invitation({ ...body, emailAddress: body['emailAddress'] ?? email, accessRole: body['accessRole'] ?? role });
    },

    async cancelInvitation(ref, invitationId) {
      await call(`/ads/accounts/user-invitations?${refQuery(ref, { invitationId })}`, { method: 'DELETE' }).catch(ignore404);
    },
  };
}

// Il client solo se c'è la chiave: senza, le rotte rispondono che la pubblicità non è configurata (le simulate vanno lo stesso).
export const adsClient =
  (apiKey: string | undefined) =>
  (): ZernioAds => {
    if (!apiKey) throw new ApiError(503, 'ADS_NOT_CONFIGURED', 'La pubblicità non è configurata: manca ZERNIO_API_KEY.');
    return zernioAds(apiKey);
  };
