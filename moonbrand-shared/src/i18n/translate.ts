import { INTL_LOCALES, type Locale } from './locales';
import { NAMESPACES } from './messages';

type Namespaces = typeof NAMESPACES;

// Le chiavi con il punto, come si scrivono nei template: 'shell.newChat'.
type Paths<T, Prefix extends string> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
export type MessageKey = { [N in keyof Namespaces & string]: Paths<Namespaces[N]['it'], `${N}.`> }[keyof Namespaces & string];

export type MessageParams = Record<string, string | number>;

const PLURAL = /\{(\w+), plural,((?:\s*(?:=\d+|zero|one|two|few|many|other)\s*\{[^{}]*\})+)\s*\}/g;
const FORM = /(=\d+|zero|one|two|few|many|other)\s*\{([^{}]*)\}/g;
const pluralRules = new Map<Locale, Intl.PluralRules>();

function plural(locale: Locale, count: number, forms: string): string {
  const options = new Map([...forms.matchAll(FORM)].map(([, name, text]) => [name, text]));
  let rules = pluralRules.get(locale);
  if (!rules) pluralRules.set(locale, (rules = new Intl.PluralRules(INTL_LOCALES[locale])));
  const text = options.get(`=${count}`) ?? options.get(rules.select(count)) ?? options.get('other') ?? '';
  return text.replace(/#/g, count.toLocaleString(INTL_LOCALES[locale]));
}

// Il testo di una chiave nella lingua chiesta, con i plurali scelti e i {valori} al loro posto.
// Una chiave che non c'è torna com'è: si vede subito cosa manca.
export function translate(locale: Locale, key: MessageKey, params?: MessageParams): string {
  const [namespace, ...path] = key.split('.');
  let node: unknown = (NAMESPACES as Record<string, Record<Locale, unknown>>)[namespace]?.[locale];
  for (const part of path) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== 'string') return key;
  if (!params) return node;
  return node
    .replace(PLURAL, (match, name: string, forms: string) => (typeof params[name] === 'number' ? plural(locale, params[name], forms) : match))
    .replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}
