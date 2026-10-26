import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { sessionsDir } from '../../lib/brand-sync';

// Quando riprendere la sessione costa troppo, la conversazione continua in una sessione nuova. Ogni chiamata di Opus
// rilegge tutto il contesto, e i ritocchi su una sessione da 200-300K costano 1,2-1,7 $ l'uno (reel Sunraise, 21/10).
// Dopo una pausa lunga la cache è scaduta e il resume riscrive tutto. Alla sessione nuova non va un sunto scritto da
// un modello: va il dialogo, preso dal JSONL con il codice. Ci sono i messaggi dell'utente parola per parola e la
// risposta finale di Claude a ogni turno, senza i passaggi intermedi né i risultati dei tool, che sono il grosso del
// contesto. I file del lavoro restano nella cartella del brand.

// Oltre questo contesto all'ultima chiamata si cambia sessione: la base è di circa 44K.
const MAX_CONTEXT = Number(process.env.MOONBRAND_CHAT_MAX_CONTEXT) || 100_000;
// La cache di Claude dura un'ora: dopo una pausa così il resume riscriverebbe tutto il contesto.
const MAX_PAUSE_MS = 55 * 60_000;
// Il dialogo che passa alla sessione nuova: oltre, si tengono i turni più recenti.
const MAX_DIALOGUE_CHARS = 60_000;

interface Entry {
  type?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  timestamp?: string;
  message?: {
    content?: string | { type: string; text?: string }[];
    usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
  };
}

interface Turn {
  user: string;
  reply: string;
}

export interface Handover {
  reason: string;
  context: number;
  prompt: string;
}

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
  for (const entry of entries) {
    if (entry.isSidechain || entry.isMeta) continue;
    const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
    if (!Number.isNaN(at)) last = Math.max(last, at);
    const content = entry.message?.content;
    const textOf = (value: typeof content) =>
      typeof value === 'string'
        ? value
        : (value ?? [])
            .filter((block) => block.type === 'text')
            .map((block) => block.text ?? '')
            .join('\n');
    if (entry.type === 'user') {
      // I risultati dei tool arrivano come messaggi dell'utente senza testo: non sono un turno.
      const text = textOf(content).trim();
      if (text) turns.push({ user: text, reply: '' });
    } else if (entry.type === 'assistant') {
      const usage = entry.message?.usage;
      if (usage) context = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
      // La risposta del turno è l'ultimo testo di Claude prima del messaggio successivo dell'utente.
      const text = textOf(content).trim();
      const turn = turns.at(-1);
      if (text && turn) turn.reply = text;
    }
  }

  const pause = last ? now - last : 0;
  const reason = context > MAX_CONTEXT ? `contesto di ${Math.round(context / 1000)}K` : pause > MAX_PAUSE_MS ? `pausa di ${Math.round(pause / 60_000)} minuti` : null;
  if (!reason || turns.length === 0) return null;
  return { reason, context, prompt: dialogue(turns) };
}

function dialogue(turns: Turn[]): string {
  const blocks = turns.map(({ user, reply }) => [`Utente:\n${user}`, reply && `Tu:\n${reply}`].filter(Boolean).join('\n\n'));
  // Si tengono i turni più recenti che stanno nel limite; il primo, se c'è, porta già il dialogo delle sessioni prima.
  const kept: string[] = [];
  let size = 0;
  for (const block of blocks.reverse()) {
    if (size + block.length > MAX_DIALOGUE_CHARS && kept.length > 0) break;
    kept.unshift(block);
    size += block.length;
  }
  const omitted = blocks.length - kept.length;
  return [
    'Questa conversazione con l’utente continua da una sessione precedente. Ecco il dialogo fin qui: i messaggi dell’utente e le tue risposte, senza i passaggi intermedi. ' +
      'Il lavoro fatto è nella cartella del brand (lavoro/, contenuti/) e i contenuti salvati li leggi con i tool di moonbrand: riguarda quello che serve prima di cambiarlo.',
    omitted > 0 && `(${omitted} turni più vecchi omessi.)`,
    kept.join('\n\n---\n\n'),
    '--- Fine del dialogo precedente. Il nuovo messaggio dell’utente:',
  ]
    .filter(Boolean)
    .join('\n\n');
}
