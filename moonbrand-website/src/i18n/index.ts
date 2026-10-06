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

/**
 * Le categorie di attività, ognuna con la sua pagina sotto "Per attività" (/per-attivita/ristoranti/ e simili).
 * Per aggiungerne una: l'indirizzo qui, i testi in copy.categories, i post di esempio in data/landings.ts.
 * Pagina, riquadro nella pagina "Per attività" e sitemap seguono da soli.
 */
export const CATEGORIES = {
  restaurants: { it: 'ristoranti', en: 'restaurants', fr: 'restaurants' },
  bakeries: { it: 'pasticcerie', en: 'bakeries', fr: 'patisseries' },
  gyms: { it: 'palestre', en: 'gyms', fr: 'salles-de-sport' },
  shops: { it: 'negozi', en: 'shops', fr: 'boutiques' },
} satisfies Record<string, Record<Lang, string>>;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];

const BUSINESSES = { it: 'per-attivita', en: 'for-businesses', fr: 'pour-les-commerces' };

/** I social, ognuno con la sua pagina sotto "Social" (/social/instagram/ e simili). I testi in copy.platforms. */
export const PLATFORMS = {
  instagram: { it: 'instagram', en: 'instagram', fr: 'instagram' },
  tiktok: { it: 'tiktok', en: 'tiktok', fr: 'tiktok' },
  facebook: { it: 'facebook', en: 'facebook', fr: 'facebook' },
  linkedin: { it: 'linkedin', en: 'linkedin', fr: 'linkedin' },
} satisfies Record<string, Record<Lang, string>>;
export type Platform = keyof typeof PLATFORMS;
export const PLATFORM_IDS = Object.keys(PLATFORMS) as Platform[];

const SOCIAL = { it: 'social', en: 'social', fr: 'reseaux-sociaux' };

/** Una pagina dentro un'altra: il suo indirizzo in ogni lingua è quello del genitore più il suo. */
const nested = <K extends string>(parent: Record<Lang, string>, children: Record<K, Record<Lang, string>>) =>
  Object.fromEntries(
    (Object.keys(children) as K[]).map((id) => [id, Object.fromEntries(LANGS.map((lang) => [lang, `${parent[lang]}/${children[id][lang]}`]))]),
  ) as Record<K, Record<Lang, string>>;

/** Le pagine del sito con il loro indirizzo in ogni lingua: per Google conta che sia nella lingua della pagina. */
export const PAGES = {
  home: { it: '', en: '', fr: '' },
  pricing: { it: 'prezzi', en: 'pricing', fr: 'tarifs' },
  contact: { it: 'contatti', en: 'contact', fr: 'contact' },
  privacy: { it: 'privacy', en: 'privacy', fr: 'confidentialite' },
  terms: { it: 'termini', en: 'terms', fr: 'conditions' },
  // Le pagine indice del menù: funzionalità, social, per chi. I testi in copy.hubs.
  features: { it: 'funzionalita', en: 'features', fr: 'fonctionnalites' },
  social: SOCIAL,
  audiences: { it: 'per-chi', en: 'who-its-for', fr: 'pour-qui' },
  // Una pagina per tipo di cliente e una per funzionalità: i testi in copy.landings, la struttura in data/landings.ts.
  businesses: BUSINESSES,
  agencies: { it: 'per-agenzie', en: 'for-agencies', fr: 'pour-les-agences' },
  assistant: { it: 'assistente-ai', en: 'ai-assistant', fr: 'assistant-ia' },
  media: { it: 'immagini-video-ai', en: 'ai-images-videos', fr: 'images-videos-ia' },
  plan: { it: 'piano-editoriale', en: 'content-calendar', fr: 'calendrier-editorial' },
  video: { it: 'video-social', en: 'social-videos', fr: 'videos-reseaux-sociaux' },
  publishing: { it: 'pubblicazione-social', en: 'social-publishing', fr: 'publication-reseaux-sociaux' },
  brandKit: { it: 'brand-kit', en: 'brand-kit', fr: 'kit-de-marque' },
  // Categorie e social stanno dentro la loro pagina indice: /per-attivita/ristoranti/, /social/instagram/.
  ...nested(BUSINESSES, CATEGORIES),
  ...nested(SOCIAL, PLATFORMS),
} satisfies Record<string, Record<Lang, string>>;
export type Page = keyof typeof PAGES;

export const isCategory = (page: Page): page is Category => page in CATEGORIES;
export const isPlatform = (page: Page): page is Platform => page in PLATFORMS;

/** Una pagina in una lingua: il prefisso della lingua più l'indirizzo della pagina in quella lingua. */
export function pagePath(lang: Lang, page: Page = 'home'): string {
  const slug = PAGES[page][lang];
  return slug ? `${homePath(lang)}${slug}/` : homePath(lang);
}

/** L'email per chi vuole scriverci. */
export const CONTACT_EMAIL = 'info@moonbrand.app';

/** Lo studio, dove si accede e ci si registra. */
export const STUDIO_URL = 'https://studio.moonbrand.app';

/** La registrazione nello studio, che parte nella lingua del sito. */
export function signupUrl(lang: Lang): string {
  return `${STUDIO_URL}/register?lang=${lang}`;
}

/** Le immagini con del testo dentro esistono una per lingua, in /images/<lingua>/; le foto sono uguali per tutte. */
export function imagePath(lang: Lang, file: string, localized: boolean): string {
  return localized ? `/images/${lang}/${file}` : `/images/${file}`;
}
