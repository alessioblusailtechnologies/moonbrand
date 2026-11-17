// La pubblicità dei brand, via Zernio Ads (PIANO-ADS.md §0). Google per intero: rete di ricerca, Display, Performance Max
// e Demand Gen. La campagna la crea moonbrand, la spesa la addebita Google sull'account Google Ads del cliente e non passa
// dai crediti.

export type AdPlatform = 'google';
export type AdCampaignType = 'search' | 'display' | 'pmax' | 'demand_gen';
export const AD_CAMPAIGN_TYPES: readonly AdCampaignType[] = ['search', 'display', 'pmax', 'demand_gen'];

// Gli obiettivi che Zernio accetta per Google. Performance Max non ne ha (punta alle conversioni).
export type AdGoal = 'traffic' | 'awareness' | 'engagement';

// draft: bozza. scheduled: creata su Google in pausa, parte da sola il giorno d'inizio. in_review: Google la sta
// controllando. ended: passata la data di fine. failed: la creazione non è riuscita (error dice perché). deleted: tolta
// da Google, resta nell'elenco.
export type AdStatus = 'draft' | 'scheduled' | 'in_review' | 'active' | 'paused' | 'ended' | 'rejected' | 'failed' | 'deleted';

export const AD_LIVE: readonly AdStatus[] = ['scheduled', 'in_review', 'active', 'paused'];

// I limiti di Google per tipo di campagna, dopo aver tolto i doppioni.
export const AD_LIMITS = {
  name: 80,
  // Al giorno, in unità intere della valuta dell'account (euro, non centesimi). Il massimo è nostro, per gli errori di battitura.
  dailyBudget: { min: 1, max: 10000 },
  // Giorni al massimo di una campagna con la fine: oltre si lascia senza fine e si ferma a mano.
  days: 365,
  keywords: { min: 1, max: 1000, chars: 80 },
  negativeKeywords: { max: 1000 },
  businessName: 25,
  sitelinks: { max: 20, text: 25, description: 35 },
  callouts: { max: 20, chars: 25 },
  snippetValues: { min: 3, max: 10, chars: 25 },
  youtube: { max: 5 },
  search: { headlines: { min: 3, max: 15, chars: 30 }, longHeadlines: { min: 0, max: 0, chars: 90 }, descriptions: { min: 2, max: 4, chars: 90 } },
  display: { headlines: { min: 1, max: 5, chars: 30 }, longHeadlines: { min: 1, max: 1, chars: 90 }, descriptions: { min: 1, max: 5, chars: 90 } },
  pmax: { headlines: { min: 3, max: 15, chars: 30 }, longHeadlines: { min: 1, max: 5, chars: 90 }, descriptions: { min: 2, max: 5, chars: 90 } },
  demand_gen: { headlines: { min: 1, max: 5, chars: 40 }, longHeadlines: { min: 0, max: 5, chars: 90 }, descriptions: { min: 1, max: 5, chars: 90 } },
  carousel: { min: 2, max: 10 },
} as const;

// Le immagini che servono per tipo: quante al minimo e al massimo per formato. Le proporzioni le fa il server, tagliando
// al centro l'immagine scelta.
export type AdImageRole = 'landscape' | 'square' | 'portrait' | 'logo';
export const AD_IMAGE_ASPECT: Record<AdImageRole, number> = { landscape: 1.91, square: 1, portrait: 0.8, logo: 1 };
export const AD_IMAGES: Record<AdCampaignType, Partial<Record<AdImageRole, { min: number; max: number }>>> = {
  search: {},
  display: { landscape: { min: 1, max: 1 }, square: { min: 1, max: 1 } },
  pmax: { landscape: { min: 1, max: 20 }, square: { min: 1, max: 20 }, portrait: { min: 0, max: 20 }, logo: { min: 1, max: 5 } },
  demand_gen: { landscape: { min: 0, max: 20 }, square: { min: 0, max: 20 }, portrait: { min: 0, max: 20 }, logo: { min: 1, max: 1 } },
};

// Il logo del brand, al posto di un file: il server lo prende dall'identità visiva.
export const BRAND_LOGO = 'brand:logo';

