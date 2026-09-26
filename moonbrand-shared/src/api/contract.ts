import type { AiStep } from '../ai/steps';
import type { BrandDraft, BrandKind, ChannelId, Identity, MediaFile, Positioning, VoiceCard } from '../domain/brand';

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

export type CreateBrandRequest = BrandDraft & { id: string };

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

export interface VisualExampleFile {
  channel: ChannelId;
  file: string;
  url: string;
  caption: string;
}

export interface VisualReading {
  examples: VisualExampleFile[];
}

export interface ApiErrorBody {
  status: number;
  code: string;
  message: string;
}

export const PASSWORD_MIN = 8;
export const REFRESH_COOKIE = 'mb_refresh';
