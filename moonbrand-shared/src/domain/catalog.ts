import { palette } from '../design/tokens';
import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { catalog } from '../i18n/messages/catalog';
import { translate, type MessageKey } from '../i18n/translate';
import type { BrandDraft, BrandKind, ChannelId, Channels, Palette, SignalSource, TypographyId } from './brand';

// I testi del catalogo sono nei dizionari (i18n/messages/catalog): le funzioni qui sotto li danno nella lingua chiesta,
// di base l'italiano, che è quella dei prompt del motore.

const KINDS: BrandKind[] = ['person', 'company', 'client'];

export function kindOptions(locale: Locale = DEFAULT_LOCALE): { kind: BrandKind; title: string; meta: string; label: string }[] {
  return KINDS.map((kind) => ({ kind, ...catalog[locale].kinds[kind] }));
}

export function kindLabel(kind: BrandKind, locale: Locale = DEFAULT_LOCALE): string {
  return catalog[locale].kinds[kind]?.label ?? '';
}

export const CHANNELS: { id: ChannelId; name: string }[] = [
  { id: 'linkedin', name: 'LinkedIn' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'tiktok', name: 'TikTok' },
  { id: 'x', name: 'X' },
  { id: 'pinterest', name: 'Pinterest' },
];

// Gli esempi di post dell'onboarding: al massimo MAX_EXAMPLES, uno per canale sui primi canali scelti; con un canale
// solo, tutti su quello.
export const MAX_EXAMPLES = 2;

export function exampleChannels(channels: readonly ChannelId[]): ChannelId[] {
  return channels.slice(0, MAX_EXAMPLES);
}

export function examplesPerChannel(channels: readonly ChannelId[]): number {
  return Math.max(1, Math.floor(MAX_EXAMPLES / Math.max(1, exampleChannels(channels).length)));
}

export function channelName(id: ChannelId): string {
  return CHANNELS.find((channel) => channel.id === id)?.name ?? id;
}

// Obiettivi e pubblici proposti: si salvano con l'id (goals.sellMore, audiences.consumers) e si mostrano con
// positioningLabel. Quelli scritti da chi usa l'app o letti dal sito restano testo, nella lingua in cui sono scritti.
type GoalId = keyof (typeof catalog)['it']['goals'];
type AudienceId = keyof (typeof catalog)['it']['audiences'];

const goals = (ids: GoalId[]) => ids.map((id) => `goals.${id}`);
const audiences = (ids: AudienceId[]) => ids.map((id) => `audiences.${id}`);

const BUSINESS_GOALS = goals(['awareness', 'sellMore', 'loyalty', 'launch', 'hiring', 'community']);

export const GOALS: Record<BrandKind, string[]> = {
  person: goals(['authority', 'clients', 'hiring', 'funding', 'community']),
  company: BUSINESS_GOALS,
  client: BUSINESS_GOALS,
};

const BUSINESS_AUDIENCES = audiences(['consumers', 'businesses', 'resellers', 'candidates', 'local']);

export const AUDIENCES: Record<BrandKind, string[]> = {
  person: audiences(['founders', 'operations', 'developers', 'investors', 'candidates']),
  company: BUSINESS_AUDIENCES,
  client: BUSINESS_AUDIENCES,
};

const POSITIONING_ID = /^(goals|audiences)\.\w+$/;

// Un obiettivo o un pubblico come si legge: l'etichetta se è una voce del catalogo, altrimenti il testo com'è.
export function positioningLabel(value: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!POSITIONING_ID.test(value)) return value;
  const label = translate(locale, `catalog.${value}` as MessageKey);
  return label === `catalog.${value}` ? value : label;
}

export const THEME_COLORS = [palette.navy700, palette.orange500, palette.lime400, palette.mint400, palette.yellow400, palette.navy500];

export const PALETTE_PRESETS: Palette[] = [
  { id: 'indigo-coral', name: 'Indigo e coral', colors: ['#1C2150', '#2F3452', '#FF6B35', '#ECEEEF'], origin: 'preset' },
  { id: 'navy-lime', name: 'Navy e lime', colors: ['#2F3452', '#D9E05B', '#6DD47E', '#FFFFFF'], origin: 'preset' },
  { id: 'navy-grey', name: 'Solo navy e grigio', colors: ['#2F3452', '#8A8F9A', '#CDD1D4', '#ECEEEF'], origin: 'preset' },
];