export type KeywordMatch = 'broad' | 'phrase' | 'exact';

export interface AdKeyword {
  text: string;
  match: KeywordMatch;
}

// Un luogo di Google: country con id ISO (IT), gli altri con l'id numerico di Google (geo target constant).
export type AdLocationType = 'country' | 'region' | 'city' | 'zip' | 'metro';
export interface AdLocation {
  id: string;
  name: string;
  type: AdLocationType;
  // Dove sta (Lombardia, Italia), per riconoscere due città con lo stesso nome.
  path?: string;
}

// Un raggio intorno a un punto (rete di ricerca e Display).
export interface AdRadius {
  label: string;
  latitude: number;
  longitude: number;
  radius: number;
  unit: 'km' | 'mi';
}

// Un interesse (affinità o in-market) o un pubblico del brand (lista clienti, visitatori del sito, simili).
export interface AdAudienceRef {
  id: string;
  name: string;
}

export type AdGender = 'male' | 'female';
export type AdDevice = 'MOBILE' | 'DESKTOP' | 'TABLET' | 'CONNECTED_TV';
export const AD_DEVICES: readonly AdDevice[] = ['MOBILE', 'DESKTOP', 'TABLET', 'CONNECTED_TV'];
export type DemandGenChannel = 'youtube_in_stream' | 'youtube_in_feed' | 'youtube_shorts' | 'discover' | 'gmail' | 'display';
export const DEMAND_GEN_CHANNELS: readonly DemandGenChannel[] = ['youtube_in_stream', 'youtube_in_feed', 'youtube_shorts', 'discover', 'gmail', 'display'];
// Le fasce d'età di Google (Demand Gen); per Search e Display si usano età minima e massima.
export const AGE_RANGES = [
  { min: 18, max: 24 },
  { min: 25, max: 34 },
  { min: 35, max: 44 },
  { min: 45, max: 54 },
  { min: 55, max: 64 },
  { min: 65, max: null },
] as const;

// Le offerte in parole semplici. auto: decide Google (non si manda niente). max_clicks: più clic con un tetto al costo per
// clic (su Demand Gen è il CPC target). max_conversions: più conversioni. target_cpa: un costo per conversione. target_roas:
// un ritorno sulla spesa (2 = 200%). manual_cpc: costo per clic fisso.
export type AdBidStrategy = 'auto' | 'max_clicks' | 'max_conversions' | 'target_cpa' | 'target_roas' | 'manual_cpc';
export const AD_BID_STRATEGIES: Record<AdCampaignType, readonly AdBidStrategy[]> = {
  search: ['auto', 'max_clicks', 'max_conversions', 'target_cpa', 'target_roas', 'manual_cpc'],
  display: ['auto', 'max_clicks', 'max_conversions', 'target_cpa', 'target_roas', 'manual_cpc'],
  pmax: ['max_conversions', 'target_cpa', 'target_roas'],
  demand_gen: ['max_conversions', 'max_clicks', 'target_cpa', 'target_roas'],
};
export interface AdBidding {
  strategy: AdBidStrategy;
  // Il tetto o il costo per clic (max_clicks, manual_cpc) o per conversione (target_cpa), nella valuta dell'account.
  amount?: number | null;
  // target_roas: 2 = 200%.
  roas?: number | null;
}

export interface AdSitelink {
  text: string;
  linkUrl: string;
  description1?: string;
  description2?: string;
}

// Le intestazioni di Google per gli snippet strutturati, così come le vuole l'API.
export const SNIPPET_HEADERS = [
  'Amenities',
  'Brands',
  'Courses',
  'Degree programs',
  'Destinations',
  'Featured hotels',
  'Insurance coverage',
  'Models',
  'Neighborhoods',
  'Service catalog',
  'Shows',
  'Styles',
  'Types',
] as const;
export interface AdSnippet {
  header: (typeof SNIPPET_HEADERS)[number];
  values: string[];
}

export interface AdImages {
  landscape: string[];
  square: string[];
  portrait: string[];
  logo: string[];
}

// Una scheda del carosello Demand Gen: titolo e immagine propri.
export interface AdCarouselCard {
  headline: string;
  image: string;
  finalUrl?: string;
}

