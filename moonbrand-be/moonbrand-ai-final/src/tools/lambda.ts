import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

import { deploySite, downloadMedia, getFunctions, getOrCreateBucket, getRenderProgress, renderMediaOnLambda, type AwsRegion } from '@remotion/lambda';

import { LAMBDA_ENV_FILE } from '../config/env';
import { reportUsage } from '../service/usage';
import { brandFolder } from './common';

// Gli export finali dei video su Remotion Lambda: il progetto video del brand si pubblica su S3 (un sito per brand, che si
// aggiorna caricando solo i file cambiati) e ogni composizione si divide in decine di pezzi renderizzati insieme su AWS:
// un Reel di 20 secondi esce in 15-25 s invece di quasi un minuto. Le chiavi stanno in .env.lambda e si leggono solo qui,
// dopo che Claude Code è già partito con il suo ambiente: Claude non le vede.

const POLL_MS = 2000;
const MAX_RENDER_MS = 5 * 60_000;

// Le chiavi, se ci sono: senza, l'export si fa in locale.
export function lambdaKeys(): Record<string, string> | null {
  if (!existsSync(LAMBDA_ENV_FILE)) return null;
  const keys = parseEnv(readFileSync(LAMBDA_ENV_FILE, 'utf8')) as Record<string, string>;
  return keys.REMOTION_AWS_ACCESS_KEY_ID && keys.REMOTION_AWS_SECRET_ACCESS_KEY && keys.REMOTION_AWS_REGION ? keys : null;
}

export interface VideoExport {
  composizione: string;
  file: string;
}

// Pubblica il progetto video del brand ed esporta le composizioni insieme: una riga per video.
export function lambdaExporter(folder: string, keys: Record<string, string>) {
  const { root, inside } = brandFolder(folder);
  const brandId = path.basename(root);
  const project = path.join(root, 'video');
  const region = keys.REMOTION_AWS_REGION as AwsRegion;
  // Funzione e bucket si cercano una volta per job.
  let setup: Promise<{ functionName: string; bucketName: string }> | null = null;
  const prepare = () =>
    (setup ??= (async () => {
      Object.assign(process.env, { REMOTION_AWS_ACCESS_KEY_ID: keys.REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY: keys.REMOTION_AWS_SECRET_ACCESS_KEY });
      const [functions, { bucketName }] = await Promise.all([getFunctions({ region, compatibleOnly: true }), getOrCreateBucket({ region })]);
      if (!functions[0]) throw new Error('nel cloud non c’è la funzione di export della versione giusta');
      return { functionName: functions[0].functionName, bucketName };
    })().catch((error: unknown) => {
      setup = null;
      throw error;
    }));

  // Anche il controllo dell'avanzamento è una Lambda: se AWS è al limite si riprova al giro dopo.
  const busy = (error: unknown) => /ConcurrentInvocationLimitExceeded|Rate Exceeded|TooManyRequests/i.test(String(error));

  const render = async (item: VideoExport, serveUrl: string, functionName: string, bucketName: string): Promise<string> => {
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
      if (progress?.fatalErrorEncountered) throw new Error(progress.errors.map((error) => error.message).join('; ').slice(0, 800) || `render di ${item.composizione} non riuscito`);
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

  return async (video: VideoExport[]): Promise<{ lines: string[]; failed: boolean }> => {
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
      result.status === 'fulfilled' ? result.value : `${video[index].file}: non riuscito, ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    );
    return { lines, failed: results.some((result) => result.status === 'rejected') };
  };
}
