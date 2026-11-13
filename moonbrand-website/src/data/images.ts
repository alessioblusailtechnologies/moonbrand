// Le immagini del sito stanno in src/assets/images: alla build Astro le converte in WebP, con larghezza e altezza
// nel tag (niente salti della pagina) e il nome con l'impronta (si possono tenere in cache per sempre).
import type { ImageMetadata } from 'astro';
import type { Lang } from '../i18n';

const FILES = import.meta.glob<{ default: ImageMetadata }>('../assets/images/**/*.{jpg,png}', { eager: true });

/** Le immagini con del testo dentro esistono una per lingua, in images/<lingua>/; le foto sono uguali per tutte. */
export function siteImage(lang: Lang, file: string, localized: boolean): ImageMetadata {
  const key = `../assets/images/${localized ? `${lang}/` : ''}${file}`;
  const found = FILES[key];
  if (!found) throw new Error(`Immagine mancante: ${key}`);
  return found.default;
}
