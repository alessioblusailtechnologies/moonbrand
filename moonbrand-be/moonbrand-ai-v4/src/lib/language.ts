import { DEFAULT_LOCALE, matchLocale, type Locale } from '@moonbrand/shared/i18n/locales';

// La lingua dell'account, che il worker passa a ogni script: i prompt restano in italiano, cambia solo la lingua in cui
// Claude scrive.
export const uiLocale: Locale = matchLocale(process.env.MOONBRAND_LOCALE) ?? DEFAULT_LOCALE;

// I nomi delle lingue come si scrivono in un prompt in italiano.
const NAMES: Record<Locale, string> = { it: 'italiano', en: 'inglese', fr: 'francese' };

export function languageName(locale: Locale): string {
  return NAMES[locale];
}

export function replyRule(): string {
  return uiLocale === 'it' ? 'Rispondi in italiano.' : `Rispondi in ${languageName(uiLocale)}.`;
}
