import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { deploySite, downloadMedia, getFunctions, getOrCreateBucket, getRenderProgress, renderMediaOnLambda, type AwsRegion } from '@remotion/lambda';
import { z } from 'zod';

import { reportUsage } from '../../lib/usage';

// Gli export dei video su Remotion Lambda, come in moonbrand-ai: il progetto Remotion che Claude ha fatto nella cartella
// del brand si pubblica su S3 (un sito per brand, che si aggiorna caricando solo i file cambiati) e ogni composizione si
// divide in pezzi renderizzati insieme su AWS: 15-25 s invece di quasi un minuto, senza occupare la CPU.
// La funzione su AWS è di una versione precisa di Remotion (quella di @remotion/lambda qui): il progetto deve avere la
// stessa, altrimenti il tool lo dice prima di partire. Le chiavi AWS stanno in .env.lambda, lette solo qui e messe
// nell'ambiente di questo processo al primo export, quando Claude Code è già partito: Claude non le vede.

const LAMBDA_ENV = fileURLToPath(new URL('../../../.env.lambda', import.meta.url));
const VERSION = (createRequire(import.meta.url)('@remotion/lambda/package.json') as { version: string }).version;
const POLL_MS = 2000;
const MAX_RENDER_MS = 5 * 60_000;

// Le chiavi, se ci sono: senza, il tool non c'è e Claude esporta in locale.
export function lambdaKeys(): Record<string, string> | null {
  if (!existsSync(LAMBDA_ENV)) return null;
  const keys = parseEnv(readFileSync(LAMBDA_ENV, 'utf8')) as Record<string, string>;
  return keys.REMOTION_AWS_ACCESS_KEY_ID && keys.REMOTION_AWS_SECRET_ACCESS_KEY && keys.REMOTION_AWS_REGION ? keys : null;
}

interface Export {
  composizione: string;
  file: string;
}

export function lambdaServer(brandDir: string, keys: Record<string, string>) {
  const root = path.resolve(brandDir);
  const brandId = path.basename(root);
  const region = keys.REMOTION_AWS_REGION as AwsRegion;
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };

  // Funzione e bucket si cercano una volta per job.
  let setup: Promise<{ functionName: string; bucketName: string }> | null = null;
  const prepare = () =>
    (setup ??= (async () => {
      Object.assign(process.env, {
        REMOTION_AWS_ACCESS_KEY_ID: keys.REMOTION_AWS_ACCESS_KEY_ID,
        REMOTION_AWS_SECRET_ACCESS_KEY: keys.REMOTION_AWS_SECRET_ACCESS_KEY,
      });
      const [functions, { bucketName }] = await Promise.all([getFunctions({ region, compatibleOnly: true }), getOrCreateBucket({ region })]);
      if (!functions[0]) throw new Error(`nel cloud non c’è la funzione di export per Remotion ${VERSION}`);
      return { functionName: functions[0].functionName, bucketName };
    })().catch((error: unknown) => {
      setup = null;
      throw error;
    }));

  // Anche il controllo dell'avanzamento è una Lambda: se AWS è al limite si riprova al giro dopo.
  const busy = (error: unknown) => /ConcurrentInvocationLimitExceeded|Rate Exceeded|TooManyRequests/i.test(String(error));

  const render = async (item: Export, serveUrl: string, functionName: string, bucketName: string): Promise<string> => {
    const started = Date.now();
    const { renderId } = await renderMediaOnLambda({
      region,
      functionName,
      serveUrl,
      composition: item.composizione,
      codec: 'h264',
      imageFormat: 'jpeg',
      privacy: 'private',
      downloadBehavior: { type: 'download', fileName: null },
    });
    for (;;) {
      if (Date.now() - started > MAX_RENDER_MS) throw new Error(`il render di ${item.composizione} non è finito in 5 minuti`);
      const progress = await getRenderProgress({ renderId, bucketName, functionName, region }).catch((error: unknown) => {
        if (busy(error)) return null;
        throw error;
      });
      if (progress?.fatalErrorEncountered) {
        throw new Error(progress.errors.map((error) => error.message).join('; ').slice(0, 800) || `render di ${item.composizione} non riuscito`);
      }
      if (progress?.done) {
        const target = inside(item.file);
        await mkdir(path.dirname(target), { recursive: true });
        await downloadMedia({ region, bucketName, renderId, outPath: target });
        // Il costo del render lo stima Remotion dai secondi di Lambda usati.
        reportUsage({ task: 'video-export', model: 'remotion-lambda', outcome: 'ok', durationMs: Date.now() - started, units: 1, unit: 'video', costUsd: progress.costs.accruedSoFar });
        return `${item.file}: ${item.composizione} esportato in ${((Date.now() - started) / 1000).toFixed(0)} s.`;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };

  // La versione di Remotion del progetto, da package.json: deve essere quella della funzione.
  const projectVersion = async (project: string): Promise<string | undefined> => {
    const pkg = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    return (pkg.dependencies ?? {}).remotion ?? (pkg.devDependencies ?? {}).remotion;
  };

  const exportVideos = tool(
    'esporta_video',
    `Esporta i video finali in MP4 nel cloud, in pochi secondi: tutte le composizioni insieme, in una sola chiamata. Il progetto Remotion deve usare remotion e @remotion/* alla versione ${VERSION}.`,
    {
      progetto: z.string().describe('La cartella del progetto Remotion, relativa alla cartella del brand, es. lavoro/video; l’entry point è src/index.ts'),
      video: z
        .array(
          z.object({
            composizione: z.string().min(1).describe('L’id della composizione'),
            file: z.string().regex(/^[A-Za-z0-9._\/-]+\.mp4$/).describe('Dove salvare l’MP4, relativo alla cartella del brand, es. contenuti/reel.mp4'),
          }),
        )
        .min(1)
        .max(8),
    },
    async ({ progetto, video }) => {
      try {
        const project = inside(progetto);
        const version = await projectVersion(project);
        if (version?.replace(/^[\^~]/, '') !== VERSION) {
          return {
            content: [{ type: 'text' as const, text: `Il progetto usa Remotion ${version ?? 'sconosciuto'}: per l’export nel cloud serve ${VERSION} (remotion e tutti i @remotion/*). Installala o esporta in locale.` }],
            isError: true,
          };
        }
        const { functionName, bucketName } = await prepare();
        const { serveUrl } = await deploySite({
          entryPoint: path.join(project, 'src/index.ts'),
          siteName: `brand-${brandId}`,
          bucketName,
          region,
          options: { rootDir: project, publicDir: path.join(project, 'public') },
        });
        const results = await Promise.allSettled(video.map((item) => render(item, serveUrl, functionName, bucketName)));
        const lines = results.map((result, index) =>
          result.status === 'fulfilled' ? result.value : `${video[index]!.file}: non riuscito, ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
        );
        const failed = results.some((result) => result.status === 'rejected');
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') + (failed ? '\nPer quelli non riusciti correggi e riprova, o esportali in locale.' : '') }],
          ...(failed && { isError: true }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text' as const, text: `Export nel cloud non riuscito: ${message}. Esporta in locale.` }], isError: true };
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'lambda', tools: [exportVideos] });
}
