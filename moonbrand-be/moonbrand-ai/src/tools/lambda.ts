import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { deploySite, downloadMedia, getFunctions, getOrCreateBucket, getRenderProgress, renderMediaOnLambda, type AwsRegion } from '@remotion/lambda';
import { z } from 'zod';

import { reportUsage } from '../lib/usage';
import { PARALLEL } from './parallel';

// Gli export finali dei video su Remotion Lambda: il progetto video del brand si pubblica su S3 (un sito per brand, che si
// aggiorna caricando solo i file cambiati) e ogni composizione si divide in decine di pezzi renderizzati insieme su AWS.
// Reel e TikTok di 20 secondi escono in 15-25 s invece di quasi un minuto, e la CPU di questa macchina resta libera.
// Le chiavi AWS stanno in .env.lambda: si leggono solo qui e finiscono nell'ambiente di questo processo al primo export,
// quando Claude Code è già partito con il suo ambiente, quindi Claude non le vede.

const LAMBDA_ENV = fileURLToPath(new URL('../../.env.lambda', import.meta.url));
const POLL_MS = 2000;
const MAX_RENDER_MS = 5 * 60_000;

// Le chiavi, se ci sono: senza, l'export si fa in locale come prima.
export function lambdaKeys(): Record<string, string> | null {
  if (!existsSync(LAMBDA_ENV)) return null;
  const keys = parseEnv(readFileSync(LAMBDA_ENV, 'utf8')) as Record<string, string>;
  return keys.REMOTION_AWS_ACCESS_KEY_ID && keys.REMOTION_AWS_SECRET_ACCESS_KEY && keys.REMOTION_AWS_REGION ? keys : null;
}

export interface LambdaExport {
  composizione: string;
  file: string;
}

// Pubblica il progetto video del brand ed esporta le composizioni insieme: una riga per video, e se qualcuno non è riuscito.
export function lambdaExporter(folder: string, brandId: string, keys: Record<string, string>) {
  const root = path.resolve(folder);
  const project = path.join(root, 'video');
  const region = keys.REMOTION_AWS_REGION as AwsRegion;
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
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
      if (!functions[0]) throw new Error('nel cloud non c’è la funzione di export della versione giusta');
      return { functionName: functions[0].functionName, bucketName };
    })().catch((error: unknown) => {
      setup = null;
      throw error;
    }));

  // Anche il controllo dell'avanzamento è una Lambda: se AWS è al limite si riprova al giro dopo.
  const busy = (error: unknown) => /ConcurrentInvocationLimitExceeded|Rate Exceeded|TooManyRequests/i.test(String(error));

  const render = async (item: LambdaExport, serveUrl: string, functionName: string, bucketName: string): Promise<string> => {
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
        reportUsage({
          task: 'video-export',
          model: 'remotion-lambda',
          outcome: 'ok',
          durationMs: Date.now() - started,
          units: 1,
          unit: 'video',
          costUsd: progress.costs.accruedSoFar,
        });
        return `${item.file}: ${item.composizione} esportato in ${((Date.now() - started) / 1000).toFixed(0)} s (${progress.costs.displayCost}).`;
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  };

  return async (video: LambdaExport[]): Promise<{ text: string; failed: boolean }> => {
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
      result.status === 'fulfilled'
        ? result.value
        : `${video[index].file}: non riuscito, ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    );
    return { text: lines.join('\n'), failed: results.some((result) => result.status === 'rejected') };
  };
}

export function lambdaTools(folder: string, brandId: string, keys: Record<string, string>) {
  const exportOnLambda = lambdaExporter(folder, brandId, keys);
  const exportVideos = tool(
    'esporta_video',
    'Esporta i video finali in MP4 nel cloud: tutte le composizioni insieme, in pochi secondi, senza occupare la CPU. ' +
      'Passa in una sola chiamata tutti gli export finali (per esempio il Reel e il TikTok). Prima il progetto deve essere a posto ' +
      '(controlla_video) e la musica pronta (attendi_musica). I fotogrammi di controllo si fanno con controlla_video, le copertine con npx remotion still.',
    {
      video: z
        .array(
          z.object({
            composizione: z.string().min(1).describe('L’id della composizione registrata in video/src/Root.tsx'),
            file: z
              .string()
              .regex(/^[A-Za-z0-9._\/-]+\.mp4$/)
              .describe('Dove salvare l’MP4, relativo alla cartella del brand, es. chat/<id>/reel-9x16.mp4'),
          }),
        )
        .min(1)
        .max(8),
    },
    async ({ video }) => {
      try {
        const { text, failed } = await exportOnLambda(video);
        return {
          content: [{ type: 'text' as const, text: text + (failed ? '\nPer quelli non riusciti correggi e riprova, o esportali in locale con npx remotion render.' : '') }],
          ...(failed && { isError: true }),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Export nel cloud non riuscito: ${message}. Esporta in locale con npx remotion render.` }],
          isError: true,
        };
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'lambda', tools: [exportVideos] });
}
