import { dayPart, type Greeting } from '@moonbrand/shared/domain/welcome';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate, type MessageKey } from '@moonbrand/shared/i18n/translate';
import { planNow } from '@moonbrand/shared/lib/dates';

// Il saluto in cima alla chat: uno di quelli di oggi per la fascia oraria, diverso dagli ultimi visti sullo stesso brand.
// Finché quelli di oggi non ci sono, uno di riserva per la fascia oraria, con il nome.

const RECENT_KEY = 'moonbrand:greetings:';
const RECENT = 6;

// Quello che si mostra: il testo di uno di quelli di oggi, già nella lingua dell'account, o uno di riserva (chiave e nome),
// che si legge nella lingua dell'interfaccia.
export type ShownGreeting = { text: string } | { key: MessageKey; name: string };

// I saluti di riserva sono nel dizionario, tre per fascia oraria (chat.greetings).
const VARIANTS = ['a', 'b', 'c'] as const;

export function fallbackGreeting(name: string, part = dayPart(planNow().time)): ShownGreeting {
  const variant = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  return { key: `chat.greetings.${part}.${variant}` as MessageKey, name: name.trim().split(/\s+/)[0] ?? '' };
}

// «, {name}» sparisce quando il nome non c'è. Come quelli scritti da Sonnet: niente che indovini il genere.
export function greetingText(shown: ShownGreeting, locale: Locale): string {
  if ('text' in shown) return shown.text;
  const text = translate(locale, shown.key);
  return shown.name ? text.replace('{name}', shown.name) : text.replace(/,? \{name\}/, '');
}

function recent(brandId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(RECENT_KEY + brandId) ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function remember(brandId: string, text: string): void {
  try {
    localStorage.setItem(RECENT_KEY + brandId, JSON.stringify([text, ...recent(brandId).filter((item) => item !== text)].slice(0, RECENT)));
  } catch {
    // Senza memoria si può ripetere un saluto: niente di grave.
  }
}

export function pickGreeting(brandId: string, greetings: readonly Greeting[], name: string): ShownGreeting {
  const part = dayPart(planNow().time);
  const options = greetings.filter((greeting) => greeting.part === part).map((greeting) => greeting.text);
  if (options.length === 0) return fallbackGreeting(name, part);
  const seen = recent(brandId);
  const fresh = options.filter((text) => !seen.includes(text));
  const pool = fresh.length > 0 ? fresh : options;
  const text = pool[Math.floor(Math.random() * pool.length)];
  remember(brandId, text);
  return { text };
}
