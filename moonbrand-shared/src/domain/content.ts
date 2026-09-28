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

// Un file del contenuto nella cartella del brand: la copertina (una per proporzione), una slide
// o il video (uno per proporzione, con la copertina della stessa proporzione).
export interface ContentFile {
  file: string;
  role: 'cover' | 'slide' | 'video';
  index: number;
  aspect: string;
  url?: string;
}

// Da dove viene quello che si vede in un'inquadratura: una clip generata, una foto generata,
// foto o clip dell'utente, oppure solo grafica e testo.
export type SceneSource = 'clip' | 'photo' | 'user' | 'graphics';

// Un'inquadratura del copione di un video.
export interface VideoScene {
  seconds: number;
  // Cosa si vede: soggetto, tipo di inquadratura e movimento di macchina.
  shot: string;
  source: SceneSource;
  // Il testo a schermo, vuoto se non c'è.
  onScreen: string;
  // La voce fuori campo in questa inquadratura, vuota se non c'è.
  voice: string;
}

// Stessa forma che legge social-app, più i file che produce moonbrand.
// In un video script è l'idea in breve (tono, ritmo, musica, voce) e scenes sono le inquadrature del copione.
export interface ContentVisual {
  headline: string;
  slides: CarouselSlide[];
  script: string;
  scenes: VideoScene[];
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

// La proporzione del video per canale.
export const VIDEO_ASPECT: Record<ChannelId, string> = { instagram: '9:16', facebook: '9:16', tiktok: '9:16', linkedin: '4:5', x: '16:9' };

// Un video nasce in due tempi: prima il copione, da approvare, poi il video.
export const hasScript = (content: Pick<Content, 'format' | 'visual'>): boolean => content.format === 'video' && content.visual.scenes.length > 0;
export const hasVideo = (content: Pick<Content, 'visual'>): boolean => (content.visual.files ?? []).some((file) => file.role === 'video');

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
