// Quanti saluti per fascia oraria e quanti spunti scrive il job welcome, e quanto possono essere lunghi.
export const GREETINGS_PER_PART = 4;
export const SUGGESTIONS = 4;
export const MAX_GREETING = 70;
export const MAX_LABEL = 80;
export const MAX_DRAFT = 400;

// Le parole che indovinano il genere di chi legge, nelle lingue dei saluti: il prompt le vieta, ma se ne scappa una il
// saluto si scarta (ne restano altri per la stessa fascia).
const GENDERED =
  /(?<!\p{L})(bentornat[oa]|bentrovat[oa]|benvenut[oa]|svegli[oae]|stanc[oa]|pront[oa]|caric[oa]|bienvenue?|fatigu[ée]e?|pr[eê]te?|r[ée]veill[ée]e?)(?!\p{L})/iu;

export const guessesGender = (text: string): boolean => GENDERED.test(text);

// Emoji e simboli pittografici, con i selettori di variante e i giunti che li compongono.
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;

// Il testo come si mostra: senza emoji, senza virgolette intorno, su una riga. Vuoto se è troppo lungo.
export function cleanText(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  const value = text
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"“]+|[»"”]+$/g, '')
    .trim();
  return value.length <= max ? value : '';
}
