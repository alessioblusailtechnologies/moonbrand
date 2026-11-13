// La pubblicità dei brand, via Zernio Ads (PIANO-ADS.md). Si parte da Google Search: la campagna la crea moonbrand, la
// spesa la addebita Google sull'account Google Ads del cliente e non passa dai crediti.

export type AdPlatform = 'google';
export type AdCampaignType = 'search';

// draft: bozza, non ancora su Google. in_review: creata, Google la sta controllando. ended: passata la data di fine.
// failed: la creazione non è riuscita (error dice perché). deleted: tolta da Google, resta nell'elenco.
export type AdStatus = 'draft' | 'in_review' | 'active' | 'paused' | 'ended' | 'rejected' | 'failed' | 'deleted';

export const AD_LIVE: readonly AdStatus[] = ['in_review', 'active', 'paused'];

// I limiti di Google per gli annunci adattabili della rete di ricerca, dopo aver tolto i doppioni.
export const SEARCH_LIMITS = {
  headlines: { min: 3, max: 15, chars: 30 },
  descriptions: { min: 2, max: 4, chars: 90 },
  keywords: { min: 1, max: 100, chars: 80 },
  name: 80,
  // Al giorno, in unità intere della valuta dell'account (euro, non centesimi). Il massimo è nostro, per gli errori di battitura.
  dailyBudget: { min: 1, max: 1000 },
  // Giorni al massimo di una campagna con la fine: oltre si lascia senza fine e si ferma a mano.
  days: 365,
} as const;

export type KeywordMatch = 'broad' | 'phrase' | 'exact';

export interface AdKeyword {
  text: string;
  match: KeywordMatch;
}

// La campagna di ricerca come la mandiamo a Google: il primo titolo e la prima descrizione sono i principali.
export interface SearchSpec {
  headlines: string[];
  descriptions: string[];
  keywords: AdKeyword[];
  linkUrl: string;
  // ISO a due lettere (IT) e codici lingua di Google (it, en).
  countries: string[];
  languages: string[];
}

// Le metriche lette da Zernio, nella valuta dell'account; null finché Google non ne dà.
export interface AdMetrics {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
}

export interface Ad {
  id: string;
  platform: AdPlatform;
  campaignType: AdCampaignType;
  source: 'studio' | 'chat';
  name: string;
  spec: SearchSpec;
  dailyBudget: number;
  currency: string | null;
  // Giorni, AAAA-MM-GG. endsOn null: finché non la fermi.
  startsOn: string;
  endsOn: string | null;
  status: AdStatus;
  reviewStatus: string | null;
  rejectionReason: string | null;
  metrics: AdMetrics | null;
  syncedAt: string | null;
  launchedAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// Il collegamento pubblicitario del brand. adAccountId null: collegato, ma l'account Google Ads non è ancora scelto.
export interface AdConnection {
  platform: AdPlatform;
  name: string | null;
  adAccountId: string | null;
  adAccountName: string | null;
  currency: string | null;
  lost: boolean;
  simulated: boolean;
}

// Un account Google Ads raggiungibile dal collegamento (anche i clienti sotto un account amministratore).
export interface AdAccount {
  id: string;
  name: string;
  currency: string | null;
  status: string | null;
  selected: boolean;
}

// Una bozza, dallo studio o dalla chat.
export interface AdDraft {
  name: string;
  spec: SearchSpec;
  dailyBudget: number;
  startsOn: string;
  endsOn: string | null;
}

// Quanto si spende al massimo: null se la campagna non ha fine.
export function maxSpend(ad: Pick<AdDraft, 'dailyBudget' | 'startsOn' | 'endsOn'>): number | null {
  if (!ad.endsOn) return null;
  const days = Math.round((Date.parse(ad.endsOn) - Date.parse(ad.startsOn)) / 86_400_000) + 1;
  return days > 0 ? days * ad.dailyBudget : null;
}