const PRESET_NAMES: Record<string, keyof (typeof catalog)['it']['palettes']> = {
  'indigo-coral': 'indigoCoral',
  'navy-lime': 'navyLime',
  'navy-grey': 'navyGrey',
};

// Il nome di una palette nella lingua chiesta: quelle preimpostate, e quelle dal sito o scelte a mano finché hanno il nome
// che dà l'app («Dal sito», «I miei colori»); un nome dato da chi la usa resta com'è.
export function paletteName(value: Pick<Palette, 'id' | 'name' | 'origin'>, locale: Locale = DEFAULT_LOCALE): string {
  const names = catalog[locale].palettes;
  if (value.origin === 'preset') return PRESET_NAMES[value.id] ? names[PRESET_NAMES[value.id]] : value.name;
  return value.name === catalog.it.palettes[value.origin] ? names[value.origin] : value.name;
}

// I ruoli dei quattro colori della palette, nell'ordine.
export function paletteSlotLabels(locale: Locale = DEFAULT_LOCALE): [string, string, string, string] {
  const { main, secondary, accent, background } = catalog[locale].paletteSlots;
  return [main, secondary, accent, background];
}

export interface FontFace {
  family: string;
  weight: number;
}

export const TYPOGRAPHY_OPTIONS: { id: TypographyId; heading: FontFace; body: FontFace }[] = [
  { id: 'inter', heading: { family: 'Inter Tight', weight: 700 }, body: { family: 'Inter', weight: 400 } },
  { id: 'archivo', heading: { family: 'Archivo', weight: 800 }, body: { family: 'Archivo', weight: 400 } },
  { id: 'space-grotesk', heading: { family: 'Space Grotesk', weight: 700 }, body: { family: 'Inter', weight: 400 } },
  { id: 'manrope', heading: { family: 'Manrope', weight: 800 }, body: { family: 'Manrope', weight: 400 } },
  { id: 'fraunces', heading: { family: 'Fraunces', weight: 700 }, body: { family: 'Inter', weight: 400 } },
  { id: 'dm-serif', heading: { family: 'DM Serif Display', weight: 400 }, body: { family: 'DM Sans', weight: 400 } },
  { id: 'playfair', heading: { family: 'Playfair Display', weight: 700 }, body: { family: 'Source Sans 3', weight: 400 } },
  { id: 'ibm-plex', heading: { family: 'IBM Plex Sans', weight: 700 }, body: { family: 'IBM Plex Sans', weight: 400 } },
];

const TYPOGRAPHY_NAMES: Record<TypographyId, keyof (typeof catalog)['it']['typography']> = {
  inter: 'inter',
  archivo: 'archivo',
  'space-grotesk': 'spaceGrotesk',
  manrope: 'manrope',
  fraunces: 'fraunces',
  'dm-serif': 'dmSerif',
  playfair: 'playfair',
  'ibm-plex': 'ibmPlex',
};

export function typographyName(id: TypographyId, locale: Locale = DEFAULT_LOCALE): string {
  return catalog[locale].typography[TYPOGRAPHY_NAMES[id]];
}

export function typographyOption(id: TypographyId | undefined) {
  return TYPOGRAPHY_OPTIONS.find((option) => option.id === id) ?? TYPOGRAPHY_OPTIONS[0];
}

