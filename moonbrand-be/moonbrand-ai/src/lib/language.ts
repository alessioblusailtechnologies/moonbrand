import { DEFAULT_LOCALE, matchLocale, type Locale } from '@moonbrand/shared/i18n/locales';

// Le due lingue del job, che il worker passa a ogni script: quella dell'account, per tutto quello che si dice a chi usa
// moonbrand, e quella del brand, per quello che si pubblica. I prompt e le skill restano in italiano: cambia solo la
// lingua in cui Claude scrive.
export const uiLocale: Locale = matchLocale(process.env.MOONBRAND_LOCALE) ?? DEFAULT_LOCALE;
export const contentLanguage: Locale = matchLocale(process.env.MOONBRAND_CONTENT_LANGUAGE) ?? uiLocale;

// I nomi delle lingue come si scrivono in un prompt in italiano.
const NAMES: Record<Locale, string> = { it: 'italiano', en: 'inglese', fr: 'francese' };

export function languageName(locale: Locale): string {
  return NAMES[locale];
}

// Come ci si rivolge a chi usa moonbrand nella sua lingua.
const ADDRESS: Record<Locale, string> = {
  it: 'dando del tu',
  en: 'in modo semplice e diretto',
  fr: 'dando del vous',
};

// Gli esempi nei prompt e nelle skill sono in italiano: con un'altra lingua vanno presi per il tono, non per le parole.
export const EXAMPLES_NOTE =
  'Le istruzioni, le skill e i loro esempi sono in italiano: valgono per come lavorare e per il tono, non per la lingua in cui scrivi.';

// Solo per chi parla con la persona (chat, idee, saluti): la lingua e il modo di rivolgersi.
export function replyRule(): string {
  if (uiLocale === 'it') return 'Rispondi in italiano.';
  return `Rispondi in ${languageName(uiLocale)}, ${ADDRESS[uiLocale]}. ${EXAMPLES_NOTE}`;
}

// Per i job che preparano quello che si pubblica: con tutte e due le lingue in italiano resta la riga di sempre.
export function languageRules(): string {
  if (uiLocale === 'it' && contentLanguage === 'it') return 'Rispondi in italiano.';
  const content = languageName(contentLanguage);
  return [
    '## Lingue',
    `- Quello che si pubblica è in ${content}: testi dei post e hashtag, testi nelle immagini, copioni, testo a schermo, voce fuori campo, canzoni e sottotitoli dei video.`,
    `- Segui le convenzioni di scrittura di quella lingua (virgolette, spazi, maiuscole, date e numeri), anche dove le skill mostrano quelle italiane.`,
    `- Quello che dici alla persona (risposte, domande, spiegazioni) è in ${languageName(uiLocale)}${uiLocale === 'it' ? '' : `, ${ADDRESS[uiLocale]}`}.`,
    `- ${EXAMPLES_NOTE}`,
  ].join('\n');
}
