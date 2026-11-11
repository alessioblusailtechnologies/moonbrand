import type { BrandCategory, BrandFonts, BrandKind, Palette } from '../domain/brand';
import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from '../i18n/locales';
import { steps as stepMessages } from '../i18n/messages/steps';
import { translate, type MessageKey } from '../i18n/translate';

// kind: un blocco di testo di Claude o una chiamata a un tool; manca negli step scritti a mano.
// tool: il nome del tool chiamato, per il codice; a chi aspetta si mostrano solo label e detail.
// startedAt, endedAt: in millisecondi, per il tempo di ogni passaggio; mancano negli step salvati prima.
// media: le immagini e i video che il passaggio sta producendo: lo studio mostra i segnaposto di quello che arriverà.
export interface AiStep {
  id: string;
  label: string;
  detail?: string;
  status: 'running' | 'done' | 'failed';
  kind?: 'text' | 'tool';
  tool?: string;
  startedAt?: number;
  endedAt?: number;
  media?: StepMedia[];
}

// Un file in arrivo: immagine, video, audio, documento o pagina HTML. La proporzione per il segnaposto e, quando si sa,
// il file nella cartella del brand, per contare una volta sola un file rifatto più volte; il worker lo registra come
// artefatto della conversazione quando il passaggio finisce. title: quando il modello lo dà (tool mostra).
export interface StepMedia {
  kind: 'image' | 'video' | 'audio' | 'document' | 'html';
  aspect?: string;
  file?: string;
  title?: string;
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
  category: BrandCategory | null;
  summary: string;
  pitch: string;
  themes: string[];
  goals: string[];
  audiences: string[];
  palette: Palette;
  logoUri: string | null;
  fonts: BrandFonts | null;
  // La lingua dei post che il sito suggerisce (siteLanguage).
  language: Locale;
}

export interface PositioningIdeas {
  goals: string[];
  audiences: string[];
  picked: { goals: string[]; audiences: string[] };
}

export const THINKING_STEP = 'thinking';

// I passaggi dei lavori dell'onboarding, nella lingua di chi aspetta (i18n/messages/steps, onboarding).
const onboarding = (locale: Locale) => stepMessages[locale].onboarding;

export const websiteSteps = (locale: Locale = DEFAULT_LOCALE) => onboarding(locale).website;

export function positioningSteps(kind: BrandKind, locale: Locale = DEFAULT_LOCALE): { goals: string; audiences: string } {
  const { goals, audiences } = onboarding(locale);
  return { goals: goals[kind], audiences: audiences[kind] };
}

export const themesSteps = (locale: Locale = DEFAULT_LOCALE) => onboarding(locale).themes;

export function visualSteps(locale: Locale = DEFAULT_LOCALE) {
  const visual = onboarding(locale).visual;
  return {
    references: (count: number) => (count === 0 ? visual.noReferences : translate(locale, 'steps.onboarding.visual.references', { n: count })),
    line: visual.line,
    video: visual.video,
    card: (channel: string) => translate(locale, 'steps.onboarding.visual.card', { channel }),
  };
}

const MAX_NAME = 48;

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function contextStep(site: string | null, known: string, locale: Locale = DEFAULT_LOCALE): { label: string; detail: string } {
  return {
    label: site ? translate(locale, 'steps.onboarding.contextSite', { site }) : translate(locale, 'steps.onboarding.contextWritten'),
    detail: shorten(known.replace(/\s+/g, ' ').trim(), 90),
  };
}

// picked: le voci già come si leggono (non gli id del catalogo).
export function pickedDetail(count: number, picked: readonly string[], locale: Locale = DEFAULT_LOCALE): string {
  const quote = locale === 'en' ? (item: string) => `“${item}”` : (item: string) => (locale === 'fr' ? `« ${item} »` : `«${item}»`);
  const list = new Intl.ListFormat(INTL_LOCALES[locale], { type: 'conjunction' }).format(picked.map(quote));
  return translate(locale, 'steps.onboarding.picked', { count, list });
}

