import type { AdAccount, AdMetrics, SearchSpec } from '@moonbrand/shared/domain/ads';

import { ApiError } from '../../errors';

// Zernio Ads (docs.zernio.com/platforms/google-ads): il collegamento Google Ads del profilo del brand e le campagne
// create da noi. Il profilo Zernio del brand si chiama con l'id del brand, come per i social (social/zernio.ts).

const API = 'https://zernio.com/api/v1';
const TIMEOUT_MS = 30_000;

// Le risposte d'errore di Zernio: error è il messaggio, code quello stabile (ad_account_not_selected, rate_limited…).
interface ZernioError {
  error?: string;
  code?: string;
  type?: string;
  platformError?: unknown;
  details?: unknown;
}

// Gli errori che la persona può risolvere, detti in chiaro; gli altri con il messaggio di Zernio.
const MESSAGES: Record<string, string> = {
  ad_account_not_selected: 'Questo account Google Ads non è tra quelli collegati: ricollega Google Ads e sceglilo.',
  ad_account_unusable: 'L’account Google Ads non si può usare: controlla in Google Ads metodo di pagamento e stato dell’account.',
  payment_required: 'L’account Google Ads non ha un metodo di pagamento: aggiungilo in Google Ads → Fatturazione.',
  ads_addon_required: 'La pubblicità non è attiva sul nostro servizio di collegamento: scrivici a info@moonbrand.app.',
  ads_allowance_exceeded: 'La pubblicità non è momentaneamente disponibile: scrivici a info@moonbrand.app.',
  rate_limited: 'Google sta ricevendo troppe richieste: riprova tra un minuto.',
  invalid_credentials: 'Il collegamento con Google Ads è scaduto: ricollegalo.',
  insufficient_permissions: 'Google non ha dato i permessi per la pubblicità: ricollega Google Ads e lascia spuntata la casella di Google Ads.',
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

export interface GoogleSearchCampaign {
  accountId: string;
  adAccountId: string;
  name: string;
  spec: SearchSpec;
  dailyBudget: number;
  startsOn: string;
  endsOn: string | null;
}

export interface ZernioAds {
  // L'account googleads già nel profilo del brand, se c'è; altrimenti la pagina di consenso di Google.
  connectGoogle(brandId: string, redirectUrl: string): Promise<{ authUrl: string } | { accountId: string; name: string | null }>;
  // L'account googleads del profilo del brand con quell'id, solo se c'è davvero.
  googleAccount(brandId: string, accountId: string): Promise<{ accountId: string; name: string | null } | null>;
  adAccounts(accountId: string): Promise<AdAccount[]>;
  disconnect(accountId: string): Promise<void>;
  createSearch(campaign: GoogleSearchCampaign, idempotencyKey: string): Promise<ZernioAd>;
  ad(adId: string): Promise<ZernioAd | null>;
  setCampaignStatus(campaignId: string, platform: string, status: 'ACTIVE' | 'PAUSED'): Promise<void>;
  deleteAd(adId: string): Promise<void>;
  deleteCampaign(campaignId: string, platform: string): Promise<void>;
}

const num = (value: unknown): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

// I nomi dentro metrics non sono documentati: si prendono i più probabili.
export function normalizeMetrics(raw: Record<string, unknown> | null | undefined): AdMetrics | null {
  if (!raw) return null;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = num(raw[key]);
      if (value !== null) return value;
    }
    return null;
  };
  const spend = pick('spend', 'amountSpent', 'cost', 'spent');
  const impressions = pick('impressions');
  const clicks = pick('clicks', 'linkClicks');
  const ctr = pick('ctr') ?? (impressions && clicks !== null ? (clicks / impressions) * 100 : null);
  const cpc = pick('cpc') ?? (clicks && spend !== null ? spend / clicks : null);
  return { spend, impressions, clicks, ctr, cpc };
}

// Il corpo di POST /v1/ads/create per una campagna di ricerca: il primo titolo e la prima descrizione sono i principali.
export function searchBody(campaign: GoogleSearchCampaign): Record<string, unknown> {
  const { spec } = campaign;
  return {
    accountId: campaign.accountId,
    adAccountId: campaign.adAccountId,
    name: campaign.name,
    campaignName: campaign.name,
    adSetName: campaign.name,
    campaignType: 'search',
    goal: 'traffic',
    budgetAmount: campaign.dailyBudget,
    budgetType: 'daily',
    headline: spec.headlines[0],
    additionalHeadlines: spec.headlines.slice(1),
    body: spec.descriptions[0],
    additionalDescriptions: spec.descriptions.slice(1),
    linkUrl: spec.linkUrl,
    keywords: spec.keywords.map((keyword) => ({ text: keyword.text, matchType: keyword.match })),
    // Senza paesi Google Search va negli Stati Uniti: si mandano sempre.
    countries: spec.countries,
    locationTargetingType: 'presence',
    targeting: { countries: spec.countries, languages: spec.languages },
    startDate: campaign.startsOn,
    ...(campaign.endsOn && { endDate: campaign.endsOn }),
    status: 'ACTIVE',
  };
}

