import type { AiStep } from '../ai/steps';
import type { BrandDraft, BrandKind, ChannelId, Identity, MediaFile, Positioning, VoiceCard } from '../domain/brand';
import type { Content, ContentFormat, ContentStatus } from '../domain/content';
import type { Idea, IdeaSignalKind, IdeaStatus } from '../domain/idea';

export interface Account {
  id: string;
  email: string;
  name: string;
}

export interface SignUpRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  account: Account;
}

export interface Me {
  account: Account;
  activeBrandId: string | null;
}

export interface BrandSummary {
  id: string;
  kind: BrandKind;
  name: string;
  logoUri: string | null;
  color: string;
}

// referenceExamples: gli esempi scelti nell'onboarding, che diventano i riferimenti da seguire del brand.
export type CreateBrandRequest = BrandDraft & { id: string; referenceExamples?: string[] };

export interface ActiveBrandRequest {
  brandId: string;
}

export interface ReferenceUploadRequest {
  dataUri: string;
}

export type ReferenceUploadResponse = MediaFile;

export type AiJobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface AiJob<Result = unknown> {
  id: string;
  kind: string;
  status: AiJobStatus;
  steps: AiStep[];
  result: Result | null;
  error: string | null;
}

export interface AiJobCreated {
  id: string;
}

export interface WebsiteJobRequest {
  site: string;
}

export interface WebsiteReading {
  site: string;
  name: string;
  sector: string;
  summary: string;
  pitch: string;
  themes: string[];
  goals: string[];
  audiences: string[];
  colors: string[];
}

export interface VisualBrandContext {
  identity: Identity;
  positioning: Positioning;
  channels: ChannelId[];
  themes: string[];
  voice: VoiceCard | null;
  palette: string[];
  notes: string;
}

export interface VisualJobRequest {
  brandId: string;
  brand: VisualBrandContext;
}

export interface VisualEditJobRequest {
  jobId: string;
  instruction: string;
}

// Quello che l'API mette in coda: la sessione, la cartella degli esempi e i canali vengono dal job da modificare.
export interface VisualEditJobInput {
  brandId: string;
  dir: string;
  sessionId: string;
  channels: ChannelId[];
  instruction: string;
  fromJobId: string;
}

export interface VisualExampleFile {
  channel: ChannelId;
  file: string;
  url: string;
  caption: string;
}

export interface VisualReading {
  examples: VisualExampleFile[];
}

export interface BrandContext {
  identity: Identity;
  positioning: Positioning;
  channels: ChannelId[];
  themes: { id: string; name: string; weight: number }[];
  voice: VoiceCard | null;
}

// I gusti su tutta la storia del brand: ogni idea tenuta vale +1 per il suo tema e il suo segnale, ogni scartata -0,5.
export interface IdeaPreferences {
  decided: number;
  saved: number;
  themes: { themeId: string; score: number }[];
  signals: { kind: IdeaSignalKind; score: number }[];
}

// Quello che l'API mette in coda: il brand dal DB, le idee più recenti (per non ripetersi) e i gusti.
export interface IdeasJobInput {
  brandId: string;
  count: number;
  brand: BrandContext;
  recent: { title: string; status: IdeaStatus; themeId: string | null; signal: IdeaSignalKind }[];
  preferences: IdeaPreferences;
}

export interface IdeasResponse {
  ideas: Idea[];
  themes: { id: string; name: string; color: string }[];
  // I canali del brand: tra questi si sceglie dove far uscire un contenuto.
  channels: ChannelId[];
  // Il lavoro che sta preparando nuove idee, se c'è.
  jobId: string | null;
}

export interface IdeaStatusRequest {
  status: IdeaStatus;
}

// I formati che moonbrand sa preparare: il video arriverà dopo.
export type WritableFormat = Exclude<ContentFormat, 'video'>;

export interface CreateContentRequest {
  format: WritableFormat;
  channels: ChannelId[];
}

export interface ContentCreated {
  id: string;
  jobId: string;
}

export interface ContentSummary {
  id: string;
  title: string;
  format: ContentFormat;
  channels: ChannelId[];
  status: ContentStatus;
  coverUrl: string | null;
  updatedAt: string;
  preparing: boolean;
}

export interface ContentResponse {
  content: Content;
  // Il lavoro che sta preparando o ritoccando il contenuto, se c'è.
  jobId: string | null;
}

export interface ContentEditRequest {
  instruction: string;
}

// L'idea da cui nasce il contenuto, con il nome del tema invece dell'id.
export interface ContentIdea {
  title: string;
  angleLabel: string;
  angle: string;
  rationale: string;
  theme: string | null;
}

export interface ContentJobInput {
  brandId: string;
  contentId: string;
  format: WritableFormat;
  channels: ChannelId[];
  brand: BrandContext;
  idea: ContentIdea;
}

export interface ContentEditJobInput {
  brandId: string;
  contentId: string;
  sessionId: string;
  format: WritableFormat;
  channels: ChannelId[];
  instruction: string;
}

// Una foto caricata per uno slot, nella cartella del contenuto: la usa il job che riempie gli slot.
export interface ContentPhotoUploadResponse {
  path: string;
  url: string;
}

// Gli slot da riempire tutti insieme: con upload la foto caricata, senza la genera l'AI.
export interface ContentPhotosRequest {
  slots: { id: string; upload?: string }[];
}

export interface ContentPhotosJobInput {
  brandId: string;
  contentId: string;
  sessionId: string;
  format: WritableFormat;
  channels: ChannelId[];
  slots: { id: string; description: string; aspect: string; upload: string | null }[];
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
}

export const PASSWORD_MIN = 8;
export const REFRESH_COOKIE = 'mb_refresh';
