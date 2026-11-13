import type { Locale } from '../i18n/locales';

// I video di tendenza che il brand trova cercando una parola chiave, con SocialCrawl: solo link, copertina e numeri.
// Il video non si tiene: si guarda con il player ufficiale del social e si scarica solo quando l'utente lo ricrea.
export type TrendPlatform = 'tiktok' | 'instagram';

// Il mercato è la lingua dei post del brand: il paese che ne viene (it → IT, fr → FR) più Stati Uniti e Regno Unito, i
// più popolari, che valgono per tutti.
export type TrendMarket = Locale;

// Le ricerche delle tendenze, per brand: le prime freePerMonth del mese (a Roma) sono gratis, le altre scalano credits
// crediti dal piano. Una ricerca costa a noi 1-3 centesimi di SocialCrawl (le due chiamate, TikTok e Instagram). perDay:
// il tetto contro gli abusi, anche a pagamento. Le fallite non contano e non si pagano.
export const TREND_SEARCH = { freePerMonth: 10, credits: 5, perDay: 30 } as const;

export const TREND_COUNTRIES: Record<TrendMarket, string[]> = {
  it: ['IT', 'US', 'GB'],
  fr: ['FR', 'US', 'GB'],
  en: ['US', 'GB'],
};

export interface Trend {
  id: string;
  // La parola chiave che l'ha trovato per ultima.
  query: string;
  platform: TrendPlatform;
  // L'id del video sul social (TikTok) o lo shortcode del reel (Instagram): serve al player ufficiale.
  externalId: string;
  url: string;
  author: string;
  caption: string;
  // Copertina firmata dal nostro Storage; null se non si è potuta salvare.
  thumbnailUrl: string | null;
  // Il paese del video quando il social lo dice (TikTok sì, Instagram no).
  country: string | null;
  durationSeconds: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  music: string | null;
  publishedAt: string | null;
  collectedAt: string;
}

// Una parola cercata dal brand che ha ancora video nella tab: i filtri sopra la griglia.
export interface TrendSearchSummary {
  query: string;
  count: number;
  searchedAt: string;
}

// Lo shortcode del reel dall'URL di Instagram (/reel/<code>/ o /p/<code>/).
export function instagramCode(url: string): string | null {
  return /instagram\.com\/(?:reel|reels|p)\/([^/?#]+)/.exec(url)?.[1] ?? null;
}

// Il player ufficiale da mettere in un iframe. Per TikTok il player/v1, che dice via postMessage quando va in errore
// (succede spesso al primo caricamento, anche con embed/v2): lo studio allora mostra la copertina (trends-panel.ts).
export const TIKTOK_PLAYER_ORIGIN = 'https://www.tiktok.com';

export function trendEmbedUrl(trend: Pick<Trend, 'platform' | 'externalId'>): string {
  return trend.platform === 'tiktok'
    ? `${TIKTOK_PLAYER_ORIGIN}/player/v1/${trend.externalId}?autoplay=0&loop=1&rel=0&music_info=1&description=0&native_context_menu=0`
    : `https://www.instagram.com/reel/${trend.externalId}/embed/`;
}
