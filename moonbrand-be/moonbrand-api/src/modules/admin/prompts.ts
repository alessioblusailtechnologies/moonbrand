import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type {
  AdminBrandPrompts,
  AdminPromptEntry,
  AdminPromptFile,
  AdminPromptFileText,
  AdminPromptPiece,
  AdminPrompts,
  AdminPromptTool,
} from '@moonbrand/shared/api/contract';

import { aiDir, type Config } from '../../config';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';

// La sezione Prompt: tutti i punti in cui moonbrand chiama Claude o Gemini e cosa gli fa leggere, in sola lettura. I testi
// si leggono a ogni richiesta dal codice del worker (moonbrand-ai) che sta accanto all'API, quindi sono quelli che girano;
// il catalogo qui sotto dice solo dove sono. Se un pezzo cambia nome nel worker, la pagina lo mostra come «non trovato»;
// se nasce una chiamata nuova, finisce tra i file non catalogati.

// symbol: una costante (se è un template, il suo testo) o una funzione (il suo codice) del file.
interface PieceSource {
  kind: AdminPromptPiece['kind'];
  label: string;
  file: string;
  symbol?: string;
  text?: string;
}

interface CatalogEntry extends Omit<AdminPromptEntry, 'pieces'> {
  pieces: PieceSource[];
  // I file del worker che questa voce descrive: quelli che chiamano Claude o Gemini non finiscono tra i non catalogati.
  files: string[];
}

const SKILLS = ['contenuti', 'idee', 'piano', 'video', 'remotion-best-practices'];

const CLAUDE_CODE_PRESET: PieceSource = {
  kind: 'external',
  label: 'Prompt di sistema di Claude Code',
  file: 'Claude Agent SDK',
  text: 'Il prompt di sistema completo di Claude Code (preset claude_code): come usare gli strumenti, i file, i comandi. Non è nel nostro codice: lo porta l’SDK, e cambia con la sua versione.',
};
const SDK_MINIMAL: PieceSource = {
  kind: 'external',
  label: 'Prompt di sistema dell’SDK',
  file: 'Claude Agent SDK',
  text: 'Nessun prompt di sistema nostro: c’è quello minimo dell’Agent SDK, più le descrizioni degli strumenti e delle skill.',
};
const BRAND_GUIDE: PieceSource = {
  kind: 'brand',
  label: 'CLAUDE.md del brand (si riscrive prima di ogni lavoro)',
  file: 'src/lib/brand-guide.ts',
  symbol: 'brandGuide',
};
const BRAND_MEMORY: PieceSource = {
  kind: 'external',
  label: 'Memoria automatica del brand',
  file: 'Claude Code',
  text: 'Le note che Claude Code si scrive da solo per ogni brand (memory/ accanto alle sessioni): l’indice entra in ogni sessione e Claude apre le note quando gli servono. Si vedono qui sotto, scegliendo un brand.',
};
const LANGUAGE_RULES: PieceSource = { kind: 'message', label: 'Le lingue', file: 'src/lib/language.ts', symbol: 'languageRules' };
const REPLY_RULE: PieceSource = { kind: 'message', label: 'La lingua della risposta', file: 'src/lib/language.ts', symbol: 'replyRule' };
const VISION_INSTRUCTION: PieceSource = { kind: 'system', label: 'Istruzioni di Gemini', file: 'src/tools/vista.ts', symbol: 'VISION_INSTRUCTION' };

const CONTENT_TOOLS = ['grafica', 'immagini', 'vista', 'video: audio, musica, clip, lambda'];

