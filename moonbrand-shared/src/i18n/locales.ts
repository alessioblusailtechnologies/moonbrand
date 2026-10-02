// Le lingue di moonbrand. Sono due cose diverse: la lingua dell'account (l'interfaccia, la chat, i passaggi del motore)
// e la lingua del brand (quello che si pubblica: post, grafiche, voce e sottotitoli dei video).
export const LOCALES = ['it', 'en', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'it';

// Ogni lingua con il suo nome, come lo scrive chi la parla: è così che si cerca nella scelta della lingua.
export const LOCALE_NAMES: Record<Locale, string> = { it: 'Italiano', en: 'English', fr: 'Français' };

// La regione per date e numeri: Intl con la sola lingua sceglie già bene, ma così il formato non cambia col browser.
export const INTL_LOCALES: Record<Locale, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

// Da un tag qualsiasi (fr-CA, en_US, IT) la lingua di moonbrand che gli somiglia; null se non è tra le nostre.
export function matchLocale(tag: string | null | undefined): Locale | null {
  const language = tag?.trim().slice(0, 2).toLowerCase();
  return isLocale(language) ? language : null;
}

// La lingua dei post di un brand letta dal suo sito: la nostra lingua più vicina, l'inglese per le altre (un sito in
// tedesco o in spagnolo pubblica per un pubblico internazionale più che italiano o francese).
export function siteLanguage(code: string | null | undefined): Locale {
  return matchLocale(code) ?? 'en';
}

// La lingua dei contenuti di un brand: quella scelta, o quella di base per i brand nati prima della scelta.
export function brandLanguage(identity: { language?: Locale | null }): Locale {
  return identity.language ?? DEFAULT_LOCALE;
}