export function colorsFound(count: number, locale: Locale = DEFAULT_LOCALE): string {
  return count === 0 ? onboarding(locale).noColors : translate(locale, 'steps.onboarding.colors', { n: count });
}

export function pageStep(url: string, locale: Locale = DEFAULT_LOCALE): { label: string; detail: string } {
  const address = url
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  const [host = '', ...path] = address.split('/');
  const segments = path.filter(Boolean);
  const detail = [host.toLowerCase(), ...segments].join('/');
  if (segments.length === 0) return { label: translate(locale, 'steps.openHome'), detail };
  const name = segments[segments.length - 1].replace(/[-_+\s]+/g, ' ').trim();
  if (!name) return { label: translate(locale, 'steps.openPage'), detail };
  return { label: translate(locale, 'steps.openNamedPage', { name: shorten(name.charAt(0).toUpperCase() + name.slice(1), MAX_NAME) }), detail };
}

// Le skill di moonbrand, per nome senza il prefisso del plugin.
const SKILL_STEPS: Record<string, MessageKey> = {
  contenuti: 'steps.skills.contents',
  idee: 'steps.skills.ideas',
  video: 'steps.skills.video',
  'remotion-best-practices': 'steps.skills.editing',
};

// I tool che si traducono sempre allo stesso modo; null: non si mostrano.
const TOOL_STEPS: Record<string, MessageKey | null> = {
  TodoWrite: null,
  ToolSearch: null,
  Glob: null,
  Grep: null,
  StructuredOutput: 'steps.tools.tidy',
  mcp__moonbrand__contenuti_elenca: 'steps.tools.listContents',
  mcp__moonbrand__contenuto_leggi: 'steps.tools.readContent',
  mcp__moonbrand__contenuto_salva: 'steps.tools.saveContent',
  mcp__moonbrand__contenuto_aggiorna: 'steps.tools.updateContent',
  mcp__moonbrand__contenuto_approva: 'steps.tools.approveContent',
  mcp__moonbrand__contenuto_riapri: 'steps.tools.reopenContent',
  mcp__moonbrand__idee_elenca: 'steps.tools.listIdeas',
  mcp__moonbrand__idea_salva: 'steps.tools.saveIdea',
  mcp__moonbrand__pubblicazione_proponi: 'steps.tools.proposePublish',
  mcp__moonbrand__piano_leggi: 'steps.tools.readPlan',
  mcp__moonbrand__piano_proponi: 'steps.tools.proposePlan',
  mcp__moonbrand__uscite_crea: 'steps.tools.createSlots',
  mcp__moonbrand__uscita_cambia: 'steps.tools.changeSlot',
  mcp__moonbrand__uscita_togli: 'steps.tools.removeSlot',
  mcp__immagini__genera_immagine: 'steps.tools.image',
  mcp__immagini__foto: 'steps.tools.photo',
  mcp__grafica__renderizza: 'steps.tools.render',
  mcp__audio__cerca_voci: 'steps.tools.chooseVoice',
  mcp__audio__genera_voce: 'steps.tools.recordVoice',
  mcp__audio__tempi_parole: 'steps.tools.timeWords',
  mcp__audio__genera_effetto: 'steps.tools.soundEffect',
  mcp__musica__genera_musica: 'steps.tools.music',
  mcp__musica__genera_canzone: 'steps.tools.song',
  mcp__musica__attendi_musica: 'steps.tools.waitMusic',
  mcp__lambda__esporta_video: 'steps.tools.exportVideos',
  mcp__vista__controlla_video: 'steps.tools.checkVideo',
  mcp__clip__gira_clip: 'steps.tools.clip',
  mcp__clip__attendi_clip: 'steps.tools.waitClips',
  mcp__social__scarica_social: 'steps.tools.downloadSocial',
};

// Le immagini e i video che Claude apre con Read.
const MEDIA_FILE = /\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i;