// La campagna come la mandiamo a Google. Ogni tipo usa i suoi campi (vedi AD_LIMITS e AD_IMAGES); gli altri restano vuoti.
// Le immagini sono percorsi nella cartella del brand (o BRAND_LOGO).
export interface AdSpec {
  linkUrl: string;
  // Annuncio. Il primo titolo e la prima descrizione sono i principali. headlinePins: per la rete di ricerca, la posizione
  // fissa di un titolo (1-3) o null; descriptionPins lo stesso (1-2).
  headlines: string[];
  headlinePins?: (number | null)[];
  descriptions: string[];
  descriptionPins?: (number | null)[];
  longHeadlines?: string[];
  businessName?: string;
  images?: AdImages;
  youtubeVideoIds?: string[];
  callToAction?: string | null;
  carouselCards?: AdCarouselCard[];
  // Rete di ricerca.
  keywords: AdKeyword[];
  negativeKeywords?: AdKeyword[];
  sitelinks?: AdSitelink[];
  callouts?: string[];
  snippet?: AdSnippet | null;
  network?: { searchPartners: boolean; displayNetwork: boolean };
  // Dove e a chi. countries resta per le bozze di prima; locations le sostituisce (i paesi ci stanno con type country).
  countries: string[];
  locations?: AdLocation[];
  excludedLocations?: AdLocation[];
  radius?: AdRadius[];
  // presence: solo chi è nei luoghi; presence_or_interest: anche chi li cerca o ci si interessa.
  presenceOnly?: boolean;
  languages: string[];
  ageMin?: number | null;
  ageMax?: number | null;
  ageRanges?: { min: number; max: number | null }[];
  genders?: AdGender[];
  incomeTop10?: boolean;
  interests?: AdAudienceRef[];
  audiences?: AdAudienceRef[];
  excludedAudiences?: AdAudienceRef[];
  devices?: AdDevice[];
  channels?: DemandGenChannel[];
  // Offerta e tracciamento.
  bidding?: AdBidding;
  trackingUrlTemplate?: string;
  finalUrlSuffix?: string;
}

/** @deprecated: il nome di prima, per la rete di ricerca. */
export type SearchSpec = AdSpec;

// Le metriche lette da Zernio, nella valuta dell'account; null finché Google non ne dà.
export interface AdMetrics {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cpc: number | null;
  conversions?: number | null;
  cpm?: number | null;
}

