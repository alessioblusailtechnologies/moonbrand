import type { ChannelId } from './brand';

// Il contenuto: una variante di testo per canale e il visivo del formato scelto.
// Stessa entità di social-app (tabella presenza.contents).

export type ContentFormat = 'post' | 'carousel' | 'video' | 'article';

export type ContentStatus = 'draft' | 'approved';

export interface ChannelVariant {
  channel: ChannelId;
  text: string;
  hashtags: string[];
}

export interface CarouselSlide {
  title: string;
  body: string;
}

// Un'immagine del contenuto nella cartella del brand: la copertina (una per proporzione) o una slide.
export interface ContentFile {
  file: string;
  role: 'cover' | 'slide';
  index: number;
  aspect: string;
  url?: string;
}

// Stessa forma che legge social-app, più i file che produce moonbrand.
export interface ContentVisual {
  headline: string;
  slides: CarouselSlide[];
  script: string;
  scenes: unknown[];
  design: unknown;
  files?: ContentFile[];
}

export interface Content {
  id: string;
  brandId: string;
  ideaId: string | null;
  // La conversazione in cui è nato, se viene dalla chat.
  conversationId: string | null;
  title: string;
  themeId: string | null;
  channels: ChannelId[];
  format: ContentFormat;
  variants: ChannelVariant[];
  visual: ContentVisual;
  status: ContentStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

// Gli hashtag che ogni canale regge al massimo.
export const HASHTAGS: Record<ChannelId, number> = { linkedin: 3, instagram: 6, facebook: 2, tiktok: 4, x: 2 };

// Con # davanti, senza spazi né doppioni, al massimo quelli del canale.
export function cleanHashtags(hashtags: readonly string[], channel: ChannelId): string[] {
  const clean = hashtags
    .map((tag) => tag.trim().replace(/\s+/g, '').replace(/^#*/, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
  return [...new Set(clean)].slice(0, HASHTAGS[channel]);
}
