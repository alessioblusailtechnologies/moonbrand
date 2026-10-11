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
  { id: 'bordeaux', category: 'bellezza', name: 'Bordeaux', layouts: ['copertina', 'servizi', 'prenotazione', 'recensione', 'novita', 'cliente', 'prima-dopo', 'consigli'] },
  { id: 'neutro', category: 'bellezza', name: 'Neutro', layouts: ['copertina', 'prima-dopo', 'consiglio', 'recensione', 'listino', 'prenota', 'offerta', 'salone'] },
  { id: 'barberia', category: 'bellezza', name: 'Barberia', layouts: ['copertina', 'servizio', 'offerta', 'barbiere', 'recensione', 'consiglio', 'bottega', 'annuncio'] },
  { id: 'segnale', category: 'agenzia', name: 'Segnale', layouts: ['copertina', 'passi', 'lista', 'dato', 'citazione', 'offerta', 'caso', 'chiusura'] },
  { id: 'studio', category: 'agenzia', name: 'Studio', layouts: ['copertina', 'punto', 'passo', 'dato', 'frase', 'servizi', 'citazione', 'persona'] },
  { id: 'lime', category: 'agenzia', name: 'Lime', layouts: ['copertina', 'risultati', 'numero', 'lo-sapevi', 'domanda', 'processo', 'recensione', 'slogan'] },
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
