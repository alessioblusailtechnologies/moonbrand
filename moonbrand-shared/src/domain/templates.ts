import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { catalog } from '../i18n/messages/catalog';
import type { BrandCategory } from './brand';

// I template di moonbrand: impaginazioni pronte per i post, disegnate da noi per tipo di attività. Il brand ne sceglie uno
// (visual.template) in alternativa alle immagini di riferimento: i layout stanno nel motore (moonbrand-ai/plugin/templates/<id>),
// le anteprime nello studio (public/templates/<id>/). I colori e il logo sono quelli del brand.

export interface PostTemplate {
  id: string;
  category: BrandCategory;
  // Il nome del template, uguale in ogni lingua.
  name: string;
  // Le anteprime nell'ordine in cui si mostrano: la prima è la copertina del template.
  layouts: string[];
}

export const POST_TEMPLATES: PostTemplate[] = [
  { id: 'specchio', category: 'bellezza', name: 'Specchio', layouts: ['copertina', 'prima-dopo', 'consiglio', 'recensione', 'offerta', 'persona'] },
  { id: 'salone', category: 'bellezza', name: 'Salone', layouts: ['copertina', 'prima-dopo', 'consiglio', 'recensione', 'offerta', 'persona'] },
  { id: 'rituale', category: 'bellezza', name: 'Rituale', layouts: ['copertina', 'prima-dopo', 'consiglio', 'recensione', 'offerta', 'persona'] },
  { id: 'manifesto', category: 'agenzia', name: 'Manifesto', layouts: ['copertina', 'punto', 'dato', 'citazione', 'caso', 'persona'] },
  { id: 'quaderno', category: 'agenzia', name: 'Quaderno', layouts: ['copertina', 'punto', 'dato', 'citazione', 'caso', 'persona'] },
  { id: 'cantiere', category: 'agenzia', name: 'Cantiere', layouts: ['copertina', 'punto', 'dato', 'citazione', 'caso', 'persona'] },
];

export function findTemplate(id: string | null | undefined): PostTemplate | null {
  return POST_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function templatesFor(category: BrandCategory | null | undefined): PostTemplate[] {
  return category ? POST_TEMPLATES.filter((template) => template.category === category) : [];
}

export function templateDescription(id: string, locale: Locale = DEFAULT_LOCALE): string {
  return (catalog[locale].templates as Record<string, string>)[id] ?? '';
}
