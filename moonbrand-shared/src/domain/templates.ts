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
  { id: 'retino', category: 'agenzia', name: 'Retino', layouts: ['copertina', 'opinione', 'storia', 'caso', 'risultati', 'recensione', 'disponibilita', 'manifesto'] },
  { id: 'affissioni', category: 'agenzia', name: 'Affissioni', layouts: ['copertina', 'manifesto', 'assumiamo', 'squadra', 'offerta', 'tasca', 'citazione', 'evento'] },
  { id: 'lilla', category: 'agenzia', name: 'Lilla', layouts: ['copertina', 'dato', 'domanda', 'segnali', 'percentuale', 'scheda', 'secondi', 'tesi'] },
  { id: 'salvia', category: 'agenzia', name: 'Salvia', layouts: ['copertina', 'frase', 'dato', 'numeri', 'domanda', 'passi', 'recensioni', 'squadra'] },
  { id: 'burro', category: 'agenzia', name: 'Burro', layouts: ['copertina', 'lista', 'note', 'calendario', 'ricerca', 'post', 'cartelle', 'scheda'] },
  { id: 'diario', category: 'agenzia', name: 'Diario', layouts: ['copertina', 'forte', 'pubblico', 'elegante', 'a-mano', 'pensa', 'spaziato', 'giornata'] },
  { id: 'brace', category: 'agenzia', name: 'Brace', layouts: ['copertina', 'lo-sapevi', 'dato', 'parola', 'indovina', 'guida', 'calendario', 'recensione'] },
  { id: 'quota', category: 'agenzia', name: 'Quota', layouts: ['copertina', 'manifesto', 'guida', 'perche', 'progetto', 'numeri', 'evento', 'articolo'] },
  { id: 'cielo', category: 'agenzia', name: 'Cielo', layouts: ['copertina', 'numeri', 'dato', 'passi', 'frase', 'persona', 'citazione', 'evento'] },
  { id: 'rivista', category: 'agenzia', name: 'Rivista', layouts: ['copertina', 'servizi', 'manifesto', 'frase', 'evento', 'prenota', 'citazione', 'consulenza'] },
  { id: 'appunti', category: 'agenzia', name: 'Appunti', layouts: ['copertina', 'numero', 'consiglio', 'nota', 'messaggio', 'ripresa', 'parola', 'chiusura'] },
  { id: 'panna', category: 'agenzia', name: 'Panna', layouts: ['copertina', 'parola', 'sprint', 'controlli', 'idea', 'prenota', 'idee', 'perline'] },
  { id: 'gigante', category: 'agenzia', name: 'Gigante', layouts: ['copertina', 'parola', 'servizi', 'manifesto', 'benvenuto', 'recensione', 'slogan', 'risultati'] },
  { id: 'cobalto', category: 'agenzia', name: 'Cobalto', layouts: ['copertina', 'annuncio', 'servizio', 'lista', 'pagina', 'domanda', 'recensione', 'scadenza'] },
  { id: 'crema', category: 'agenzia', name: 'Crema', layouts: ['copertina', 'frase', 'verita', 'domanda', 'segreto', 'persona', 'collage', 'casa'] },
  { id: 'cappuccino', category: 'agenzia', name: 'Cappuccino', layouts: ['copertina', 'calendario', 'promemoria', 'lo-sapevi', 'domanda', 'lista', 'frase', 'lavora-con-me'] },
  { id: 'adesivi', category: 'agenzia', name: 'Adesivi', layouts: ['copertina', 'errori', 'parola', 'miti', 'tre-punti', 'guida', 'perline', 'prenota'] },
  { id: 'tortora', category: 'agenzia', name: 'Tortora', layouts: ['copertina', 'fiducia', 'domanda', 'segreto', 'miti', 'guida', 'giornata', 'collage'] },
  { id: 'cartella', category: 'agenzia', name: 'Cartella', layouts: ['copertina', 'novita', 'notizia', 'caso', 'risultati', 'passo', 'recensione', 'checklist'] },
  { id: 'ritaglio', category: 'agenzia', name: 'Ritaglio', layouts: ['copertina', 'passo', 'servizi', 'citazione', 'tono', 'rumore', 'cornice', 'manifesto'] },
  { id: 'inchiostro', category: 'agenzia', name: 'Inchiostro', layouts: ['copertina', 'processo', 'manifesto', 'chi-siamo', 'notizia', 'persona', 'citazione', 'passi'] },
  { id: 'ricciolo', category: 'agenzia', name: 'Ricciolo', layouts: ['copertina', 'servizi', 'chi-siamo', 'persona', 'citazione', 'dati', 'processo', 'grafico'] },
  { id: 'menta', category: 'agenzia', name: 'Menta', layouts: ['copertina', 'recensione', 'checklist', 'lo-sapevi', 'tempo', 'giorni', 'disciplina', 'pensiero'] },
  { id: 'vaniglia', category: 'agenzia', name: 'Vaniglia', layouts: ['copertina', 'verita', 'pennellata', 'domanda', 'note', 'elenco', 'pausa', 'giornata'] },
  { id: 'carteggio', category: 'agenzia', name: 'Carteggio', layouts: ['copertina', 'perche', 'domanda', 'pilastri', 'processo', 'caso', 'recensione', 'lettera'] },
  { id: 'granata', category: 'agenzia', name: 'Granata', layouts: ['copertina', 'servizi', 'guida', 'citazione', 'strumenti', 'parliamone', 'unisciti', 'annuncio'] },
  { id: 'mimosa', category: 'agenzia', name: 'Mimosa', layouts: ['copertina', 'cartella', 'passo', 'domanda', 'servizi', 'promemoria', 'routine', 'frase'] },
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
