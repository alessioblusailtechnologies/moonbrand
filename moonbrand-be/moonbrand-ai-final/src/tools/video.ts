import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { browserEnv } from '../service/video';
import { measure } from '../service/usage';
import { brandFolder, PARALLEL } from './common';
import { lambdaExporter, lambdaKeys } from './lambda';
import type { Look } from './vista';

// I video li fa Remotion nel progetto video/ del brand. Qui i due tool che lo lanciano al posto di Claude: controlla_video
// (tipi, bundle e fotogrammi di controllo in una chiamata sola) ed esporta_video (MP4 finale, nel cloud se ci sono le
// chiavi di Lambda, e copertina). Remotion render su fotogrammi sparsi si rompe nel mix dell'audio: il progetto si
// impacchetta una volta e ogni fotogramma si esporta con remotion still.

const run = promisify(execFile);
const CLI = 'node_modules/@remotion/cli/remotion-cli.js';
// I fotogrammi di controllo e il bundle stanno in video/tmp, che non va sullo storage.
const CHECK_DIR = 'video/tmp/controllo';
const MAX_FRAMES = 20;
// I fotogrammi esportati insieme: ognuno apre una pagina di Chrome.
const STILL_CONCURRENCY = 4;
const MAX_ERROR_CHARS = 3000;
const TIMEOUT_MS = 15 * 60_000;

// Dall'output di tsc o di Remotion le righe che servono a capire l'errore: niente colori, avanzamento o stack.
function essential(output: string): string {
  return output
    .replace(/\u001b\[[0-9;]*m/g, '')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/^\s+at |Copying public dir|Bundling|Rendered \d|Downloading|Getting composition|^(Composition|Format|Output|Codec)\s/.test(line))
    .join('\n')
    .slice(-MAX_ERROR_CHARS);
}

function failureText(error: unknown): string {
  const { stdout = '', stderr = '', message = '' } = error as { stdout?: string; stderr?: string; message?: string };
  return essential(stdout + stderr) || message;
}

