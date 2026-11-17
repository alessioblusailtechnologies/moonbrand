import {
  adLocations,
  type AdBidding,
  type AdCampaignType,
  type AdGoal,
  type AdImageRole,
  type AdSpec,
} from '@moonbrand/shared/domain/ads';

import { geoTargeting } from './zernio-ads';

// Il corpo di POST /v1/ads/create per ogni tipo di campagna Google (docs.zernio.com/platforms/google-ads/create-ads,
// performance-max, demand-gen). Le immagini arrivano già caricate (indirizzi pubblici). Le date non si mandano: inizio e
// fine li fa rispettare il nostro scheduler, perché Zernio non le documenta per Google.

export interface CampaignInput {
  accountId: string;
  adAccountId: string;
  name: string;
  campaignType: AdCampaignType;
  goal: AdGoal;
  spec: AdSpec;
  dailyBudget: number;
  // ACTIVE solo per rete di ricerca e Display che partono oggi; gli altri nascono in pausa.
  status: 'ACTIVE' | 'PAUSED';
  images: Record<AdImageRole, string[]>;
  cards: { headline: string; imageUrl: string; finalUrl?: string }[];
}

// L'offerta nei campi di Zernio. auto: niente, decide Google.
export function biddingFields(bidding: AdBidding | undefined, type: AdCampaignType): Record<string, unknown> {
  switch (bidding?.strategy) {
    case 'max_clicks':
      return { bidStrategy: 'LOWEST_COST_WITH_BID_CAP', bidAmount: bidding.amount };
    case 'max_conversions':
      return { bidStrategy: 'LOWEST_COST_WITHOUT_CAP' };
    case 'target_cpa':
      return { bidStrategy: 'COST_CAP', bidAmount: bidding.amount };
    case 'target_roas':
      return { bidStrategy: 'LOWEST_COST_WITH_MIN_ROAS', roasAverageFloor: bidding.roas };
    case 'manual_cpc':
      return type === 'search' || type === 'display' ? { manualCpc: { maxCpc: bidding.amount } } : {};
    default:
      return type === 'pmax' ? { bidStrategy: 'LOWEST_COST_WITHOUT_CAP' } : {};
  }
}

// Dove e a chi, per rete di ricerca e Display: luoghi, esclusi, raggio, lingue, età, genere, reddito, interessi, pubblici.
function targeting(spec: AdSpec, type: AdCampaignType): Record<string, unknown> {
  const locations = adLocations(spec);
  const excluded = spec.excludedLocations ?? [];
  const out: Record<string, unknown> = { ...geoTargeting(locations), languages: spec.languages };
  if (excluded.length && type !== 'demand_gen') out['excludedLocations'] = geoTargeting(excluded);
  if (type === 'search' || type === 'display') {
    if (spec.radius?.length) {
      out['customLocations'] = spec.radius.map((r) => ({ latitude: r.latitude, longitude: r.longitude, radius: r.radius, distanceUnit: r.unit === 'mi' ? 'mile' : 'kilometer' }));
    }
    if (spec.ageMin) out['ageMin'] = spec.ageMin;
    if (spec.ageMax) out['ageMax'] = spec.ageMax;
    if (spec.genders?.length === 1) out['gender'] = spec.genders[0];
    if (spec.incomeTop10) out['incomeTier'] = 'top_10';
    if (spec.interests?.length) out['interests'] = spec.interests.map((item) => ({ id: item.id, name: item.name }));
    if (spec.audiences?.length) out['audienceInclude'] = spec.audiences.map((item) => item.id);
    if (spec.excludedAudiences?.length) out['audienceExclude'] = spec.excludedAudiences.map((item) => item.id);
  }
  return out;
}

// Un titolo fissato in una posizione: Zernio vuole il primo titolo libero, quindi si mette davanti uno senza posizione.
function pinned(texts: string[], pins: (number | null)[] | undefined, kind: 'HEADLINE' | 'DESCRIPTION') {
  const items = texts.map((text, index) => ({ text, pin: pins?.[index] ?? null }));
  const first = items.findIndex((item) => item.pin === null);
  if (first > 0) items.unshift(...items.splice(first, 1));
  const [head, ...rest] = items;
  return {
    first: head?.text ?? '',
    rest: rest.map((item) => (item.pin ? { text: item.text, pinnedField: `${kind}_${item.pin}` } : item.text)),
  };
}

const keywords = (list: AdSpec['keywords'] | undefined) => (list ?? []).map((keyword) => ({ text: keyword.text, matchType: keyword.match }));