export interface Ad {
  id: string;
  platform: AdPlatform;
  campaignType: AdCampaignType;
  goal: AdGoal;
  source: 'studio' | 'chat';
  name: string;
  spec: AdSpec;
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

// Una bozza, dallo studio.
export interface AdDraft {
  name: string;
  campaignType: AdCampaignType;
  goal: AdGoal;
  spec: AdSpec;
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

// I luoghi della campagna: quelli scelti, o i paesi delle bozze di prima.
export function adLocations(spec: Pick<AdSpec, 'locations' | 'countries'>): AdLocation[] {
  if (spec.locations?.length) return spec.locations;
  return (spec.countries ?? []).map((code) => ({ id: code, name: code, type: 'country' as const }));
}

// I passaggi del wizard di una campagna. In ognuno la persona può scrivere cosa vuole e l'AI compila i campi. Ogni tipo
// usa i suoi (adSteps).
export const AD_STEPS = ['goal', 'ad', 'keywords', 'audience', 'budget', 'extras', 'review'] as const;
export type AdStep = (typeof AD_STEPS)[number];

export function adSteps(type: AdCampaignType): AdStep[] {
  return AD_STEPS.filter((step) => step !== 'keywords' || type === 'search');
}

// La bozza mentre si compila: ogni campo può mancare. locationNames: luoghi detti a parole dall'AI, che lo studio cerca
// tra quelli di Google.
export interface AdDraftInProgress {
  name?: string;
  campaignType?: AdCampaignType;
  goal?: AdGoal;
  spec?: Partial<AdSpec> & { locationNames?: string[] };
  dailyBudget?: number | null;
  startsOn?: string;
  endsOn?: string | null;
}

// Quello che l'AI cambia: solo i campi che ha toccato. reply è la frase che la persona legge sotto la sua richiesta.
export interface AdAssistResult {
  reply: string;
  patch: AdDraftInProgress;
}

// --- Dopo l'avvio: gestione, letture e strumenti di Google ---

// Un'immagine che si può usare in un annuncio: dai contenuti del brand, il logo o una caricata apposta.
export interface AdImageOption {
  file: string;
  url: string;
  // Proporzione larghezza/altezza, se si sa.
  aspect: number | null;
  source: 'content' | 'logo' | 'upload';
  title: string;
}

// Un giorno di metriche della campagna.
export interface AdDailyMetrics extends AdMetrics {
  date: string;
}

// La quota di impressioni sulla rete di ricerca: 0.42 = 42%.
export interface AdImpressionShare {
  share: number | null;
  lostToBudget: number | null;
  lostToRank: number | null;
  top: number | null;
  absoluteTop: number | null;
}

export interface AdInsights {
  daily: AdDailyMetrics[];
  impressionShare: AdImpressionShare | null;
  // Il punteggio dell'annuncio per Performance Max (POOR, AVERAGE, GOOD, EXCELLENT).
  adStrength: string | null;
  // Revisione di Google, se l'annuncio ha problemi.
  policy: { approval: string | null; topics: string[] } | null;
}

// Una parola chiave sulla campagna, con il punteggio di qualità e i numeri degli ultimi 30 giorni.
export interface AdKeywordRow {
  id: string;
  text: string;
  match: KeywordMatch;
  status: 'active' | 'paused';
  negative: boolean;
  qualityScore: number | null;
  clicks: number | null;
  impressions: number | null;
  cost: number | null;
  conversions: number | null;
  firstPageCpc: number | null;
}

// Un termine che le persone hanno cercato davvero prima di vedere l'annuncio.
export interface AdSearchTerm {
  term: string;
  status: string;
  match: string | null;
  impressions: number;
  clicks: number;
  cost: number;
  conversions: number;
}

// Un'idea dal Keyword Planner di Google.
export interface AdKeywordIdea {
  text: string;
  monthlySearches: number | null;
  competition: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNSPECIFIED' | null;
  lowBid: number | null;
  highBid: number | null;
}

// Le estensioni attaccate alla campagna su Google: resource è il collegamento da togliere.
export interface AdExtensions {
  sitelinks: (AdSitelink & { resource: string })[];
  callouts: { text: string; resource: string }[];
  snippets: (AdSnippet & { resource: string })[];
}

// Un consiglio di Google sull'account o su una campagna.
export interface AdRecommendation {
  resource: string;
  type: string;
  campaignId: string | null;
  // La campagna nostra, se il consiglio è su una di quelle create da moonbrand.
  adId: string | null;
  impact: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
}

// Un pubblico del brand su Google.
export type AdAudienceType = 'customer_list' | 'website' | 'lookalike';
export interface AdAudience {
  id: string;
  // L'id di Google, da usare nel targeting.
  platformId: string | null;
  name: string;
  type: AdAudienceType | string;
  size: number | null;
  status: string | null;
}

// Una conversione (azione di conversione di Google) e gli obiettivi dell'account.
export interface AdConversionAction {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
}
export interface AdConversionGoal {
  category: string;
  origin: string;
  biddable: boolean;
  actions: { name: string; primary: boolean }[];
}
export const CONVERSION_TYPES = ['PURCHASE', 'SIGNUP', 'IMPORTED_LEAD', 'BOOK_APPOINTMENT', 'SUBSCRIBE_PAID'] as const;

// La fatturazione dell'account Google Ads: se manca un metodo di pagamento le campagne non partono.
export interface AdBilling {
  ready: boolean | null;
  detail: string | null;
}

// Chi ha accesso all'account Google Ads, invitato da qui.
export type AdAccessRole = 'ADMIN' | 'STANDARD' | 'READ_ONLY' | 'EMAIL_ONLY';
export interface AdInvitation {
  id: string;
  email: string;
  role: AdAccessRole | string;
  status: string;
}