// Come si mostra la chiamata a un tool: null se non si mostra, undefined se la tabella non la conosce
// (allora la legge Haiku nel worker). locale: la lingua dell'account che aspetta.
export function toolStep(
  name: string,
  input: { url?: unknown; query?: unknown; skill?: unknown; title?: unknown; file?: unknown; file_path?: unknown },
  locale: Locale = DEFAULT_LOCALE,
): { label: string; detail?: string } | null | undefined {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? shorten(value.replace(/\s+/g, ' ').trim(), 90) : undefined);
  if (name === 'WebFetch' && typeof input.url === 'string') return pageStep(input.url, locale);
  if (name === 'WebSearch') {
    const detail = text(input.query);
    return { label: translate(locale, 'steps.searchWeb'), ...(detail && { detail }) };
  }
  if (name === 'mcp__vista__guarda') {
    return { label: translate(locale, lookLabel(Array.isArray(input.file) ? input.file.filter((file) => typeof file === 'string') : [])) };
  }
  // I file che Claude apre e scrive da solo: un'immagine o un video che guarda (di solito la grafica appena fatta, da
  // controllare), una pagina HTML che impagina. Il resto (note, testi, comandi) lo legge Haiku.
  if (name === 'Read' && typeof input.file_path === 'string') {
    const file = input.file_path.replace(/\\/g, '/');
    if (!MEDIA_FILE.test(file)) return undefined;
    const key = lookLabel([file]);
    return { label: translate(locale, key === 'steps.look.image' ? 'steps.tools.checkImage' : key) };
  }
  if ((name === 'Write' || name === 'Edit') && typeof input.file_path === 'string' && /\.html?$/i.test(input.file_path)) {
    return { label: translate(locale, 'steps.tools.layout') };
  }
  if (name === 'Skill' && typeof input.skill === 'string') {
    const key = SKILL_STEPS[input.skill.replace(/^moonbrand:/, '')];
    return key ? { label: translate(locale, key) } : undefined;
  }
  if (!(name in TOOL_STEPS)) return undefined;
  const key = TOOL_STEPS[name];
  if (key === null) return null;
  // Di un contenuto o di un’idea salvati si mostra il titolo.
  const detail = /contenuto_(salva|aggiorna)$|idea_salva$/.test(name) ? text(input.title) : undefined;
  return { label: translate(locale, key), ...(detail && { detail }) };
}