export const LINE_FONTS: { id: string; family: string }[] = [
  { id: 'newsreader', family: 'Newsreader' },
  { id: 'source-serif', family: 'Source Serif 4' },
  { id: 'fraunces', family: 'Fraunces' },
  { id: 'playfair', family: 'Playfair Display' },
  { id: 'dm-serif', family: 'DM Serif Display' },
  { id: 'instrument-serif', family: 'Instrument Serif' },
  { id: 'eb-garamond', family: 'EB Garamond' },
  { id: 'cormorant', family: 'Cormorant Garamond' },
  { id: 'lora', family: 'Lora' },
  { id: 'inter-tight', family: 'Inter Tight' },
  { id: 'inter', family: 'Inter' },
  { id: 'archivo', family: 'Archivo' },
  { id: 'space-grotesk', family: 'Space Grotesk' },
  { id: 'manrope', family: 'Manrope' },
  { id: 'dm-sans', family: 'DM Sans' },
  { id: 'work-sans', family: 'Work Sans' },
  { id: 'plus-jakarta', family: 'Plus Jakarta Sans' },
  { id: 'source-sans', family: 'Source Sans 3' },
  { id: 'ibm-plex-sans', family: 'IBM Plex Sans' },
  { id: 'syne', family: 'Syne' },
  { id: 'ibm-plex-mono', family: 'IBM Plex Mono' },
  { id: 'jetbrains-mono', family: 'JetBrains Mono' },
  { id: 'space-mono', family: 'Space Mono' },
  { id: 'dm-mono', family: 'DM Mono' },
];

export function lineFontFamily(id: string): string {
  return LINE_FONTS.find((font) => font.id === id)?.family ?? id;
}

export function lineFontId(family: string): string | null {
  return LINE_FONTS.find((font) => font.family === family)?.id ?? null;
}

// Le fonti dei segnali proposte: si salvano con l'id (milestones vale per tutti i tipi di brand, cambia solo come si
// legge) e l'etichetta italiana, che resta per chi legge i dati senza dizionario.
type SourceId = keyof (typeof catalog)['it']['sources'] | 'milestones';

const source = (kind: BrandKind, id: SourceId, enabled = true): SignalSource => ({ id, label: sourceText(kind, id, DEFAULT_LOCALE), enabled });

function sourceText(kind: BrandKind, id: SourceId, locale: Locale): string {
  return id === 'milestones' ? catalog[locale].milestones[kind] : catalog[locale].sources[id];
}

const BUSINESS_SOURCES = (kind: BrandKind): SignalSource[] => [
  source(kind, 'tradePress'),
  source(kind, 'reviews'),
  source(kind, 'socialTrends'),
  source(kind, 'events'),
  source(kind, 'seasons'),
  source(kind, 'milestones'),
];

const DEFAULT_SOURCES: Record<BrandKind, SignalSource[]> = {
  person: [
    source('person', 'businessPress'),
    source('person', 'tradePress'),
    source('person', 'linkedinNetwork'),
    source('person', 'industryEvents'),
    source('person', 'xDiscussions', false),
    source('person', 'milestones'),
  ],
  company: BUSINESS_SOURCES('company'),
  client: BUSINESS_SOURCES('client'),
};

// Una fonte come si legge: quelle del catalogo nella lingua chiesta, le altre con la loro etichetta.
export function sourceLabel(value: SignalSource, kind: BrandKind, locale: Locale = DEFAULT_LOCALE): string {
  const id = value.id as SourceId | undefined;
  return id && (id === 'milestones' || id in catalog[locale].sources) ? sourceText(kind, id, locale) : value.label;
}

function emptyChannels(): Channels {
  const channels = {} as Channels;
  for (const { id } of CHANNELS) channels[id] = { selected: false, handle: null };
  return channels;
}

// language: la lingua in cui il brand pubblicherà; di solito quella di chi lo crea.
export function createEmptyDraft(kind: BrandKind, language: Locale = DEFAULT_LOCALE): BrandDraft {
  return {
    identity: { kind, name: '', role: '', company: '', sector: '', site: '', pitch: '', language },
    positioning: { goals: [], audiences: [], postsPerWeek: 3 },
    channels: emptyChannels(),
    themes: [],
    instructions: '',
    visual: { logoUri: null, palette: PALETTE_PRESETS[0], imageStyle: 'flat-geometric', typography: 'inter', signature: true },
    references: { profiles: [], sources: DEFAULT_SOURCES[kind].map((source) => ({ ...source })), milestones: [] },
  };
}

export function changeDraftKind(draft: BrandDraft, kind: BrandKind): BrandDraft {
  if (draft.identity.kind === kind) return draft;
  return {
    ...draft,
    identity: { ...draft.identity, kind },
    positioning: { ...draft.positioning, goals: [], audiences: [] },
    references: { ...draft.references, sources: createEmptyDraft(kind).references.sources },
  };
}