export function zernioAds(apiKey: string): ZernioAds {
  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => {
      throw new ZernioAdsError(502, null, 'Il servizio della pubblicità non risponde: riprova.', null);
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ZernioError | null;
      const code = body?.code ?? null;
      const message =
        (code && MESSAGES[code]) ??
        (response.status === 404 ? 'Su Google Ads non c’è più.' : `Google Ads non ha accettato la richiesta${body?.error ? `: ${body.error}` : ''}.`);
      const status = response.status === 404 ? 404 : response.status === 429 ? 429 : response.status >= 500 ? 502 : 400;
      throw new ZernioAdsError(status, code, message, body);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  };

  const profileId = async (brandId: string, create: boolean): Promise<string | null> => {
    const { profiles } = await call<{ profiles: { _id: string }[] }>(`/profiles?name=${encodeURIComponent(brandId)}`);
    if (profiles[0] || !create) return profiles[0]?._id ?? null;
    const created = await call<{ profile?: { _id: string }; _id?: string }>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: brandId, description: 'Brand di moonbrand', timezone: 'Europe/Rome' }),
    });
    return created.profile?._id ?? created._id ?? null;
  };

  return {
    async connectGoogle(brandId, redirectUrl) {
      const profile = await profileId(brandId, true);
      if (!profile) throw new ZernioAdsError(502, null, 'Il collegamento di Google Ads non è riuscito: riprova.', null);
      const query = new URLSearchParams({ profileId: profile, redirect_url: redirectUrl });
      const result = await call<{ authUrl?: string; alreadyConnected?: boolean; accountId?: string; displayName?: string; username?: string }>(
        `/connect/googleads/ads?${query}`,
      );
      if (result.alreadyConnected && result.accountId) return { accountId: result.accountId, name: result.displayName ?? result.username ?? null };
      if (!result.authUrl) throw new ZernioAdsError(502, null, 'Il collegamento di Google Ads non è riuscito: riprova.', null);
      return { authUrl: result.authUrl };
    },

    async googleAccount(brandId, accountId) {
      const profile = await profileId(brandId, false);
      if (!profile) return null;
      const query = new URLSearchParams({ profileId: profile, platform: 'googleads' });
      const { accounts } = await call<{ accounts: { _id: string; platform?: string; displayName?: string; username?: string; isActive?: boolean }[] }>(
        `/accounts?${query}`,
      );
      const account = accounts.find((item) => item._id === accountId && (!item.platform || item.platform === 'googleads'));
      if (!account || account.isActive === false) return null;
      return { accountId: account._id, name: account.displayName ?? account.username ?? null };
    },

    async adAccounts(accountId) {
      const query = new URLSearchParams({ accountId });
      const { accounts } = await call<{ accounts: { id: string; name?: string; currency?: string; accountStatus?: string; selected?: boolean }[] }>(
        `/ads/accounts?${query}`,
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
      await call(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' }).catch((error: unknown) => {
        if (!(error instanceof ZernioAdsError && error.status === 404)) throw error;
      });
    },

    async createSearch(campaign, idempotencyKey) {
      const { ad } = await call<{ ad: ZernioAd }>('/ads/create', {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey },
        body: JSON.stringify(searchBody(campaign)),
      });
      return ad;
    },

    async ad(adId) {
      try {
        const { ad } = await call<{ ad: ZernioAd }>(`/ads/${encodeURIComponent(adId)}`);
        return ad;
      } catch (error) {
        if (error instanceof ZernioAdsError && error.status === 404) return null;
        throw error;
      }
    },

    async setCampaignStatus(campaignId, platform, status) {
      await call(`/ads/campaigns/${encodeURIComponent(campaignId)}/status`, { method: 'PUT', body: JSON.stringify({ status, platform }) });
    },

    async deleteAd(adId) {
      await call(`/ads/${encodeURIComponent(adId)}`, { method: 'DELETE' }).catch((error: unknown) => {
        if (!(error instanceof ZernioAdsError && error.status === 404)) throw error;
      });
    },

    // Google cancella solo le campagne vuote (409 invalid_resource_state): in quel caso resta in pausa, che basta.
    async deleteCampaign(campaignId, platform) {
      await call(`/ads/campaigns/${encodeURIComponent(campaignId)}`, { method: 'DELETE', body: JSON.stringify({ platform }) }).catch((error: unknown) => {
        if (!(error instanceof ZernioAdsError && (error.status === 404 || error.zernioCode === 'invalid_resource_state' || error.status === 400))) throw error;
      });
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
