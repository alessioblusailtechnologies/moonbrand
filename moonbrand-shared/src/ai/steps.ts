import type { BrandKind, Palette } from '../domain/brand';

export interface AiStep {
  id: string;
  label: string;
  detail?: string;
  status: 'running' | 'done' | 'failed';
}

export type OnAiSteps = (steps: AiStep[]) => void;

export interface StepLog {
  start(id: string, label: string, detail?: string): void;
  finish(id: string, outcome?: { failed?: boolean; detail?: string }): void;
  drop(id: string): void;
}

export function createStepLog(onSteps?: OnAiSteps): StepLog {
  let steps: AiStep[] = [];
  const update = (next: AiStep[]) => {
    steps = next;
    onSteps?.(steps);
  };
  return {
    start: (id, label, detail) =>
      update([...steps.filter((step) => step.id !== id), { id, label, ...(detail ? { detail } : {}), status: 'running' }]),
    finish: (id, { failed = false, detail } = {}) => {
      if (!steps.some((step) => step.id === id)) return;
      update(steps.map((step) => (step.id === id ? { ...step, status: failed ? 'failed' : 'done', ...(detail !== undefined && { detail }) } : step)));
    },
    drop: (id) => {
      if (steps.some((step) => step.id === id)) update(steps.filter((step) => step.id !== id));
    },
  };
}

export interface WebsiteInsights {
  site: string;
  name: string;
  sector: string;
  summary: string;
  pitch: string;
  themes: string[];
  goals: string[];
  audiences: string[];
  palette: Palette;
}

export interface PositioningIdeas {
  goals: string[];
  audiences: string[];
  picked: { goals: string[]; audiences: string[] };
}

export const THINKING_STEP = 'thinking';

export const WEBSITE_STEPS = {
  address: 'Controllo l’indirizzo',
  colors: 'Cerco i colori nel codice del sito',
  plan: 'Scelgo le pagine da leggere',
  reflect: 'Ragiono su quello che ho letto',
} as const;

export const POSITIONING_STEPS: Record<BrandKind, { goals: string; audiences: string }> = {
  person: { goals: 'Penso a perché pubblichi', audiences: 'Cerco chi vuoi raggiungere' },
  company: { goals: 'Penso a perché pubblicate', audiences: 'Cerco chi volete raggiungere' },
  client: { goals: 'Penso a perché pubblica', audiences: 'Cerco chi vuole raggiungere' },
};

export const THEMES_STEPS = {
  read: 'Rileggo cosa fa il brand',
  pick: 'Scelgo i temi che reggono un piano',
} as const;

export const VOICE_STEPS = {
  read: (source: 'pasted' | 'history' | 'recording') =>
    source === 'recording' ? 'Trascrivo la registrazione' : source === 'history' ? 'Leggo gli ultimi post pubblicati' : 'Leggo i tuoi testi',
  rhythm: 'Misuro ritmo e lunghezza delle frasi',
  card: 'Scrivo la scheda voce',
} as const;

export const VISUAL_STEPS = {
  references: (count: number) =>
    count === 0 ? 'Parto da palette, sito e indicazioni' : `Guardo ${count === 1 ? 'l’immagine' : `le ${count} immagini`} di riferimento`,
  line: 'Disegno la linea: fondo, caratteri, firma e rubriche',
  video: 'Penso a come si racconta il brand in video',
  card: (channel: string) => `Compongo la card per ${channel}`,
} as const;

const MAX_NAME = 48;

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function contextStep(site: string | null, known: string): { label: string; detail: string } {
  return {
    label: site ? `Rileggo quello che ho letto su ${site}` : 'Rileggo quello che mi hai scritto',
    detail: shorten(known.replace(/\s+/g, ' ').trim(), 90),
  };
}

export function pickedDetail(count: number, picked: readonly string[]): string {
  const marks = picked.map((item) => `«${item}»`);
  const list = marks.length > 1 ? `${marks.slice(0, -1).join(', ')} e ${marks[marks.length - 1]}` : (marks[0] ?? '');
  return `Ne propongo ${count}, scelgo ${list}`;
}

export function colorsFound(count: number): string {
  if (count === 0) return 'Nessuno nel codice: la palette la propongo io';
  return count === 1 ? 'Trovato un colore' : `Trovati ${count} colori`;
}

export function pageStep(url: string): { label: string; detail: string } {
  const address = url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  const [host = '', ...path] = address.split('/');
  const segments = path.filter(Boolean);
  const detail = [host.toLowerCase(), ...segments].join('/');
  if (segments.length === 0) return { label: 'Apro la home', detail };
  const name = segments[segments.length - 1].replace(/[-_+\s]+/g, ' ').trim();
  if (!name) return { label: 'Apro una pagina', detail };
  return { label: `Apro la pagina «${shorten(name.charAt(0).toUpperCase() + name.slice(1), MAX_NAME)}»`, detail };
}
