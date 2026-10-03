import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { ensureBrowser } from '@remotion/renderer';
import { z } from 'zod';

import { PARALLEL } from './parallel';

// Il controllo dei fotogrammi in una sola chiamata: tipi, export dei fotogrammi di tutte le composizioni e sguardo di
// Gemini. Prima Claude lo faceva con un comando per volta (pnpm check, npx remotion render, ls, guarda), e ogni passaggio
// rileggeva tutta la conversazione: nel video dei parrucchieri erano una dozzina di chiamate.
// Il progetto si impacchetta una volta e ogni fotogramma si esporta con remotion still: remotion render su fotogrammi
// sparsi si rompe nel mix dell'audio (EINVAL in inline-audio-mixing) appena un fotogramma ha un suono.

const run = promisify(execFile);
// Dentro video/out, fuori da public: public si copia a ogni bundle.
const OUT = 'video/out/controllo';
const MAX_FRAMES = 20;
// I fotogrammi esportati insieme: ognuno apre una pagina di Chrome.
const CONCURRENCY = 4;
const MAX_ERROR_CHARS = 3000;
const TIMEOUT_MS = 5 * 60_000;

type Look = (file: string[], domanda: string) => Promise<{ text: string; isError?: boolean }>;

// Dall'output di tsc o di Remotion le righe che servono a capire l'errore: niente colori, avanzamento o stack.
function essential(output: string): string {
  const lines = output
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\s+at |Copying public dir|Bundling|Rendered \d|Downloading|Getting composition|^(Composition|Format|Output|Codec)\s/.test(line));
  return lines.join('\n').slice(-MAX_ERROR_CHARS);
}

// Il messaggio di un comando fallito: quello che ha scritto, se c'è.
function failureText(error: unknown): string {
  const { stdout = '', stderr = '', message = '' } = error as { stdout?: string; stderr?: string; message?: string };
  return essential(stdout + stderr) || message;
}

// Esegue i lavori al massimo `limit` alla volta, nell'ordine.
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await jobs[index]().then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
  return results;
}

export function checkVideoTool(folder: string, lookAt: Look) {
  const root = path.resolve(folder);
  const project = path.join(root, 'video');
  const cli = 'node_modules/@remotion/cli/remotion-cli.js';
  // Il Chrome headless condiviso da tutti i brand, come per i comandi di Claude (prepareVideoProject).
  let browser: Promise<Record<string, string>> | null = null;
  const browserEnv = () =>
    (browser ??= ensureBrowser().then(
      (found): Record<string, string> =>
        found.type === 'local-puppeteer-browser' || found.type === 'user-defined-path' ? { REMOTION_BROWSER: found.path } : {},
    ));
  const node = async (args: string[]) =>
    run(process.execPath, args, { cwd: project, timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, ...(await browserEnv()) } });

  return tool(
    'controlla_video',
    'Controlla il video mentre lo fai, in una sola chiamata: controlla i tipi del progetto (come pnpm check), esporta in PNG a metà ' +
      'risoluzione i fotogrammi che chiedi di tutte le composizioni e li fa guardare a Gemini con la tua lista di controlli. ' +
      'Se i tipi o l’export non vanno, ti dice solo l’errore e non guarda niente. Usalo al posto di pnpm check, npx remotion render/still ' +
      'e guarda per i fotogrammi di controllo; per i video finali usa esporta_video e poi guarda.',
    {
      composizioni: z
        .array(
          z.object({
            composizione: z.string().min(1).describe('L’id della composizione registrata in video/src/Root.tsx'),
            fotogrammi: z.array(z.number().int().min(0)).min(1).describe('I numeri dei fotogrammi da esportare'),
          }),
        )
        .min(1)
        .max(4),
      domanda: z.string().min(10).describe('Cosa controllare nei fotogrammi: la lista precisa, come per guarda'),
    },
    async ({ composizioni, domanda }) => {
      const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });
      if (!existsSync(path.join(project, cli))) return failure('Il progetto video del brand non è pronto: manca video/node_modules.');
      const frames = composizioni.flatMap(({ composizione, fotogrammi }) =>
        [...new Set(fotogrammi)].sort((a, b) => a - b).map((frame) => ({ composizione, frame })),
      );
      if (frames.length > MAX_FRAMES) {
        return failure(`Al massimo ${MAX_FRAMES} fotogrammi per controllo, ne hai chiesti ${frames.length}: scegli quelli in cui il testo è tutto visibile.`);
      }

      try {
        await node(['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.']);
      } catch (error) {
        return failure(`Errori di tipi, niente export:\n${failureText(error)}`);
      }

      const bundle = path.join(root, OUT, 'bundle');
      await rm(path.join(root, OUT), { recursive: true, force: true });
      try {
        await node([cli, 'bundle', `--out-dir=${bundle}`]);
      } catch (error) {
        return failure(`Il progetto non si impacchetta, niente export:\n${failureText(error)}`);
      }

      const file = ({ composizione, frame }: (typeof frames)[number]) => `${OUT}/${composizione}-${String(frame).padStart(4, '0')}.png`;
      const results = await pooled(
        frames.map((item) => () => node([cli, 'still', bundle, item.composizione, path.join(root, file(item)), `--frame=${item.frame}`, '--scale=0.5'])),
        CONCURRENCY,
      );
      const errors = results.flatMap((result, index) =>
        result.status === 'rejected' ? [`${frames[index].composizione}, fotogramma ${frames[index].frame}:\n${failureText(result.reason)}`] : [],
      );
      if (errors.length > 0) return failure(`Export non riuscito, niente controllo:\n${errors.join('\n\n')}`);

      const files = frames.map(file);
      const legend = `I file si chiamano ${OUT}/<composizione>-<fotogramma>.png.`;
      const { text, isError } = await lookAt(files, `${legend}\n\n${domanda}`);
      return { content: [{ type: 'text' as const, text: `Fotogrammi in ${OUT}/ (${files.length}).\n\n${text}` }], ...(isError && { isError }) };
    },
    PARALLEL,
  );
}
