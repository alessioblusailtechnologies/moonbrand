import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { sessionsDir } from '../../lib/brand-sync';

// Quando riprendere la sessione costa troppo, la conversazione continua in una sessione nuova. Ogni chiamata di Opus
// rilegge tutto il contesto, e i ritocchi su una sessione da 200-300K costano 1,2-1,7 $ l'uno (reel Sunraise, 21/10).
// Dopo una pausa lunga la cache è scaduta e il resume riscrive tutto. Alla sessione nuova non va un sunto scritto da
// un modello: va il dialogo, preso dal JSONL con il codice. Ci sono i messaggi dell'utente parola per parola e la
// risposta finale di Claude a ogni turno, senza i passaggi intermedi né i risultati dei tool, che sono il grosso del
// contesto. I file del lavoro restano nella cartella del brand. Quello che è stato fatto (i contenuti salvati, con l'id
// per riscriverli, e le cartelle di lavoro) lo dicono le chiamate ai tool, sempre nel JSONL.

// Oltre questo contesto all'ultima chiamata si cambia sessione: la base è di circa 44K.
const MAX_CONTEXT = Number(process.env.MOONBRAND_CHAT_MAX_CONTEXT) || 100_000;
// La cache di Claude dura un'ora: dopo una pausa così il resume riscriverebbe tutto il contesto.
const MAX_PAUSE_MS = 55 * 60_000;
// Il dialogo che passa alla sessione nuova: oltre, si tengono i turni più recenti.
const MAX_DIALOGUE_CHARS = 60_000;
// Le cartelle di lavoro elencate: le più usate.
const MAX_FOLDERS = 12;
const CONTENT_ID = /"id"\s*:\s*"([0-9a-f-]{36})"/;
const WORK_PATH = /lavoro\/[A-Za-z0-9._-]+\/?/g;

interface Block {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | { type: string; text?: string }[];
}

