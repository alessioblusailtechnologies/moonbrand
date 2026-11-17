import {
  AD_BID_STRATEGIES,
  AD_DEVICES,
  AD_IMAGES,
  AD_LIMITS,
  adLocations,
  DEMAND_GEN_CHANNELS,
  type Ad,
  type AdAudienceRef,
  type AdBidStrategy,
  type AdCampaignType,
  type AdCarouselCard,
  type AdDevice,
  type AdDraft,
  type AdDraftInProgress,
  type AdGender,
  type AdGoal,
  type AdImageRole,
  type AdImages,
  type AdKeyword,
  type AdLocation,
  type AdRadius,
  type AdSitelink,
  type AdSnippet,
  type AdSpec,
  type DemandGenChannel,
  type KeywordMatch,
} from '@moonbrand/shared/domain/ads';

// La campagna nel wizard: i campi come li scrive la persona, i numeri come testo finché non si salva. Tiene tutti i
// campi di tutti i tipi: al salvataggio si manda solo quello che serve al tipo scelto (draftOf).
export interface WizardForm {
  name: string;
  type: AdCampaignType;
  goal: AdGoal;
  linkUrl: string;
  headlines: string[];
  headlinePins: (number | null)[];
  descriptions: string[];
  descriptionPins: (number | null)[];
  longHeadlines: string[];
  businessName: string;
  images: AdImages;
  youtube: string[];
  callToAction: string;
  carousel: AdCarouselCard[];
  keywords: string;
  match: KeywordMatch;
  negatives: string;
  sitelinks: AdSitelink[];
  callouts: string[];
  snippet: AdSnippet | null;
  searchPartners: boolean;
  displayNetwork: boolean;
  locations: AdLocation[];
  excludedLocations: AdLocation[];
  radius: AdRadius[];
  presenceOnly: boolean;
  languages: string[];
  ageMin: number | null;
  ageMax: number | null;
  ageRanges: { min: number; max: number | null }[];
  genders: AdGender[];
  incomeTop10: boolean;
  interests: AdAudienceRef[];
  audiences: AdAudienceRef[];
  excludedAudiences: AdAudienceRef[];
  devices: AdDevice[];
  channels: DemandGenChannel[];
  strategy: AdBidStrategy;
  bidAmount: string;
  roasPercent: string;
  trackingUrlTemplate: string;
  finalUrlSuffix: string;
  dailyBudget: string;
  startsOn: string;
  endsOn: string;
  noEnd: boolean;
}

export type TextListKey = 'headlines' | 'descriptions' | 'longHeadlines' | 'callouts';

export const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(date);
export const addDays = (from: string, days: number) => day(new Date(Date.parse(from) + days * 86_400_000));

const emptyImages = (): AdImages => ({ landscape: [], square: [], portrait: [], logo: [] });

// I limiti dei testi per il tipo: la rete di ricerca non ha titoli lunghi.
export function textLimits(type: AdCampaignType) {
  const limits = AD_LIMITS[type];
  return {
    headlines: limits.headlines,
    descriptions: limits.descriptions,
    longHeadlines: 'longHeadlines' in limits ? limits.longHeadlines : { min: 0, max: 0, chars: 90 },
  };
}

// Le liste di testi portate al minimo del tipo (righe vuote da compilare), senza superare il massimo.
function fit(items: string[], min: number, max: number): string[] {
  const kept = items.slice(0, Math.max(max, 0));
  return kept.length >= min ? kept : [...kept, ...Array<string>(min - kept.length).fill('')];
}

function fitPins(pins: (number | null)[], length: number): (number | null)[] {
  return Array.from({ length }, (_, i) => pins[i] ?? null);
}

// Cambiando tipo le liste si adattano ai limiti nuovi e le immagini oltre il massimo si tolgono.
export function withType(form: WizardForm, type: AdCampaignType): WizardForm {
  const limits = textLimits(type);
  const headlines = fit(form.headlines, limits.headlines.min, limits.headlines.max);
  const descriptions = fit(form.descriptions, limits.descriptions.min, limits.descriptions.max);
  const images = emptyImages();
  for (const role of Object.keys(images) as AdImageRole[]) {
    const rule = AD_IMAGES[type][role];
    images[role] = rule ? form.images[role].slice(0, rule.max) : form.images[role];
  }
  const strategies = AD_BID_STRATEGIES[type];
  return {
    ...form,
    type,
    headlines,
    headlinePins: fitPins(form.headlinePins, headlines.length),
    descriptions,
    descriptionPins: fitPins(form.descriptionPins, descriptions.length),
    longHeadlines: fit(form.longHeadlines, Math.max(limits.longHeadlines.min, type === 'search' ? 0 : 1), limits.longHeadlines.max),
    images,
    strategy: strategies.includes(form.strategy) ? form.strategy : strategies[0]!,
  };
}