const CATALOG: CatalogEntry[] = [
  {
    id: 'chat',
    name: 'Chat con l’assistente',
    trigger: 'Ogni messaggio in chat (lavoro chat): riprende la sessione del messaggio prima.',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: SKILLS,
    tools: ['moonbrand', 'grafica', 'immagini', 'vista', 'clip', 'social', 'audio', 'musica', 'lambda'],
    note: 'Il messaggio dell’utente arriva così com’è, con l’idea o l’uscita menzionate e gli allegati.',
    pieces: [
      CLAUDE_CODE_PRESET,
      { kind: 'system', label: 'La guida della chat', file: 'src/jobs/chat.ts', symbol: 'guide' },
      { kind: 'system', label: 'Come parli all’utente', file: 'src/lib/client-voice.ts', symbol: 'CLIENT_VOICE' },
      { ...LANGUAGE_RULES, kind: 'system' },
      { kind: 'message', label: 'L’idea menzionata', file: 'src/jobs/chat.ts', symbol: 'ideaBlock' },
      { kind: 'message', label: 'L’uscita menzionata', file: 'src/jobs/chat.ts', symbol: 'slotBlock' },
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/chat.ts', symbol: 'prompt' },
      BRAND_GUIDE,
      BRAND_MEMORY,
    ],
    files: ['src/jobs/chat.ts'],
  },
  {
    id: 'content',
    name: 'Contenuto da un’idea',
    trigger: 'Dalla sezione Idee, «crea il contenuto» (lavoro content). Per un video scrive solo il copione.',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: SKILLS,
    tools: CONTENT_TOOLS,
    note: 'Risponde con uno schema JSON (testi, file, copione).',
    pieces: [
      SDK_MINIMAL,
      { kind: 'message', label: 'L’idea', file: 'src/jobs/content.ts', symbol: 'ideaLines' },
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/content.ts', symbol: 'prompt' },
      LANGUAGE_RULES,
      BRAND_GUIDE,
      BRAND_MEMORY,
    ],
    files: ['src/jobs/content.ts', 'src/lib/content.ts'],
  },
  {
    id: 'content-edit',
    name: 'Correzione di un contenuto',
    trigger: 'Dalla sezione Contenuti, una richiesta di modifica (lavoro content-edit): riprende la sessione del contenuto.',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: SKILLS,
    tools: CONTENT_TOOLS,
    note: 'Il messaggio è la richiesta dell’utente, poi il compito e le lingue.',
    pieces: [
      SDK_MINIMAL,
      { kind: 'message', label: 'Il compito', file: 'src/jobs/content-edit.ts', symbol: 'task' },
      { kind: 'message', label: 'Canali e file', file: 'src/jobs/content-edit.ts', symbol: 'files' },
      LANGUAGE_RULES,
      BRAND_GUIDE,
      BRAND_MEMORY,
    ],
    files: ['src/jobs/content-edit.ts'],
  },
  {
    id: 'content-video',
    name: 'Video da un copione approvato',
    trigger: 'Dalla sezione Contenuti, l’ok al copione (lavoro content-video): riprende la sessione del copione.',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: SKILLS,
    tools: CONTENT_TOOLS,
    note: null,
    pieces: [
      SDK_MINIMAL,
      { kind: 'message', label: 'Le inquadrature', file: 'src/jobs/content-video.ts', symbol: 'sceneLines' },
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/content-video.ts', symbol: 'prompt' },
      LANGUAGE_RULES,
      BRAND_GUIDE,
      BRAND_MEMORY,
    ],
    files: ['src/jobs/content-video.ts'],
  },
  {
    id: 'ideas',
    name: 'Idee',
    trigger: 'Sezione Idee, «nuove idee» (lavoro ideas).',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: SKILLS,
    tools: [],
    note: 'Risponde con uno schema JSON.',
    pieces: [
      SDK_MINIMAL,
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/ideas.ts', symbol: 'prompt' },
      { kind: 'message', label: 'Le idee già decise e i gusti', file: 'src/jobs/ideas.ts', symbol: 'describeHistory' },
      REPLY_RULE,
      BRAND_GUIDE,
      BRAND_MEMORY,
    ],
    files: ['src/jobs/ideas.ts'],
  },
  {
    id: 'visual',
    name: 'Esempi dell’onboarding',
    trigger: 'Onboarding, i post d’esempio del brand (lavoro visual).',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: [],
    tools: ['immagini'],
    note: 'Senza skill e senza CLAUDE.md: il brand arriva in JSON nel messaggio.',
    pieces: [
      SDK_MINIMAL,
      { kind: 'message', label: 'Logo, colori e font', file: 'src/jobs/visual.ts', symbol: 'identity' },
      { kind: 'message', label: 'Lo stile (template o riferimenti)', file: 'src/jobs/visual.ts', symbol: 'source' },
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/visual.ts', symbol: 'prompt' },
      LANGUAGE_RULES,
    ],
    files: ['src/jobs/visual.ts', 'src/lib/examples.ts'],
  },
  {
    id: 'visual-edit',
    name: 'Correzione degli esempi',
    trigger: 'Onboarding, una richiesta di modifica agli esempi (lavoro visual-edit): riprende la sessione degli esempi.',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: [],
    tools: ['immagini'],
    note: null,
    pieces: [SDK_MINIMAL, { kind: 'message', label: 'Il messaggio', file: 'src/jobs/visual-edit.ts', symbol: 'prompt' }, LANGUAGE_RULES],
    files: ['src/jobs/visual-edit.ts'],
  },
  {
    id: 'website',
    name: 'Lettura del sito',
    trigger: 'Onboarding, il sito del brand (lavoro website).',
    model: 'Quello predefinito di Claude Code (il codice non lo sceglie)',
    skills: [],
    tools: ['WebFetch', 'WebSearch', 'Bash', 'Read'],
    note: 'Risponde con uno schema JSON (identità, colori, font, logo).',
    pieces: [SDK_MINIMAL, { kind: 'message', label: 'Il messaggio', file: 'src/jobs/website.ts', symbol: 'prompt' }, REPLY_RULE],
    files: ['src/jobs/website.ts'],
  },
  {
    id: 'style',
    name: 'Stile dai riferimenti',
    trigger: 'Dopo l’onboarding o un cambio dei riferimenti (lavoro style): Gemini guarda i riferimenti e scrive lo stile nel CLAUDE.md.',
    model: 'Gemini (GEMINI_VISION_MODEL, altrimenti quello di src/tools/vista.ts)',
    skills: [],
    tools: [],
    note: null,
    pieces: [VISION_INSTRUCTION, { kind: 'message', label: 'La domanda', file: 'src/jobs/style.ts', symbol: 'QUESTION' }],
    files: ['src/jobs/style.ts'],
  },
  {
    id: 'welcome',
    name: 'Benvenuto della chat',
    trigger: 'Una volta al giorno per brand (lavoro welcome): saluto e suggerimenti.',
    model: 'sonnet, senza strumenti né ragionamento',
    skills: [],
    tools: [],
    note: 'Risponde con uno schema JSON.',
    pieces: [
      { kind: 'system', label: 'Prompt di sistema', file: 'src/jobs/welcome.ts', symbol: 'SYSTEM' },
      { kind: 'message', label: 'Il messaggio', file: 'src/jobs/welcome.ts', symbol: 'prompt' },
      { kind: 'message', label: 'Esempi di tono (tre a caso)', file: 'src/jobs/welcome.ts', symbol: 'TONE' },
    ],
    files: ['src/jobs/welcome.ts'],
  },
  {
    id: 'step-reader',
    name: 'Righe dei passaggi',
    trigger: 'Durante ogni lavoro con Claude: traduce i passaggi dell’agente nelle righe che l’utente vede scorrere.',
    model: 'claude-haiku-5-5, effort low',
    skills: [],
    tools: [],
    note: null,
    pieces: [
      { kind: 'system', label: 'Prompt di sistema', file: 'src/lib/step-reader.ts', symbol: 'PROMPT' },
      { kind: 'system', label: 'Per inglese e francese', file: 'src/lib/step-reader.ts', symbol: 'promptFor' },
    ],
    files: ['src/lib/step-reader.ts'],
  },
  {
    id: 'vision',
    name: 'Motore di visione (guarda, renderizza, controlla_video)',
    trigger: 'Quando Claude usa guarda, renderizza con una domanda o controlla_video: Gemini guarda i file e risponde a parole.',
    model: 'Gemini (GEMINI_VISION_MODEL, altrimenti quello di src/tools/vista.ts)',
    skills: [],
    tools: [],
    note: 'La domanda la scrive Claude.',
    pieces: [
      VISION_INSTRUCTION,
      { kind: 'check', label: 'I fotogrammi di controlla_video', file: 'src/tools/controllo.ts', symbol: 'legend' },
    ],
    files: ['src/tools/vista.ts', 'src/tools/controllo.ts', 'src/tools/grafica.ts'],
  },
  {
    id: 'images',
    name: 'Immagini generate',
    trigger: 'Quando Claude usa genera_immagine.',
    model: 'Gemini immagini (src/tools/immagini.ts)',
    skills: [],
    tools: [],
    note: 'Nessun prompt nostro: Gemini riceve la descrizione scritta da Claude e le immagini di riferimento.',
    pieces: [],
    files: ['src/tools/immagini.ts'],
  },
];