interface Entry {
  type?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  timestamp?: string;
  message?: {
    content?: string | Block[];
    usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
}

interface Turn {
  user: string;
  reply: string;
}

// Un contenuto salvato nella conversazione, com'era all'ultimo salvataggio.
interface Saved {
  id?: string;
  title: string;
  format: string;
  channels: string[];
  files: string[];
}

export interface Handover {
  reason: string;
  context: number;
  prompt: string;
}

const textOf = (value: string | { type: string; text?: string }[] | undefined) =>
  typeof value === 'string'
    ? value
    : (value ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join('\n');

// La sessione da riprendere va bene così, oppure il passaggio a una nuova con il dialogo fin qui.
export async function handover(brandDir: string, sessionId: string, now = Date.now()): Promise<Handover | null> {
  // MOONBRAND_CHAT_HANDOVER=off riprende sempre la sessione, come nel v2.
  if (process.env.MOONBRAND_CHAT_HANDOVER === 'off') return null;
  const raw = await readFile(path.join(sessionsDir(brandDir), `${sessionId}.jsonl`), 'utf8').catch(() => null);
  if (!raw) return null;
  const entries = raw.split('\n').flatMap((line) => {
    try {
      return line ? [JSON.parse(line) as Entry] : [];
    } catch {
      return [];
    }
  });

  let context = 0;
  let last = 0;
  const turns: Turn[] = [];
  const work = new Work(brandDir);
  for (const entry of entries) {
    if (entry.isSidechain || entry.isMeta) continue;
    const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
    if (!Number.isNaN(at)) last = Math.max(last, at);
    const content = entry.message?.content;
    const blocks = Array.isArray(content) ? content : [];
    if (entry.type === 'user') {
      // I risultati dei tool arrivano come messaggi dell'utente senza testo: non sono un turno.
      const text = textOf(content).trim();
      if (text) turns.push({ user: text, reply: '' });
      for (const block of blocks) if (block.type === 'tool_result') work.result(block);
    } else if (entry.type === 'assistant') {
      const usage = entry.message?.usage;
      if (usage) context = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
      // La risposta del turno è l'ultimo testo di Claude prima del messaggio successivo dell'utente.
      const text = textOf(content).trim();
      const turn = turns.at(-1);
      if (text && turn) turn.reply = text;
      for (const block of blocks) if (block.type === 'tool_use') work.call(block);
    }
  }

  const pause = last ? now - last : 0;
  const reason = context > MAX_CONTEXT ? `contesto di ${Math.round(context / 1000)}K` : pause > MAX_PAUSE_MS ? `pausa di ${Math.round(pause / 60_000)} minuti` : null;
  if (!reason || turns.length === 0) return null;
  return { reason, context, prompt: dialogue(turns, work.summary()) };
}

// Quello che la conversazione ha fatto, dalle chiamate ai tool: i contenuti salvati e le cartelle di lavoro toccate.
class Work {
  private readonly root: string;
  private readonly pending = new Map<string, Saved>();
  private readonly saved = new Map<string, Saved>();
  private readonly folders = new Map<string, { uses: number; inside: boolean }>();

  constructor(brandDir: string) {
    this.root = path.resolve(brandDir);
  }

  call(block: Block) {
    const input = block.input ?? {};
    const name = block.name ?? '';
    if (name.endsWith('salva_contenuto')) {
      const files = Array.isArray(input.file) ? (input.file as { file?: string }[]).flatMap((item) => (item.file ? [item.file] : [])) : [];
      this.pending.set(block.id ?? '', {
        ...(typeof input.id === 'string' && { id: input.id }),
        title: String(input.titolo ?? ''),
        format: String(input.formato ?? ''),
        channels: Array.isArray(input.canali) ? input.canali.map(String) : [],
        files,
      });
      return;
    }
    const paths: unknown[] = [input.file_path, input.progetto, ...(Array.isArray(input.salva) ? input.salva : [input.salva])];
    if (name === 'Bash' && typeof input.command === 'string') paths.push(...(input.command.match(WORK_PATH) ?? []));
    for (const value of paths) if (typeof value === 'string') this.folder(value);
  }

  // L'id di un contenuto nuovo arriva nella risposta del tool; se il salvataggio non è riuscito, non c'è.
  result(block: Block) {
    const content = this.pending.get(block.tool_use_id ?? '');
    if (!content) return;
    this.pending.delete(block.tool_use_id ?? '');
    const id = CONTENT_ID.exec(textOf(block.content))?.[1];
    if (!id) return;
    // L'ultimo salvataggio vince e va in fondo.
    this.saved.delete(id);
    this.saved.set(id, { ...content, id });
  }

  // Le cartelle di primo livello sotto lavoro/, relative alla cartella del brand: un nome senza niente sotto e con
  // l'estensione è un file sciolto, non una cartella.
  private folder(value: string) {
    const relative = path.isAbsolute(value) ? path.relative(this.root, value) : value;
    const parts = relative.split(/[\/]/).filter(Boolean);
    if (parts[0] !== 'lavoro' || parts.length < 2) return;
    const folder = `lavoro/${parts[1]}/`;
    const seen = this.folders.get(folder) ?? { uses: 0, inside: false };
    this.folders.set(folder, { uses: seen.uses + 1, inside: seen.inside || parts.length > 2 || !/\.[a-z0-9]+$/i.test(parts[1]!) });
  }

  summary(): string {
    const contents = [...this.saved.values()].map(
      ({ id, title, format, channels, files }) => `- «${title}» (${format}${channels.length > 0 ? `, ${channels.join(', ')}` : ''}), id ${id}: ${files.join(', ')}`,
    );
    const folders = [...this.folders.entries()]
      .filter(([, folder]) => folder.inside)
      .sort((a, b) => b[1].uses - a[1].uses)
      .slice(0, MAX_FOLDERS)
      .map(([folder]) => `- ${folder}`);
    return [
      contents.length > 0 && `I contenuti salvati in questa conversazione (per cambiarne uno, salva_contenuto con il suo id):\n${contents.join('\n')}`,
      folders.length > 0 && `Le cartelle di lavoro toccate, dalla più usata:\n${folders.join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }
}

function dialogue(turns: Turn[], work: string): string {
  const blocks = turns.map(({ user, reply }) => [`Utente:\n${user}`, reply && `Tu:\n${reply}`].filter(Boolean).join('\n\n'));
  // Si tengono i turni più recenti che stanno nel limite; il primo, se c'è, porta già il dialogo delle sessioni prima.
  const kept: string[] = [];
  let size = 0;
  for (const block of [...blocks].reverse()) {
    if (size + block.length > MAX_DIALOGUE_CHARS && kept.length > 0) break;
    kept.unshift(block);
    size += block.length;
  }
  const omitted = blocks.length - kept.length;
  return [
    'Questa conversazione con l’utente continua da una sessione precedente. Ecco il dialogo fin qui: i messaggi dell’utente e le tue risposte, senza i passaggi intermedi. ' +
      'Il lavoro fatto è nella cartella del brand e i contenuti salvati li leggi con i tool di moonbrand: riguarda quello che serve prima di cambiarlo.',
    omitted > 0 && `(${omitted} turni più vecchi omessi.)`,
    kept.join('\n\n---\n\n'),
    work && `--- Fine del dialogo. Cosa c’è già:\n\n${work}`,
    '--- Il nuovo messaggio dell’utente:',
  ]
    .filter(Boolean)
    .join('\n\n');
}
