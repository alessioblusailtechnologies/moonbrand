import { HttpErrorResponse } from '@angular/common/http';

import type { ApiErrorBody } from '@moonbrand/shared/api/contract';
import { translate, type MessageKey } from '@moonbrand/shared/i18n/translate';

import { currentLocale } from './i18n/current-locale';

// Il messaggio da mostrare per un errore. fallback è già nella lingua dell'interfaccia (i18n.t(...)).
// L'API scrive i messaggi in italiano: in italiano si mostrano così, nelle altre lingue vale il testo del codice
// (errors.codes) o, se il codice non c'è, il fallback.
export function errorMessage(error: unknown, fallback: string): string {
  const locale = currentLocale();
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return translate(locale, 'errors.network');
    const body = error.error as Partial<ApiErrorBody> | null;
    if (body?.message && error.status < 500) {
      if (locale === 'it') return body.message;
      const key = `errors.codes.${body.code}` as MessageKey;
      const text = translate(locale, key);
      if (text !== key) return text;
    }
  }
  return fallback;
}
