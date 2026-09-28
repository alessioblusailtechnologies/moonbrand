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

// Una foto che chi guarda prende per vera (persone, luoghi, lavori, prodotti del brand): l'AI non la inventa,
// nell'impaginazione lascia un segnaposto. L'utente carica la sua foto o sceglie di farla generare.
export interface ContentPhotoSlot {
  id: string;
  // Cosa deve mostrare la foto, detto a chi la deve scattare.
  description: string;
  aspect: string;
  // La foto messa nello slot; vuoto finché resta il segnaposto.
  file: string;
  source: 'upload' | 'ai' | null;
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
  slots?: ContentPhotoSlot[];
}

export interface Content {
  id: string;
  brandId: string;
  ideaId: string | null;
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
