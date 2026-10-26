import { execFile } from 'node:child_process';
import { access, copyFile, cp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { z } from 'zod';

import { geminiClient } from './gemini';
import { brandFolder, failure, SAVE_PATH, text } from './servizi';

// La meccanica di Remotion, che senza tool Claude fa con Bash in un terzo delle chiamate di una sessione video:
// prepara_video mette in piedi il progetto del brand (kit di partenza, dipendenze, logo) e controlla_video controlla
// tipi e fotogrammi in una chiamata sola. Il video lo scrive Claude, come prima; l'MP4 finale lo fa esporta_video.

const KIT = fileURLToPath(new URL('../../../video-kit', import.meta.url));
// La versione della funzione su Lambda: con un'altra, esporta_video non parte.
const VERSION = (createRequire(import.meta.url)('@remotion/renderer/package.json') as { version: string }).version;
const DEFAULT_PROJECT = 'lavoro/video';
const CHECKS_DIR = 'lavoro/controlli';
const DEFAULT_LOOKER = 'gemini-3.8-flash';

const run = promisify(execFile);
const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

const projectPath = z.string().regex(SAVE_PATH).optional().describe(`La cartella del progetto Remotion, relativa alla cartella del brand; di default ${DEFAULT_PROJECT}`);

export function videoServer(brandDir: string, geminiKey?: string) {
  const { inside } = brandFolder(brandDir);
  const looker = geminiKey ? geminiClient(geminiKey, inside) : undefined;

  // Le composizioni registrate in Root.tsx, lette dal sorgente: per sapere quali ci sono non serve un bundle.
  const compositions = async (project: string) => {
    const root = await readFile(path.join(project, 'src', 'Root.tsx'), 'utf8').catch(() => '');
    return [...root.matchAll(/<Composition[^>]*\bid=["']([^"']+)["']/g)].map((match) => match[1]!);
  };

  const remotionVersion = async (project: string) => {
    const pkg = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
    return pkg.dependencies?.remotion?.replace(/^[\^~]/, '');
  };

  const prepare = tool(
    'prepara_video',
    'Prepara il progetto Remotion del brand prima di scrivere un video: se non c’è lo crea dal kit di partenza, installa le dipendenze se mancano ' +
      `(Remotion ${VERSION}, la versione dell’export nel cloud) e mette il logo del brand in public/brand/. Dice cosa c’è già: composizioni e README con i comandi.`,
    { progetto: projectPath },
    async ({ progetto = DEFAULT_PROJECT }) => {
      try {
        const project = inside(progetto);
        const notes: string[] = [];
        if (!(await exists(path.join(project, 'package.json')))) {
          await cp(KIT, project, { recursive: true });
          notes.push(`Progetto creato dal kit di partenza in ${progetto}.`);
        }
        if (!(await exists(path.join(project, 'node_modules')))) {
          const started = Date.now();
          await run('pnpm', ['install', '--prefer-offline'], { cwd: project, shell: process.platform === 'win32', timeout: 5 * 60_000 });
          notes.push(`Dipendenze installate in ${Math.round((Date.now() - started) / 1000)} s.`);
        }
        // Il logo lo scrive il worker nella radice della cartella del brand.
        const logo = (await readdir(path.resolve(brandDir))).find((name) => /^logo\.(png|jpe?g|svg|webp)$/i.test(name));
        if (logo && !(await exists(path.join(project, 'public', 'brand', logo)))) {
          await mkdir(path.join(project, 'public', 'brand'), { recursive: true });
          await copyFile(inside(logo), path.join(project, 'public', 'brand', logo));
          notes.push(`Logo in public/brand/${logo}.`);
        }
        const version = await remotionVersion(project);
        if (version !== VERSION) notes.push(`Attenzione: il progetto usa Remotion ${version ?? 'sconosciuto'}, per l’export nel cloud serve ${VERSION} (remotion e tutti i @remotion/*).`);
        const ids = await compositions(project);
        return text(
          [
            ...notes,
            `Progetto pronto in ${progetto}, Remotion ${version}. Entry point src/index.ts, composizioni in src/Root.tsx.`,
            ids.length > 0 ? `Composizioni: ${ids.join(', ')}.` : 'Nessuna composizione ancora.',
            'Il README del progetto dice com’è organizzato. Per controllare un video usa controlla_video, per l’MP4 finale esporta_video.',
          ].join('\n'),
        );
      } catch (error) {
        return failure(error);
      }
    },
    { alwaysLoad: true },
  );

  const check = tool(
    'controlla_video',
    'Controlla un video mentre lo fai, in una sola chiamata: i tipi del progetto, poi i fotogrammi ai secondi che chiedi di ogni composizione, ' +
      `esportati a metà risoluzione in ${CHECKS_DIR}/. Con domanda li fa guardare a Gemini, che risponde (es. testi tagliati o fuori bordo, scritte illeggibili, ` +
      'elementi sovrapposti). Per il video intero con movimento e audio c’è guarda_file sull’MP4.',
    {
      progetto: projectPath,
      composizioni: z.array(z.string()).min(1).max(6).describe('Gli id delle composizioni da controllare'),
      secondi: z.array(z.number().min(0)).min(1).max(12).describe('I momenti da esportare, in secondi'),
      domanda: z.string().optional().describe('Cosa guardare nei fotogrammi; senza, il tool li esporta e basta'),
    },
    async ({ progetto = DEFAULT_PROJECT, composizioni, secondi, domanda }) => {
      const out = path.join(tmpdir(), `moonbrand-controllo-${Date.now()}`);
      let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
      try {
        const project = inside(progetto);
        const lines: string[] = [];

        // I tipi, con il TypeScript del progetto.
        const typescript = path.join(project, 'node_modules', 'typescript', 'bin', 'tsc');
        if (await exists(typescript)) {
          const types = await run(process.execPath, [typescript, '--noEmit', '-p', project], { cwd: project, timeout: 3 * 60_000, maxBuffer: 8 * 1024 * 1024 }).then(
            () => '',
            (error: { stdout?: string }) => error.stdout ?? String(error),
          );
          lines.push(types ? `Errori di tipo:\n${types.trim().slice(0, 4000)}` : 'Tipi: nessun errore.');
        } else {
          lines.push('Tipi non controllati: manca TypeScript nel progetto (prepara_video lo installa).');
        }

        // Un bundle solo per tutti i fotogrammi, e un browser solo.
        const serveUrl = await bundle({ entryPoint: path.join(project, 'src', 'index.ts'), rootDir: project, publicDir: path.join(project, 'public'), outDir: out, enableCaching: true });
        browser = await openBrowser('chrome');
        const saved: string[] = [];
        const problems: string[] = [];
        for (const id of composizioni) {
          const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser }).catch((error: unknown) => {
            problems.push(`${id}: ${error instanceof Error ? error.message.slice(0, 400) : String(error)}`);
            return null;
          });
          if (!composition) continue;
          for (const second of secondi) {
            const frame = Math.min(composition.durationInFrames - 1, Math.round(second * composition.fps));
            const relative = `${CHECKS_DIR}/${id}-${second}s.png`;
            await mkdir(path.dirname(inside(relative)), { recursive: true });
            await renderStill({ serveUrl, composition, frame, output: inside(relative), imageFormat: 'png', scale: 0.5, puppeteerInstance: browser, overwrite: true })
              .then(() => saved.push(relative))
              .catch((error: unknown) => problems.push(`${id} a ${second} s: ${error instanceof Error ? error.message.slice(0, 400) : String(error)}`));
          }
        }
        if (problems.length > 0) lines.push(`Non riusciti:\n${problems.join('\n')}`);
        if (saved.length > 0) lines.push(`Fotogrammi: ${saved.join(', ')}.`);

        if (domanda && saved.length > 0) {
          if (!looker) {
            lines.push('Gemini non è configurato: i fotogrammi guardali tu con Read.');
          } else {
            const response = await looker.generate('vision', DEFAULT_LOOKER, saved, `I file, nell’ordine: ${saved.join(', ')}.\n\n${domanda}`);
            const answer = (response.candidates?.[0]?.content?.parts ?? [])
              .filter((part) => part.text && !part.thought)
              .map((part) => part.text)
              .join('\n')
              .trim();
            lines.push(`Gemini:\n${answer || 'nessuna risposta.'}`);
          }
        }
        return text(lines.join('\n\n'));
      } catch (error) {
        return failure(error);
      } finally {
        await browser?.close({ silent: true }).catch(() => undefined);
        await rm(out, { recursive: true, force: true }).catch(() => undefined);
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'video', tools: [prepare, check] });
}