// Chiamano Gemini ma non girano nei lavori: le foto d'esempio dei template si fanno a mano.
const IGNORED = new Set(['src/templates/foto.ts']);
const CALLS = /\bquery\(\{|\bgenerateContent\(|\binteractions\.create\(/;

const words = (text: string | null) => (text ? text.split(/\s+/).filter(Boolean).length : 0);

// Dove finisce la stringa che inizia in start (con le virgolette).
function stringEnd(src: string, start: number): number {
  const quote = src[start];
  let i = start + 1;
  while (i < src.length && src[i] !== quote) i += src[i] === '\\' ? 2 : 1;
  return i + 1;
}

// Dove finisce il codice che inizia in start: al primo stop fuori da parentesi, stringhe, template e commenti, oppure
// (stop null) quando si chiude la parentesi aperta per prima.
function codeEnd(src: string, start: number, stop: ';' | ',' | null): number {
  const stack: string[] = [];
  let i = start;
  while (i < src.length) {
    const char = src[i];
    if (stack.at(-1) === '`') {
      if (char === '`') stack.pop();
      if (char === '$' && src[i + 1] === '{') stack.push('${');
      i += char === '\\' || (char === '$' && src[i + 1] === '{') ? 2 : 1;
      continue;
    }
    if (char === '/' && src[i + 1] === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
    } else if (char === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i) + 2;
    } else if (char === "'" || char === '"') {
      i = stringEnd(src, i);
    } else if (char === '`' || char === '(' || char === '[' || char === '{') {
      stack.push(char);
      i++;
    } else if (char === ')' || char === ']' || char === '}') {
      stack.pop();
      i++;
      if (stop === null && stack.length === 0) return i;
    } else if (stop !== null && char === stop && stack.length === 0) {
      return i;
    } else {
      i++;
    }
  }
  return src.length;
}

// Il testo di una costante o di una funzione: di un template il contenuto tra i backtick, di tutto il resto il codice.
function extract(src: string, symbol: string): string | null {
  const declaration = new RegExp(`^[ \\t]*(?:export\\s+)?(?:(const|let)\\s+${symbol}\\b[^=\\n]*=\\s*|(?:async\\s+)?function\\s+${symbol}\\s*\\()`, 'm');
  const match = declaration.exec(src);
  if (!match) return null;
  const start = match.index + match[0].length;
  if (!match[1]) {
    const body = src.indexOf('{', codeEnd(src, start - 1, null));
    return src.slice(match.index, codeEnd(src, body, null)).trim();
  }
  const value = src.slice(start, codeEnd(src, start, ';')).trim();
  return value.startsWith('`') && codeEnd(value, 0, null) === value.length ? value.slice(1, -1) : value;
}

// Il testo di una descrizione fatta di stringhe unite con +; un template senza i backtick; se c'è altro, il codice com'è.
function literalText(expression: string): string {
  const trimmed = expression.trim();
  if (trimmed.startsWith('`') && codeEnd(trimmed, 0, null) === trimmed.length) return trimmed.slice(1, -1);
  const parts = trimmed.split(/\s*\+\s*(?=['"`])/);
  const literal = /^(['"])((?:\\.|(?!\1).)*)\1$|^`([^`$]*)`$/s;
  if (!parts.every((part) => literal.test(part))) return trimmed;
  return parts.map((part) => (literal.exec(part)![2] ?? literal.exec(part)![3]).replace(/\\(.)/g, '$1')).join('');
}

// Gli strumenti dei server MCP del worker: nome e descrizione, come li vede Claude.
function toolsOf(file: string, src: string): AdminPromptTool[] {
  const tools: AdminPromptTool[] = [];
  for (const match of src.matchAll(/\btool\(\s*'([a-z_]+)',\s*/g)) {
    const start = match.index + match[0].length;
    tools.push({ file, name: match[1], description: literalText(src.slice(start, codeEnd(src, start, ','))) });
  }
  return tools;
}

async function filesUnder(root: string, dir: string, keep: (relative: string) => boolean): Promise<string[]> {
  const entries = await readdir(path.join(root, dir), { recursive: true, withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(root, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    // Le cartelle nascoste e node_modules non le carica nessuno.
    .filter((relative) => !relative.split('/').some((segment) => segment === 'node_modules' || segment.startsWith('.')) && keep(relative))
    .sort();
}

const fileQuery = z.object({ path: z.string().regex(/^plugin\/[A-Za-z0-9._\/-]+\.md$/, 'File non valido.') });
const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });

export function registerAdminPrompts(scope: FastifyInstance, pool: pg.Pool, files: BrandFiles, settings: Pick<Config, 'AI_DIR'>): void {
  const root = aiDir(settings);
  const read = (relative: string) => readFile(path.join(root, relative), 'utf8').then((text) => text.replace(/\r\n/g, '\n')).catch(() => null);

  scope.get('/v1/admin/prompts', async (): Promise<AdminPrompts> => {
    const sources = await filesUnder(root, 'src', (relative) => relative.endsWith('.ts'));
    const texts = new Map(await Promise.all(sources.map(async (file) => [file, (await read(file)) ?? ''] as const)));

    const entries = CATALOG.map(({ files: _files, pieces, ...entry }) => ({
      ...entry,
      pieces: pieces.map(({ kind, label, file, symbol, text }): AdminPromptPiece => {
        const found = symbol ? extract(texts.get(file) ?? '', symbol) : (text ?? null);
        return { kind, label, source: symbol ? `${file} · ${symbol}` : file, text: found, words: words(found) };
      }),
    }));

    const described = new Set(CATALOG.flatMap((entry) => [...entry.files, ...entry.pieces.map((piece) => piece.file)]));
    const uncatalogued = sources.filter((file) => !described.has(file) && !IGNORED.has(file) && CALLS.test(texts.get(file) ?? ''));

    const tools = sources.filter((file) => file.startsWith('src/tools/')).flatMap((file) => toolsOf(file, texts.get(file) ?? ''));

    const plugin = await filesUnder(root, 'plugin', (relative) => relative.endsWith('.md'));
    const promptFiles: AdminPromptFile[] = await Promise.all(plugin.map(async (file) => ({ path: file, words: words(await read(file)) })));

    const { rows } = await pool.query<{ id: string; name: string | null; email: string }>(
      `select b.id, b.identity->>'name' as name, a.email from presenza.brands b join presenza.accounts a on a.id = b.account_id
       order by lower(coalesce(b.identity->>'name', '')), a.email`,
    );

    return { entries, tools, files: promptFiles, uncatalogued, brands: rows.map((row) => ({ id: row.id, name: row.name ?? 'Brand', email: row.email })) };
  });

  scope.get('/v1/admin/prompts/file', async (request): Promise<AdminPromptFileText> => {
    const { path: relative } = fileQuery.parse(request.query);
    if (relative.split('/').some((segment) => segment.startsWith('.'))) throw ApiError.invalid('File non valido.');
    const text = await read(relative);
    if (text === null) throw ApiError.notFound('File non trovato.');
    return { path: relative, text };
  });

  scope.get('/v1/admin/prompts/brands/:brandId', async (request): Promise<AdminBrandPrompts> => {
    const { brandId } = brandParams.parse(request.params);
    return files.promptFiles(brandId);
  });
}