// Cosa si guarda con il tool guarda, detto a chi aspetta.
function lookLabel(files: string[]): MessageKey {
  if (files.length > 0 && files.every((file) => /(^|\/)allegati\//.test(file))) return 'steps.look.attachments';
  if (files.length > 0 && files.every((file) => /(^|\/)(riferimenti-da-seguire|file-riferimento)\//.test(file))) return 'steps.look.references';
  const videos = files.filter((file) => /\.(mp4|mov|webm)$/i.test(file)).length;
  if (videos > 0) return videos === 1 ? 'steps.look.video' : 'steps.look.videos';
  return files.length === 1 ? 'steps.look.image' : 'steps.look.images';
}

// I file del brand si mostrano solo con un percorso pulito, relativo alla sua cartella.
const BRAND_FILE = /^[a-z0-9-]+(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/;
const ASPECT = /^\d+(\.\d+)?:\d+(\.\d+)?$/;
// Al massimo tanti segnaposto per passaggio: un lotto grande non riempie la chat.
const MAX_MEDIA = 8;

const brandFile = (value: unknown): string | undefined => (typeof value === 'string' && BRAND_FILE.test(value) ? value : undefined);
const aspectOf = (value: unknown, fallback: string): string => (typeof value === 'string' && ASPECT.test(value) ? value : fallback);

// La proporzione scritta nel nome di un file, come video-9x16.mp4.
const aspectInName = (file: string): string | undefined => /(\d+(?:\.\d+)?)x(\d+)(?=[._-][^/]*$|$)/.exec(file.replace(/\.[^.]+$/, ''))?.slice(1).join(':');

// Il video che un comando esporta con Remotion: l'MP4 nel comando, riportato alla cartella del brand se si è entrati in video/.
function remotionRender(command: string): StepMedia | null {
  if (!/remotion(\.cmd)?["']?\s+render\b/.test(command)) return null;
  const out = [...command.matchAll(/(?:^|\s)["']?([^\s"']+\.mp4)["']?/g)].pop()?.[1];
  const inVideo = /\bcd\s+["']?video["']?\s*(&&|;)/.test(command);
  const relative = out?.replace(/^\.\//, '');
  const file = relative && (inVideo ? (relative.startsWith('../') ? brandFile(relative.slice(3)) : brandFile(`video/${relative}`)) : brandFile(relative));
  return { kind: 'video', aspect: (file && aspectInName(file)) ?? '9:16', ...(file && { file }) };
}

// Che cosa è un file, dall'estensione: undefined se non si mostra (JSON, codice, note di lavoro).
export function fileKind(file: string): StepMedia['kind'] | undefined {
  const extension = /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(extension)) return 'video';
  if (['mp3', 'wav', 'm4a', 'ogg', 'aac'].includes(extension)) return 'audio';
  if (['md', 'pdf', 'txt'].includes(extension)) return 'document';
  if (['html', 'htm'].includes(extension)) return 'html';
  return undefined;
}

// I file che una chiamata a un tool produce: le card di renderizza, le foto di genera_immagine, le clip, la musica, le
// voci e gli effetti, i video esportati su Lambda o con Remotion, il file che il modello mostra con mostra.
// undefined se non produce niente da mostrare. I nomi dei tool arrivano con il prefisso del server MCP (v1-v3,
// mcp__media__genera_immagine) o senza (v4, genera_immagine); nella v1 il file stava in file, dal v3 in salva.
export function toolMedia(name: string, input: Record<string, unknown>): StepMedia[] | undefined {
  const bare = name.split('__').pop() ?? name;
  const saved = brandFile(input['salva']) ?? brandFile(input['file']);
  const aspect = (fallback: string) => aspectOf(input['proporzione'] ?? input['formato'], fallback);
  if (bare === 'renderizza' && Array.isArray(input['uscite'])) {
    const outputs = (input['uscite'] as Record<string, unknown>[]).filter((output) => output && typeof output === 'object');
    return outputs.slice(0, MAX_MEDIA).map((output) => {
      const file = brandFile(output['file']);
      return { kind: 'image' as const, aspect: aspectOf(output['formato'], '1:1'), ...(file && { file }) };
    });
  }
  if (bare === 'esporta_video' && Array.isArray(input['video'])) {
    const outputs = (input['video'] as Record<string, unknown>[]).filter((output) => output && typeof output === 'object');
    return outputs.slice(0, MAX_MEDIA).map((output) => {
      const file = brandFile(output['file']);
      return { kind: 'video' as const, aspect: (file && aspectInName(file)) ?? '9:16', ...(file && { file }) };
    });
  }
  if (bare === 'genera_immagine') return [{ kind: 'image', aspect: aspect('1:1'), ...(saved && { file: saved }) }];
  if (bare === 'genera_clip' || bare === 'gira_clip') return [{ kind: 'video', aspect: aspect('9:16'), ...(saved && { file: saved }) }];
  if (['genera_musica', 'genera_canzone', 'genera_voce', 'genera_effetto'].includes(bare)) return [{ kind: 'audio', ...(saved && { file: saved }) }];
  if (bare === 'migliora') {
    const file = brandFile(input['salva']);
    const kind = file && fileKind(file);
    return kind ? [{ kind, file }] : undefined;
  }
  if (bare === 'mostra') {
    const file = brandFile(input['file']);
    const kind = file && fileKind(file);
    const title = typeof input['titolo'] === 'string' && input['titolo'].trim() ? input['titolo'].trim().slice(0, 120) : undefined;
    return kind ? [{ kind, file, ...(title && { title }) }] : undefined;
  }
  // Bash in Claude Code, bash in Pi.
  if (bare.toLowerCase() === 'bash' && typeof input['command'] === 'string') {
    const video = remotionRender(input['command']);
    return video ? [video] : undefined;
  }
  return undefined;
}
