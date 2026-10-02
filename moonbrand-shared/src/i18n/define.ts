// Un dizionario per area dell'app (messages/<area>.ts), con le tre lingue una accanto all'altra. L'italiano è il
// riferimento: inglese e francese devono avere le stesse chiavi, altrimenti non compila.
//
// Nei testi:
// - {nome} è un valore che arriva da fuori: translate(locale, 'area.chiave', { nome: 'Marta' });
// - {n, plural, one {# idea} other {# idee}} sceglie la forma con le regole di plurale della lingua (Intl.PluralRules):
//   # diventa il numero, e oltre a one e other valgono =0, =1 e le altre categorie. Dentro le forme niente altre graffe.
export type Tree<T> = { [K in keyof T]: T[K] extends string ? string : Tree<T[K]> };

export interface LocaleMessages<T> {
  it: T;
  en: Tree<T>;
  fr: Tree<T>;
}

export function defineMessages<T>(messages: LocaleMessages<T>): LocaleMessages<T> {
  return messages;
}
