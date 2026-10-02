import { DEFAULT_LOCALE, type Locale } from '@moonbrand/shared/i18n/locales';

// La lingua dell'interfaccia per il codice fuori da Angular (errorMessage): la tiene aggiornata I18nService.
let current: Locale = DEFAULT_LOCALE;

export function currentLocale(): Locale {
  return current;
}

export function setCurrentLocale(locale: Locale): void {
  current = locale;
}
