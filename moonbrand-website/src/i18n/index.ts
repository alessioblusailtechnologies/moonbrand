import { en } from './en';
import { fr } from './fr';
import { it, type Copy } from './it';

export const LANGS = ['it', 'en', 'fr'] as const;
export type Lang = (typeof LANGS)[number];

const COPY: Record<Lang, Copy> = { it, en, fr };

export function getCopy(lang: Lang): Copy {
  return COPY[lang];
}

/** La lingua della pagina, da Astro.currentLocale (l'italiano è quella senza prefisso). */
export function langOf(locale: string | undefined): Lang {
  return LANGS.includes(locale as Lang) ? (locale as Lang) : 'it';
}

/** La home in una lingua: / per l'italiano, /en/ e /fr/ per le altre. */
export function homePath(lang: Lang): string {
  return lang === 'it' ? '/' : `/${lang}/`;
}

/** Le pagine del sito con il loro indirizzo in ogni lingua: per Google conta che sia nella lingua della pagina. */
export const PAGES = {
  home: { it: '', en: '', fr: '' },
  contact: { it: 'contatti', en: 'contact', fr: 'contact' },
  privacy: { it: 'privacy', en: 'privacy', fr: 'confidentialite' },
  terms: { it: 'termini', en: 'terms', fr: 'conditions' },
} satisfies Record<string, Record<Lang, string>>;
export type Page = keyof typeof PAGES;

/** Una pagina in una lingua: il prefisso della lingua più l'indirizzo della pagina in quella lingua. */
export function pagePath(lang: Lang, page: Page = 'home'): string {
  const slug = PAGES[page][lang];
  return slug ? `${homePath(lang)}${slug}/` : homePath(lang);
}

/** L'email per chi vuole scriverci. */
export const CONTACT_EMAIL = 'info@moonbrand.app';

/** Lo studio, dove si accede e ci si registra. */
export const STUDIO_URL = 'https://studio.moonbrand.app';

/** Le immagini con del testo dentro esistono una per lingua, in /images/<lingua>/; le foto sono uguali per tutte. */
export function imagePath(lang: Lang, file: string, localized: boolean): string {
  return localized ? `/images/${lang}/${file}` : `/images/${file}`;
}