// Esegue i lavori al massimo `limit` alla volta, nell'ordine.
async function pooled<T>(jobs: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  const lane = async () => {
    while (next < jobs.length) {
      const index = next++;
      results[index] = await jobs[index]().then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: unknown) => ({ status: 'rejected' as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, lane));
  return results;
}

export function videoTools(folder: string, lookAt: Look | null) {
  const { root, inside } = brandFolder(folder);
  const project = path.join(root, 'video');
  const node = async (args: string[]) => run(process.execPath, args, { cwd: project, timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, ...(await browserEnv()) } });
  const ready = () => existsSync(path.join(project, CLI));
  const fail = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true as const });

  // Il bundle del progetto, una volta per chiamata.
  async function bundle(): Promise<string> {
    const out = path.join(root, 'video/tmp/bundle');
    await rm(out, { recursive: true, force: true });
    await node([CLI, 'bundle', `--out-dir=${out}`]);
    return out;
  }

  const check = tool(
    'controlla_video',
    'Controlla il video mentre lo fai, in una sola chiamata: controlla i tipi del progetto, esporta in PNG a metà risoluzione i fotogrammi che ' +
      'chiedi delle composizioni e ti dice dove sono, da aprire con Read. Con domanda li fa guardare anche al motore di visione e riporta la ' +
      'risposta. Se i tipi o l’export non vanno ti dice solo l’errore. Usalo al posto di tsc e di npx remotion still per i fotogrammi di controllo.',
    {
      composizioni: z
        .array(
          z.object({
            composizione: z.string().min(1).describe('L’id della composizione registrata in video/src/Root.tsx'),
            fotogrammi: z.array(z.number().int().min(0)).min(1).describe('I numeri dei fotogrammi da esportare: il primo, l’ultimo e uno per scena con il testo tutto visibile'),
          }),
        )
        .min(1)
        .max(4),
      domanda: z.string().min(10).optional().describe('Cosa far controllare al motore di visione sui fotogrammi, se vuoi un giudizio senza aprirli tu'),
    },
    async ({ composizioni, domanda }) => {
      if (!ready()) return fail('Il progetto video del brand non è pronto: manca video/node_modules.');
      const frames = composizioni.flatMap(({ composizione, fotogrammi }) => [...new Set(fotogrammi)].sort((a, b) => a - b).map((frame) => ({ composizione, frame })));
      if (frames.length > MAX_FRAMES) return fail(`Al massimo ${MAX_FRAMES} fotogrammi per controllo, ne hai chiesti ${frames.length}.`);
      try {
        await node(['node_modules/typescript/bin/tsc', '--noEmit', '-p', '.']);
      } catch (error) {
        return fail(`Errori di tipi, niente export:\n${failureText(error)}`);
      }
      let bundled: string;
      try {
        bundled = await bundle();
      } catch (error) {
        return fail(`Il progetto non si impacchetta, niente export:\n${failureText(error)}`);
      }
      await rm(path.join(root, CHECK_DIR), { recursive: true, force: true });
      await mkdir(path.join(root, CHECK_DIR), { recursive: true });
      const file = ({ composizione, frame }: (typeof frames)[number]) => `${CHECK_DIR}/${composizione}-${String(frame).padStart(4, '0')}.png`;
      const results = await pooled(
        frames.map((item) => () => node([CLI, 'still', bundled, item.composizione, path.join(root, file(item)), `--frame=${item.frame}`, '--scale=0.5'])),
        STILL_CONCURRENCY,
      );
      const errors = results.flatMap((result, index) => (result.status === 'rejected' ? [`${frames[index].composizione}, fotogramma ${frames[index].frame}:\n${failureText(result.reason)}`] : []));
      if (errors.length > 0) return fail(`Export non riuscito:\n${errors.join('\n\n')}`);
      const files = frames.map(file);
      let text = `Tipi a posto. Fotogrammi (${files.length}), da aprire con Read:\n${files.map((item) => `- ${item}`).join('\n')}`;
      if (domanda && lookAt) {
        const looked = await lookAt(files, `I file si chiamano ${CHECK_DIR}/<composizione>-<fotogramma>.png.\n\n${domanda}`);
        text += `\n\nMotore di visione:\n${looked.text}`;
      }
      return { content: [{ type: 'text' as const, text }] };
    },
    PARALLEL,
  );

  // L'MP4 finale: nel cloud se ci sono le chiavi, altrimenti qui. La copertina sempre qui, con remotion still.
  const keys = lambdaKeys();
  const onLambda = keys ? lambdaExporter(folder, keys) : null;

  const exportVideo = tool(
    'esporta_video',
    `Esporta i video finali in MP4${onLambda ? ' nel cloud, tutti insieme in pochi secondi,' : ''} e salva la copertina di ciascuno dal fotogramma che indichi. ` +
      'Passa in una sola chiamata tutti gli export (per esempio il Reel e il TikTok); dopo una correzione si riesporta sugli stessi file. ' +
      'Prima il progetto deve essere a posto (controlla_video) e la musica pronta (attendi_musica).',
    {
      video: z
        .array(
          z.object({
            composizione: z.string().min(1).describe('L’id della composizione registrata in video/src/Root.tsx'),
            file: z
              .string()
              .regex(/^[A-Za-z0-9._\/-]+\.mp4$/)
              .describe('Dove salvare l’MP4, relativo alla cartella del brand, es. contenuti/<id>/video-9x16.mp4'),
            copertina: z
              .string()
              .regex(/^[A-Za-z0-9._\/-]+\.(png|jpg)$/)
              .describe('Dove salvare la copertina, relativo alla cartella del brand, es. contenuti/<id>/cover-9x16.jpg'),
            fotogramma: z.number().int().min(0).describe('Il fotogramma da usare come copertina: soggetto e testo ben visibili'),
          }),
        )
        .min(1)
        .max(8),
    },
    async ({ video }) => {
      if (!ready()) return fail('Il progetto video del brand non è pronto: manca video/node_modules.');
      for (const item of video) {
        await mkdir(path.dirname(inside(item.file)), { recursive: true });
        await mkdir(path.dirname(inside(item.copertina)), { recursive: true });
      }
      const lines: string[] = [];
      let failed = false;
      if (onLambda) {
        try {
          const result = await onLambda(video);
          lines.push(...result.lines);
          failed = result.failed;
        } catch (error) {
          return fail(`Export nel cloud non riuscito: ${error instanceof Error ? error.message : String(error)}. Riprova, o esporta con npx remotion render.`);
        }
      } else {
        const results = await Promise.allSettled(
          video.map((item) =>
            measure({ task: 'video-export', model: 'remotion-local', extra: () => ({ units: 1, unit: 'video', costUsd: 0 }) }, () =>
              node([CLI, 'render', 'src/index.ts', item.composizione, inside(item.file)]),
            ),
          ),
        );
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') lines.push(`${video[index].file}: ${video[index].composizione} esportato.`);
          else {
            failed = true;
            lines.push(`${video[index].file}: non riuscito, ${failureText(result.reason)}`);
          }
        });
      }
      const covers = await pooled(
        video.map((item) => () => node([CLI, 'still', 'src/index.ts', item.composizione, inside(item.copertina), `--frame=${item.fotogramma}`])),
        STILL_CONCURRENCY,
      );
      covers.forEach((result, index) => {
        if (result.status === 'fulfilled') lines.push(`${video[index].copertina}: copertina dal fotogramma ${video[index].fotogramma}.`);
        else {
          failed = true;
          lines.push(`${video[index].copertina}: copertina non riuscita, ${failureText(result.reason)}`);
        }
      });
      lines.push('Guarda gli MP4 finali con guarda e le copertine con Read prima di consegnare.');
      return { content: [{ type: 'text' as const, text: lines.join('\n') }], ...(failed && { isError: true as const }) };
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'video', tools: [check, exportVideo] });
}