export function campaignBody(input: CampaignInput): Record<string, unknown> {
  const { spec, campaignType: type } = input;
  const countries = adLocations(spec)
    .filter((location) => location.type === 'country')
    .map((location) => location.id);
  const common: Record<string, unknown> = {
    accountId: input.accountId,
    adAccountId: input.adAccountId,
    name: input.name,
    campaignName: input.name,
    adSetName: input.name,
    campaignType: type,
    budgetAmount: input.dailyBudget,
    budgetType: 'daily',
    status: input.status,
    ...(type !== 'pmax' && { goal: input.goal }),
    ...biddingFields(spec.bidding, type),
    locationTargetingType: spec.presenceOnly === false ? 'presence_or_interest' : 'presence',
    // Senza paesi Google Search e Display vanno negli Stati Uniti: se ci sono solo città o regioni restano quelle.
    ...(countries.length && { countries }),
    targeting: targeting(spec, type),
  };

  if (type === 'search' || type === 'display') {
    const headlines = pinned(spec.headlines, type === 'search' ? spec.headlinePins : undefined, 'HEADLINE');
    const descriptions = pinned(spec.descriptions, type === 'search' ? spec.descriptionPins : undefined, 'DESCRIPTION');
    const body: Record<string, unknown> = {
      ...common,
      headline: headlines.first,
      additionalHeadlines: headlines.rest,
      body: descriptions.first,
      additionalDescriptions: descriptions.rest,
      linkUrl: spec.linkUrl,
    };
    if (type === 'search') {
      Object.assign(body, {
        keywords: keywords(spec.keywords),
        ...(spec.negativeKeywords?.length && { campaignNegativeKeywords: keywords(spec.negativeKeywords) }),
        ...(spec.sitelinks?.length && { sitelinks: spec.sitelinks }),
        ...(spec.callouts?.length && { callouts: spec.callouts }),
        ...(spec.snippet?.values.length && { structuredSnippets: [spec.snippet] }),
        ...(spec.network && { networkSettings: spec.network }),
      });
    } else {
      Object.assign(body, {
        businessName: spec.businessName,
        ...(spec.longHeadlines?.[0] && { longHeadline: spec.longHeadlines[0] }),
        images: { landscape: input.images.landscape[0], square: input.images.square[0] },
      });
    }
    return body;
  }

  if (type === 'pmax') {
    return {
      ...common,
      assetGroup: {
        name: input.name,
        businessName: spec.businessName,
        finalUrl: spec.linkUrl,
        longHeadline: spec.longHeadlines?.[0],
        headlines: spec.headlines,
        descriptions: spec.descriptions,
        images: { landscape: input.images.landscape, square: input.images.square, logo: input.images.logo },
        ...(spec.youtubeVideoIds?.[0] && { youtubeVideoId: spec.youtubeVideoIds[0] }),
      },
    };
  }

  // Demand Gen: il pubblico sta nel gruppo di annunci.
  const audience: Record<string, unknown> = {};
  if (spec.audiences?.length) audience['userLists'] = spec.audiences.map((item) => item.id);
  if (spec.interests?.length) audience['userInterests'] = spec.interests.map((item) => item.id);
  if (spec.ageRanges?.length) audience['ageRanges'] = spec.ageRanges.map((range) => (range.max ? range : { min: range.min }));
  if (spec.genders?.length) audience['genders'] = spec.genders;
  const carousel = input.cards.length >= 2;
  return {
    ...common,
    demandGen: {
      adGroupName: input.name,
      finalUrl: spec.linkUrl,
      businessName: spec.businessName,
      headlines: carousel ? spec.headlines.slice(0, 1) : spec.headlines,
      descriptions: carousel ? spec.descriptions.slice(0, 1) : spec.descriptions,
      ...(spec.longHeadlines?.length && !carousel && { longHeadlines: spec.longHeadlines }),
      ...(spec.callToAction && { callToAction: spec.callToAction }),
      images: carousel
        ? { logo: input.images.logo.slice(0, 1) }
        : { landscape: input.images.landscape, square: input.images.square, portrait: input.images.portrait, logo: input.images.logo.slice(0, 1) },
      ...(!carousel && spec.youtubeVideoIds?.length && { youtubeVideoIds: spec.youtubeVideoIds }),
      ...(carousel && { carouselCards: input.cards }),
      ...(spec.channels?.length && { channels: spec.channels }),
      ...(Object.keys(audience).length && { audience }),
    },
  };
}

// Quello che Performance Max non prende alla creazione e va aggiunto al gruppo di asset subito dopo: i titoli lunghi oltre il
// primo, le immagini verticali e i video oltre il primo.
export function pmaxExtraAssets(spec: AdSpec, images: Record<AdImageRole, string[]>): Record<string, unknown>[] {
  return [
    ...(spec.longHeadlines ?? []).slice(1).map((text) => ({ fieldType: 'LONG_HEADLINE', text })),
    ...images.portrait.map((imageUrl) => ({ fieldType: 'PORTRAIT_MARKETING_IMAGE', imageUrl })),
    ...(spec.youtubeVideoIds ?? []).slice(1).map((youtubeVideoId) => ({ fieldType: 'YOUTUBE_VIDEO', youtubeVideoId })),
  ];
}

// I dispositivi per PUT /campaigns/{id}/targeting: quelli non mandati vengono spenti. Tutti o nessuno: niente da mandare.
export function devicesTargeting(devices: AdSpec['devices']): string[] | null {
  if (!devices?.length || devices.length >= 4) return null;
  return devices;
}

// I luoghi per PUT /campaigns/{id}/targeting.
export function locationsTargeting(spec: Pick<AdSpec, 'locations' | 'countries' | 'excludedLocations'>): Record<string, unknown> {
  return {
    locations: geoTargeting(adLocations(spec)),
    excludedLocations: geoTargeting(spec.excludedLocations ?? []),
  };
}
