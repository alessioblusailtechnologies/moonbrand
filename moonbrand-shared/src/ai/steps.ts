import type { BrandKind, Palette } from '../domain/brand';

// kind: un blocco di testo di Claude o una chiamata a un tool; manca negli step scritti a mano.
// tool: il nome del tool chiamato, per il codice; a chi aspetta si mostrano solo label e detail.
// startedAt, endedAt: in millisecondi, per il tempo di ogni passaggio; mancano negli step salvati prima.
export interface AiStep {
  id: string;
  label: string;
  detail?: string;
  status: 'running' | 'done' | 'failed';
  kind?: 'text' | 'tool';
  tool?: string;
  startedAt?: number;
  endedAt?: number;
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
      update([...steps.filter((step) => step.id !== id), { id, label, ...(detail ? { detail } : {}), status: 'running', startedAt: Date.now() }]),
    finish: (id, { failed = false, detail } = {}) => {
      if (!steps.some((step) => step.id === id)) return;
      update(steps.map((step) => (step.id === id ? { ...step, status: failed ? 'failed' : 'done', endedAt: Date.now(), ...(detail !== undefined && { detail }) } : step)));
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
  logoUri: string | null;
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

// Le skill di moonbrand, per nome senza il prefisso del plugin.
const SKILL_STEPS: Record<string, string> = {
  contenuti: 'Ripasso come si prepara un contenuto',
  idee: 'Ripasso come si propone un’idea',
  video: 'Ripasso come si fa un video',
  'remotion-best-practices': 'Ripasso come si monta un video',
};

// I tool che si traducono sempre allo stesso modo; null: non si mostrano.
const TOOL_STEPS: Record<string, string | null> = {
  TodoWrite: null,
  ToolSearch: null,
  StructuredOutput: 'Metto tutto in ordine',
  mcp__moonbrand__contenuti_elenca: 'Guardo i contenuti già fatti',
  mcp__moonbrand__contenuto_leggi: 'Rileggo il contenuto',
  mcp__moonbrand__contenuto_salva: 'Salvo la bozza in Contenuti',
  mcp__moonbrand__contenuto_aggiorna: 'Aggiorno il contenuto in Contenuti',
  mcp__moonbrand__idee_elenca: 'Guardo le idee salvate',
  mcp__moonbrand__idea_salva: 'Salvo l’idea in Idee',
  mcp__immagini__genera_immagine: 'Creo un’immagine',
  mcp__grafica__renderizza: 'Impagino e controllo la grafica',
  mcp__audio__cerca_voci: 'Scelgo la voce',
  mcp__audio__genera_voce: 'Registro la voce fuori campo',
  mcp__audio__tempi_parole: 'Metto a tempo le parole',
  mcp__audio__genera_effetto: 'Creo un effetto sonoro',
  mcp__musica__genera_musica: 'Compongo la musica',
  mcp__musica__genera_canzone: 'Compongo la canzone',
  mcp__higgsfield__generate_video: 'Giro una clip',
  mcp__higgsfield__generate_video_batch: 'Giro le clip',
  mcp__higgsfield__generate_image: 'Creo un’immagine',
  mcp__higgsfield__generate_image_batch: 'Creo le immagini',
  mcp__higgsfield__jobs_wait: 'Aspetto che clip e immagini siano pronte',
};

// Come si mostra la chiamata a un tool: null se non si mostra, undefined se la tabella non la conosce
// (allora la legge Haiku nel worker).
export function toolStep(
  name: string,
  input: { url?: unknown; query?: unknown; skill?: unknown; title?: unknown; file?: unknown },
): { label: string; detail?: string } | null | undefined {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? shorten(value.replace(/\s+/g, ' ').trim(), 90) : undefined);
  if (name === 'WebFetch' && typeof input.url === 'string') return pageStep(input.url);
  if (name === 'WebSearch') {
    const detail = text(input.query);
    return { label: 'Cerco in rete', ...(detail && { detail }) };
  }
  if (name === 'mcp__vista__guarda') return { label: lookLabel(Array.isArray(input.file) ? input.file.filter((file) => typeof file === 'string') : []) };
  if (name === 'Skill' && typeof input.skill === 'string') {
    const label = SKILL_STEPS[input.skill.replace(/^moonbrand:/, '')];
    return label ? { label } : undefined;
  }
  if (!(name in TOOL_STEPS)) return undefined;
  const label = TOOL_STEPS[name];
  if (label === null) return null;
  // Di un contenuto o di un’idea salvati si mostra il titolo.
  const detail = /contenuto_(salva|aggiorna)$|idea_salva$/.test(name) ? text(input.title) : undefined;
  return { label, ...(detail && { detail }) };
}

// Cosa si guarda con il tool guarda, detto a chi aspetta.
function lookLabel(files: string[]): string {
  if (files.length > 0 && files.every((file) => /(^|\/)allegati\//.test(file))) return 'Guardo quello che mi hai mandato';
  if (files.length > 0 && files.every((file) => /(^|\/)(riferimenti-da-seguire|file-riferimento)\//.test(file))) return 'Studio lo stile dei tuoi riferimenti';
  const videos = files.filter((file) => /\.(mp4|mov|webm)$/i.test(file)).length;
  if (videos > 0) return videos === 1 ? 'Guardo il video' : 'Guardo i video';
  return files.length === 1 ? 'Guardo l’immagine' : 'Guardo le immagini';
}
