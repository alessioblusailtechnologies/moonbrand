import type { Locale } from '../i18n/locales';

export type BrandKind = 'person' | 'company' | 'client';

export type ChannelId = 'linkedin' | 'instagram' | 'facebook' | 'tiktok' | 'x' | 'pinterest';

export interface MediaFile {
  path: string | null;
  url: string;
}

export interface Identity {
  kind: BrandKind;
  name: string;
  role: string;
  company: string;
  sector: string;
  site: string;
  pitch: string;
  // La lingua in cui il brand pubblica; i brand nati prima della scelta non ce l'hanno e scrivono in italiano.
  language?: Locale;
}

export interface Positioning {
  goals: string[];
  audiences: string[];
  postsPerWeek: number;
}

export interface ChannelState {
  selected: boolean;
  // Il nome dell'account collegato, come lo mostra il social (es. @pasticceria.aurora).
  handle: string | null;
  // L'account collegato su Zernio, che pubblica al posto del brand: lo scrive solo il server, quando il collegamento riesce.
  accountId?: string | null;
  // Pinterest: la bacheca dove escono i pin, scelta quando si collega.
  board?: { id: string; name: string } | null;
  // Il social ha chiuso l'accesso (token scaduto o revocato, lo dice Zernio): i post qui aspettano che si ricolleghi.
  // Lo scrive solo il server; ricollegando lo stesso account si toglie.
  lost?: boolean;
}

export type Channels = Record<ChannelId, ChannelState>;

export type ThemeLevel = 'often' | 'sometimes' | 'rarely';

export interface Theme {
  id: string;
  name: string;
  weight: number;
  level?: ThemeLevel;
  color: string;
}

export type ImageStyle = 'flat-geometric' | 'desaturated-photo' | 'natural-photo' | 'text-only';

export interface Palette {
  id: string;
  name: string;
  colors: [string, string, string, string];
  origin: 'preset' | 'site' | 'custom';
}

export type TypographyId = 'inter' | 'archivo' | 'space-grotesk' | 'manrope' | 'fraunces' | 'dm-serif' | 'playfair' | 'ibm-plex';

export interface VisualDirection {
  summary: string;
  photoStyle: string;
}

export interface LineFont {
  font: string;
  weight: number;
  italic: boolean;
}

export interface Rubric {
  name: string;
  about: string;
}

export interface BrandTemplate {
  id: string;
  name: string;
  use: string;
  fields: string[];
  photo: boolean;
  html: string;
  css: string;
}

export interface TemplateFont {
  family: string;
  weights: number[];
  italic: boolean;
}

export interface BrandLine {
  from?: string[];
  templates?: BrandTemplate[];
  fonts?: TemplateFont[];
  photo?: 'band' | 'block' | 'full';
  inset?: boolean;
  kicker?: boolean;
  footer?: 'rule' | 'mark' | 'none';
  anchor?: 'center' | 'top' | 'bottom';
  ground: string;
  accent: string;
  voice: LineFont;
  title: LineFont;
  label: LineFont & { spaced: boolean };
  text: LineFont;
  signature: string;
  address: string;
  band: { description: string; photo: MediaFile | null } | null;
  rubrics: Rubric[];
  copy: string[];
}

export type Aspect = '4:5' | '1:1' | '9:16' | '1.91:1' | '2:3';

export interface CardText {
  kicker: string;
  headline: string;
  body: string;
  value: string;
  items: { title: string; body: string }[];
  author: string;
}

export interface VisualExample {
  channel: ChannelId;
  aspect: Aspect;
  page: { templateId: string; custom?: string; text: CardText };
  file: MediaFile | null;
  photo?: MediaFile | null;
  photoDescription?: string;
}

export interface BrandVideo {
  real: string;
  generated: string;
  shots: string[];
  look: string;
  sound: string;
}

export interface BrandTrack {
  id: string;
  mood: string;
  bpm: number;
  seconds: number;
  file: MediaFile;
}

export interface Visual {
  logoUri: string | null;
  palette: Palette;
  imageStyle: ImageStyle;
  typography: TypographyId;
  signature: boolean;
  references?: MediaFile[];
  notes?: string;
  direction?: VisualDirection | null;
  line?: BrandLine | null;
  examples?: VisualExample[];
  video?: BrandVideo | null;
  music?: BrandTrack[];
}

// id: le fonti del catalogo (domain/catalog), che si leggono nella lingua dell'interfaccia; label: il testo, per le altre.
export interface SignalSource {
  id?: string;
  label: string;
  enabled: boolean;
}

export interface Milestone {
  id: string;
  label: string;
  date: string;
}

export interface References {
  profiles: string[];
  sources: SignalSource[];
  milestones: Milestone[];
}

export interface BrandSections {
  identity: Identity;
  positioning: Positioning;
  channels: Channels;
  themes: Theme[];
  // Le istruzioni personalizzate: testo libero di chi cura il brand, che l'AI segue in ogni lavoro.
  instructions: string;
  visual: Visual;
  references: References;
}

export type SectionKey = keyof BrandSections;

export type BrandDraft = BrandSections;

export type SectionPatch = { [K in SectionKey]: { key: K; value: BrandSections[K] } }[SectionKey];

export function applyPatch<T extends BrandSections>(target: T, patch: SectionPatch): T {
  return { ...target, [patch.key]: patch.value };
}

// Collegato vuol dire che Zernio può pubblicare: un handle senza account era il collegamento finto di prima.
export function isConnected(channel: ChannelState): boolean {
  return Boolean(channel.accountId);
}

// Il collegamento finto degli ambienti di prova (SIMULATE_SOCIAL nell'API): vale come collegato, ma i post non escono
// davvero, risultano pubblicati e basta. In produzione non si può creare.
export const SIMULATED_ACCOUNT = 'sim_';

export function isSimulated(channel: ChannelState): boolean {
  return channel.accountId?.startsWith(SIMULATED_ACCOUNT) ?? false;
}

// Collegato, ma il social ha chiuso l'accesso: va ricollegato.
export function needsReconnect(channel: ChannelState): boolean {
  return isConnected(channel) && channel.lost === true;
}