export function newForm(defaults: { linkUrl: string; language: string }, today: string, countryName: (code: string) => string): WizardForm {
  const country = defaults.language === 'fr' ? 'FR' : defaults.language === 'en' ? 'GB' : 'IT';
  const form: WizardForm = {
    name: '',
    type: 'search',
    goal: 'traffic',
    linkUrl: defaults.linkUrl,
    headlines: [],
    headlinePins: [],
    descriptions: [],
    descriptionPins: [],
    longHeadlines: [],
    businessName: '',
    images: emptyImages(),
    youtube: [],
    callToAction: '',
    carousel: [],
    keywords: '',
    match: 'phrase',
    negatives: '',
    sitelinks: [],
    callouts: [],
    snippet: null,
    searchPartners: true,
    displayNetwork: false,
    locations: [{ id: country, name: countryName(country), type: 'country' }],
    excludedLocations: [],
    radius: [],
    presenceOnly: true,
    languages: [defaults.language],
    ageMin: null,
    ageMax: null,
    ageRanges: [],
    genders: [],
    incomeTop10: false,
    interests: [],
    audiences: [],
    excludedAudiences: [],
    devices: [...AD_DEVICES],
    channels: [...DEMAND_GEN_CHANNELS],
    strategy: 'auto',
    bidAmount: '',
    roasPercent: '',
    trackingUrlTemplate: '',
    finalUrlSuffix: '',
    dailyBudget: '10',
    startsOn: today,
    endsOn: addDays(today, 13),
    noEnd: false,
  };
  return withType(form, 'search');
}

export function formOf(ad: Ad, today: string, countryName: (code: string) => string): WizardForm {
  const spec = ad.spec;
  const base = newForm({ linkUrl: spec.linkUrl, language: spec.languages[0] ?? 'it' }, today, countryName);
  const form: WizardForm = {
    ...base,
    name: ad.name,
    type: ad.campaignType ?? 'search',
    goal: ad.goal ?? 'traffic',
    headlines: [...spec.headlines],
    headlinePins: [...(spec.headlinePins ?? [])],
    descriptions: [...spec.descriptions],
    descriptionPins: [...(spec.descriptionPins ?? [])],
    longHeadlines: [...(spec.longHeadlines ?? [])],
    businessName: spec.businessName ?? '',
    images: { ...emptyImages(), ...spec.images },
    youtube: [...(spec.youtubeVideoIds ?? [])],
    callToAction: spec.callToAction ?? '',
    carousel: (spec.carouselCards ?? []).map((card) => ({ ...card })),
    keywords: spec.keywords.map((keyword) => keyword.text).join('\n'),
    match: spec.keywords[0]?.match ?? 'phrase',
    negatives: (spec.negativeKeywords ?? []).map((keyword) => keyword.text).join('\n'),
    sitelinks: (spec.sitelinks ?? []).map((link) => ({ ...link })),
    callouts: [...(spec.callouts ?? [])],
    snippet: spec.snippet ? { header: spec.snippet.header, values: [...spec.snippet.values] } : null,
    searchPartners: spec.network?.searchPartners ?? true,
    displayNetwork: spec.network?.displayNetwork ?? false,
    locations: adLocations(spec).map((place) => (place.type === 'country' && place.name === place.id ? { ...place, name: countryName(place.id) } : place)),
    excludedLocations: [...(spec.excludedLocations ?? [])],
    radius: [...(spec.radius ?? [])],
    presenceOnly: spec.presenceOnly ?? true,
    languages: spec.languages.length ? [...spec.languages] : base.languages,
    ageMin: spec.ageMin ?? null,
    ageMax: spec.ageMax ?? null,
    ageRanges: [...(spec.ageRanges ?? [])],
    genders: [...(spec.genders ?? [])],
    incomeTop10: spec.incomeTop10 ?? false,
    interests: [...(spec.interests ?? [])],
    audiences: [...(spec.audiences ?? [])],
    excludedAudiences: [...(spec.excludedAudiences ?? [])],
    devices: spec.devices?.length ? [...spec.devices] : [...AD_DEVICES],
    channels: spec.channels?.length ? [...spec.channels] : [...DEMAND_GEN_CHANNELS],
    strategy: spec.bidding?.strategy ?? 'auto',
    bidAmount: spec.bidding?.amount != null ? String(spec.bidding.amount) : '',
    roasPercent: spec.bidding?.roas != null ? String(Math.round(spec.bidding.roas * 100)) : '',
    trackingUrlTemplate: spec.trackingUrlTemplate ?? '',
    finalUrlSuffix: spec.finalUrlSuffix ?? '',
    dailyBudget: String(ad.dailyBudget),
    startsOn: ad.startsOn < today ? today : ad.startsOn,
    endsOn: ad.endsOn ?? addDays(today, 13),
    noEnd: ad.endsOn === null,
  };
  return withType(form, form.type);
}

