import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { reportUsage, type Usage } from '../../lib/usage';

// Quello che serve a tutti i tool dei servizi (media, guarda, audio): le chiavi, i percorsi nella cartella del brand, le
// risposte e il costo di ogni generazione, che arriva al worker sullo stdout e va in ai_usage.

export interface ServiceKeys {
  gemini?: string;
  atlas?: string;
  elevenlabs?: string;
}

// Claude Code esegue insieme solo i tool MCP che si dichiarano di sola lettura: gli altri, anche se Claude li chiede
// nello stesso momento, vanno in fila. I tool che non si pestano i piedi (ognuno scrive il suo file) si dichiarano così
// per girare insieme. Sui permessi non cambia niente, la chat gira con bypassPermissions.
export const PARALLEL = { alwaysLoad: true, annotations: { readOnlyHint: true } } as const;

export const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
};

// I percorsi dove salvare: relativi alla cartella del brand, senza spazi né caratteri strani.
export const SAVE_PATH = /^[A-Za-z0-9._\/-]+$/;

export function brandFolder(brandDir: string) {
  const root = path.resolve(brandDir);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const save = async (relative: string, data: Buffer) => {
    const full = inside(relative);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
  };
  return { inside, save };
}

export const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

export const failure = (error: unknown) => ({
  content: [{ type: 'text' as const, text: `Non riuscita: ${error instanceof Error ? error.message : String(error)}` }],
  isError: true,
});

export const credits = (usd: number | undefined) => (usd === undefined ? 'costo non noto' : `${Math.max(1, Math.round(usd * 100))} crediti`);

// Una generazione con il suo costo, anche quando non riesce: il costo lo calcola chi conosce la risposta.
export async function measured<T>(base: Pick<Usage, 'task' | 'model'>, run: () => Promise<T>, cost: (result: T) => Omit<Usage, 'task' | 'model' | 'outcome' | 'durationMs'>): Promise<T> {
  const started = Date.now();
  try {
    const result = await run();
    reportUsage({ ...base, outcome: 'ok', durationMs: Date.now() - started, ...cost(result) });
    return result;
  } catch (error) {
    reportUsage({ ...base, outcome: 'error', error: (error instanceof Error ? error.message : String(error)).slice(0, 300), durationMs: Date.now() - started });
    throw error;
  }
}

export async function download(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!response.ok) throw new Error(`download del risultato: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
