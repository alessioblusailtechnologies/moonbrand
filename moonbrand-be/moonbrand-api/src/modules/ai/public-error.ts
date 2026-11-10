import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import type { Queryable } from '../../db/pool';
import { findAccount } from '../auth/accounts';

// L'errore di un lavoro AI com'è nel DB parla di processi, modelli e servizi («pi terminato con codice 1»): a chi usa
// l'app arriva solo un messaggio generico, nella lingua del suo account. Quello vero resta in ai_jobs.error, nel log del
// worker e nella sezione admin.
export function publicJobError(error: string | null, locale: Locale): string | null {
  return error ? translate(locale, 'server.jobFailed') : null;
}

export async function accountLocale(db: Queryable, accountId: string): Promise<Locale> {
  return (await findAccount(db, accountId))?.locale ?? 'it';
}