const texts = (items: string[]) => items.map((text) => text.trim()).filter(Boolean);

// Le parole chiave una per riga; via le virgolette e le parentesi della sintassi di Google.
export function keywordsOf(text: string, match: KeywordMatch): AdKeyword[] {
  const seen = new Set<string>();
  return text
    .split('\n')
    .map((line) => line.trim().replace(/^["[+]+|["\]]+$/g, '').trim())
    .filter((line) => {
      const key = line.toLowerCase();
      if (!line || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((line) => ({ text: line, match }));
}

// I pin dei testi tenuti: quelli delle righe non vuote, e solo se ce n'è almeno uno.
function pinsOf(items: string[], pins: (number | null)[]): (number | null)[] | undefined {
  const kept = items.map((text, i) => (text.trim() ? (pins[i] ?? null) : undefined)).filter((pin): pin is number | null => pin !== undefined);
  return kept.some((pin) => pin !== null) ? kept : undefined;
}

const positive = (value: string): number | null => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
};

// La bozza da salvare: per ogni tipo solo i suoi campi.
export function draftOf(f: WizardForm): AdDraft {
  const type = f.type;
  const limits = textLimits(type);
  const amount = positive(f.bidAmount);
  const roas = positive(f.roasPercent);
  const allDevices = f.devices.length === 0 || f.devices.length === AD_DEVICES.length;
  const allChannels = f.channels.length === 0 || f.channels.length === DEMAND_GEN_CHANNELS.length;
  const headlines = f.headlines.slice(0, limits.headlines.max);
  const descriptions = f.descriptions.slice(0, limits.descriptions.max);
  const spec: AdSpec = {
    linkUrl: f.linkUrl.trim(),
    headlines: texts(headlines),
    descriptions: texts(descriptions),
    keywords: [],
    countries: f.locations.filter((place) => place.type === 'country').map((place) => place.id),
    locations: f.locations,
    excludedLocations: f.excludedLocations,
    presenceOnly: f.presenceOnly,
    languages: f.languages,
    bidding: {
      strategy: f.strategy,
      ...(amount !== null && (f.strategy === 'max_clicks' || f.strategy === 'target_cpa' || f.strategy === 'manual_cpc') && { amount }),
      ...(roas !== null && f.strategy === 'target_roas' && { roas: roas / 100 }),
    },
    ...(f.trackingUrlTemplate.trim() && { trackingUrlTemplate: f.trackingUrlTemplate.trim() }),
    ...(f.finalUrlSuffix.trim() && { finalUrlSuffix: f.finalUrlSuffix.trim().replace(/^\?/, '') }),
  };
  const people = () => ({
    ...(f.ageMin !== null && { ageMin: f.ageMin }),
    ...(f.ageMax !== null && { ageMax: f.ageMax }),
    ...(f.genders.length === 1 && { genders: f.genders }),
    ...(f.incomeTop10 && { incomeTop10: true }),
    ...(f.interests.length && { interests: f.interests }),
    ...(f.audiences.length && { audiences: f.audiences }),
    ...(f.excludedAudiences.length && { excludedAudiences: f.excludedAudiences }),
  });
  const visual = (roles: AdImageRole[]) => {
    const images = emptyImages();
    for (const role of roles) images[role] = f.images[role];
    return images;
  };
  if (type === 'search') {
    const sitelinks = f.sitelinks
      .map((link) => ({
        text: link.text.trim(),
        linkUrl: link.linkUrl.trim(),
        ...(link.description1?.trim() && { description1: link.description1.trim() }),
        ...(link.description2?.trim() && { description2: link.description2.trim() }),
      }))
      .filter((link) => link.text && link.linkUrl);
    const snippetValues = texts(f.snippet?.values ?? []);
    Object.assign(spec, {
      headlinePins: pinsOf(headlines, f.headlinePins),
      descriptionPins: pinsOf(descriptions, f.descriptionPins),
      keywords: keywordsOf(f.keywords, f.match),
      negativeKeywords: keywordsOf(f.negatives, 'phrase'),
      ...(sitelinks.length && { sitelinks }),
      ...(texts(f.callouts).length && { callouts: texts(f.callouts) }),
      ...(f.snippet && snippetValues.length && { snippet: { header: f.snippet.header, values: snippetValues } }),
      network: { searchPartners: f.searchPartners, displayNetwork: f.displayNetwork },
      ...(!allDevices && { devices: f.devices }),
      ...(f.radius.length && { radius: f.radius }),
      ...people(),
    } satisfies Partial<AdSpec>);
  } else if (type === 'display') {
    Object.assign(spec, {
      longHeadlines: texts(f.longHeadlines).slice(0, 1),
      businessName: f.businessName.trim(),
      images: visual(['landscape', 'square']),
      ...(!allDevices && { devices: f.devices }),
      ...(f.radius.length && { radius: f.radius }),
      ...people(),
    } satisfies Partial<AdSpec>);
  } else if (type === 'pmax') {
    Object.assign(spec, {
      longHeadlines: texts(f.longHeadlines).slice(0, limits.longHeadlines.max),
      businessName: f.businessName.trim(),
      images: visual(['landscape', 'square', 'portrait', 'logo']),
      ...(f.youtube.length && { youtubeVideoIds: f.youtube }),
    } satisfies Partial<AdSpec>);
  } else {
    const cards = f.carousel.filter((card) => card.headline.trim() || card.image);
    Object.assign(spec, {
      longHeadlines: texts(f.longHeadlines).slice(0, limits.longHeadlines.max),
      businessName: f.businessName.trim(),
      images: visual(['landscape', 'square', 'portrait', 'logo']),
      ...(f.youtube.length && { youtubeVideoIds: f.youtube }),
      ...(f.callToAction.trim() && { callToAction: f.callToAction.trim() }),
      ...(cards.length && { carouselCards: cards.map((card) => ({ headline: card.headline.trim(), image: card.image, ...(card.finalUrl?.trim() && { finalUrl: card.finalUrl.trim() }) })) }),
      ...(f.ageRanges.length && { ageRanges: f.ageRanges }),
      ...(f.genders.length === 1 && { genders: f.genders }),
      ...(f.interests.length && { interests: f.interests }),
      ...(f.audiences.length && { audiences: f.audiences }),
      ...(!allChannels && { channels: f.channels }),
    } satisfies Partial<AdSpec>);
  }
  return {
    name: f.name.trim(),
    campaignType: type,
    goal: f.goal,
    spec,
    dailyBudget: Math.round(Number(f.dailyBudget)),
    startsOn: f.startsOn,
    endsOn: f.noEnd ? null : f.endsOn || null,
  };
}

// La bozza com'è adesso, per l'AI: anche incompleta.
export function progressOf(f: WizardForm): AdDraftInProgress {
  const draft = draftOf(f);
  return { ...draft, dailyBudget: Number.isFinite(draft.dailyBudget) && draft.dailyBudget > 0 ? draft.dailyBudget : null };
}

const cut = (items: string[], chars: number, max: number) => items.map((text) => text.slice(0, chars)).slice(0, max);

// I campi cambiati dall'AI nel modulo: solo quelli che ha mandato. I luoghi detti a parole tornano a parte, da cercare.
export function applyPatch(form: WizardForm, patch: AdDraftInProgress, countryName: (code: string) => string): { form: WizardForm; locationNames: string[] } {
  let next: WizardForm = { ...form };
  if (patch.campaignType && patch.campaignType !== next.type) next = withType(next, patch.campaignType);
  const spec = patch.spec ?? {};
  const limits = textLimits(next.type);
  if (patch.name !== undefined) next.name = patch.name.slice(0, AD_LIMITS.name);
  if (patch.goal) next.goal = patch.goal;
  if (spec.linkUrl !== undefined) next.linkUrl = spec.linkUrl;
  if (spec.headlines) {
    next.headlines = fit(cut(spec.headlines, limits.headlines.chars, limits.headlines.max), limits.headlines.min, limits.headlines.max);
    next.headlinePins = fitPins(spec.headlinePins ?? [], next.headlines.length);
  } else if (spec.headlinePins) next.headlinePins = fitPins(spec.headlinePins, next.headlines.length);
  if (spec.descriptions) {
    next.descriptions = fit(cut(spec.descriptions, limits.descriptions.chars, limits.descriptions.max), limits.descriptions.min, limits.descriptions.max);
    next.descriptionPins = fitPins(spec.descriptionPins ?? [], next.descriptions.length);
  } else if (spec.descriptionPins) next.descriptionPins = fitPins(spec.descriptionPins, next.descriptions.length);
  if (spec.longHeadlines) next.longHeadlines = fit(cut(spec.longHeadlines, limits.longHeadlines.chars, limits.longHeadlines.max), 0, limits.longHeadlines.max);
  if (spec.businessName !== undefined) next.businessName = spec.businessName.slice(0, AD_LIMITS.businessName);
  if (spec.callToAction !== undefined) next.callToAction = spec.callToAction ?? '';
  if (spec.youtubeVideoIds) next.youtube = spec.youtubeVideoIds.slice(0, AD_LIMITS.youtube.max);
  if (spec.keywords) {
    next.keywords = spec.keywords.map((keyword) => keyword.text).join('\n');
    if (spec.keywords[0]) next.match = spec.keywords[0].match;
  }
  if (spec.negativeKeywords) next.negatives = spec.negativeKeywords.map((keyword) => keyword.text).join('\n');
  if (spec.sitelinks) next.sitelinks = spec.sitelinks.slice(0, AD_LIMITS.sitelinks.max).map((link) => ({ ...link }));
  if (spec.callouts) next.callouts = cut(spec.callouts, AD_LIMITS.callouts.chars, AD_LIMITS.callouts.max);
  if (spec.snippet !== undefined) next.snippet = spec.snippet ? { header: spec.snippet.header, values: cut(spec.snippet.values, AD_LIMITS.snippetValues.chars, AD_LIMITS.snippetValues.max) } : null;
  if (spec.network) {
    next.searchPartners = spec.network.searchPartners;
    next.displayNetwork = spec.network.displayNetwork;
  }
  if (spec.countries?.length && !spec.locations) {
    const countries = spec.countries.map((code) => code.toUpperCase());
    next.locations = [
      ...next.locations.filter((place) => place.type !== 'country' || countries.includes(place.id)),
      ...countries.filter((code) => !next.locations.some((place) => place.id === code)).map((code) => ({ id: code, name: countryName(code), type: 'country' as const })),
    ];
  }
  if (spec.locations) next.locations = spec.locations;
  if (spec.excludedLocations) next.excludedLocations = spec.excludedLocations;
  if (spec.presenceOnly !== undefined) next.presenceOnly = spec.presenceOnly;
  if (spec.languages?.length) next.languages = spec.languages;
  if (spec.ageMin !== undefined) next.ageMin = spec.ageMin ?? null;
  if (spec.ageMax !== undefined) next.ageMax = spec.ageMax ?? null;
  if (spec.ageRanges) next.ageRanges = spec.ageRanges;
  if (spec.genders) next.genders = spec.genders.length === 1 ? spec.genders : [];
  if (spec.incomeTop10 !== undefined) next.incomeTop10 = spec.incomeTop10;
  if (spec.devices) next.devices = spec.devices.length ? spec.devices : [...AD_DEVICES];
  if (spec.channels) next.channels = spec.channels.length ? spec.channels : [...DEMAND_GEN_CHANNELS];
  if (spec.bidding) {
    const strategies = AD_BID_STRATEGIES[next.type];
    if (strategies.includes(spec.bidding.strategy)) next.strategy = spec.bidding.strategy;
    if (spec.bidding.amount != null) next.bidAmount = String(spec.bidding.amount);
    if (spec.bidding.roas != null) next.roasPercent = String(Math.round(spec.bidding.roas * 100));
  }
  if (spec.trackingUrlTemplate !== undefined) next.trackingUrlTemplate = spec.trackingUrlTemplate;
  if (spec.finalUrlSuffix !== undefined) next.finalUrlSuffix = spec.finalUrlSuffix;
  if (patch.dailyBudget != null) next.dailyBudget = String(patch.dailyBudget);
  if (patch.startsOn) next.startsOn = patch.startsOn;
  if (patch.endsOn !== undefined) {
    next.noEnd = patch.endsOn === null;
    if (patch.endsOn) next.endsOn = patch.endsOn;
  }
  return { form: next, locationNames: spec.locationNames ?? [] };
}

// L'id di un video YouTube da un link incollato (watch, youtu.be, shorts, embed) o già un id.
export function youtubeId(value: string): string | null {
  const text = value.trim();
  if (/^[\w-]{11}$/.test(text)) return text;
  const match = /(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/.exec(text);
  return match?.[1] ?? null;
}

// Cosa manca perché Google accetti la campagna: la persona lo vede nel riepilogo, e l'avvio aspetta.
export type Problem =
  | { key: 'name' | 'link' | 'keywords' | 'businessName' | 'longHeadline' | 'budget' | 'bid' | 'roas' | 'locations' | 'languages' | 'dates' | 'carousel' | 'tracking' }
  | { key: 'headlines' | 'descriptions'; n: number }
  | { key: 'image'; role: AdImageRole; n: number };

export function problemsOf(f: WizardForm): Problem[] {
  const problems: Problem[] = [];
  const limits = textLimits(f.type);
  if (!f.name.trim()) problems.push({ key: 'name' });
  if (!/^https?:\/\/\S+\.\S+/.test(f.linkUrl.trim())) problems.push({ key: 'link' });
  if (texts(f.headlines).length < limits.headlines.min) problems.push({ key: 'headlines', n: limits.headlines.min });
  if (texts(f.descriptions).length < limits.descriptions.min) problems.push({ key: 'descriptions', n: limits.descriptions.min });
  if (f.type !== 'search') {
    if (!f.businessName.trim()) problems.push({ key: 'businessName' });
    if ((f.type === 'display' || f.type === 'pmax') && texts(f.longHeadlines).length < 1) problems.push({ key: 'longHeadline' });
    for (const [role, rule] of Object.entries(AD_IMAGES[f.type]) as [AdImageRole, { min: number; max: number }][]) {
      if (f.images[role].length < rule.min) problems.push({ key: 'image', role, n: rule.min });
    }
    if (f.type === 'demand_gen') {
      const cards = f.carousel.filter((card) => card.headline.trim() || card.image);
      if (cards.length && (cards.length < AD_LIMITS.carousel.min || cards.some((card) => !card.headline.trim() || !card.image))) problems.push({ key: 'carousel' });
    }
  }
  if (f.type === 'search' && keywordsOf(f.keywords, f.match).length < 1) problems.push({ key: 'keywords' });
  if (!f.locations.length) problems.push({ key: 'locations' });
  if (!f.languages.length) problems.push({ key: 'languages' });
  const daily = Number(f.dailyBudget);
  if (!Number.isInteger(daily) || daily < AD_LIMITS.dailyBudget.min || daily > AD_LIMITS.dailyBudget.max) problems.push({ key: 'budget' });
  if ((f.strategy === 'max_clicks' || f.strategy === 'target_cpa' || f.strategy === 'manual_cpc') && positive(f.bidAmount) === null) problems.push({ key: 'bid' });
  if (f.strategy === 'target_roas' && positive(f.roasPercent) === null) problems.push({ key: 'roas' });
  if (!f.noEnd && f.endsOn && f.endsOn < f.startsOn) problems.push({ key: 'dates' });
  if (f.trackingUrlTemplate.trim() && !f.trackingUrlTemplate.includes('{lpurl}')) problems.push({ key: 'tracking' });
  return problems;
}
