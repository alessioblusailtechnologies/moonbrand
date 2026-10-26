import { readFile } from 'node:fs/promises';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { reportUsage } from '../../lib/usage';
import { atlasClient, mp4Seconds, type AtlasModel, type Fields } from './atlas';
import { geminiClient } from './gemini';
import { brandFolder, credits, download, failure, PARALLEL, SAVE_PATH, text, type ServiceKeys } from './servizi';

// Immagini e clip: genera_immagine con Gemini (o un modello di Atlas), genera_clip e migliora con Atlas, che rispondono
// subito e si aspettano con attendi, così più clip girano insieme. Claude passa sempre gli stessi campi; il nome che
// hanno nel modello lo trova atlas.ts.

const DEFAULT_IMAGE = 'gemini-3-pro-image';
const DEFAULT_CLIP = { fromImage: 'google/gemini-omni-flash/image-to-video', fromText: 'google/gemini-omni-1.1-flash/text-to-video' };
const UPSCALER = { image: 'atlascloud/image-upscaler', video: 'atlascloud/video-upscaler' };

const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '21:9'] as const;
const IMAGE_EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

const savePath = z.string().regex(SAVE_PATH);
const extraParameters = z
  .record(z.string(), z.unknown())
  .optional()
  .describe('Parametri propri del modello che non sono tra i campi qui sopra, con i nomi del modello (li dice modelli con modello)');

// Una generazione di Atlas in corso: si paga quando è pronta. Quelle che Claude non ha aspettato si controllano a fine
// chat e si pagano se non sono fallite, perché Atlas le fa comunque.
interface Pending {
  id: string;
  model: string;
  task: 'clip' | 'image' | 'upscale';
  costUsd?: number;
  units: number;
  unit: string;
  startedAt: number;
  settled: boolean;
  outcome: Promise<string>;
}

export function mediaServer(brandDir: string, keys: ServiceKeys) {
  const { inside, save } = brandFolder(brandDir);
  const gemini = keys.gemini ? geminiClient(keys.gemini, inside) : undefined;
  const atlas = keys.atlas ? atlasClient(keys.atlas, inside) : undefined;
  const pending = new Map<string, Pending>();

  const needAtlas = () => {
    if (!atlas) throw new Error('Atlas non è configurato');
    return atlas;
  };

  const settle = (job: Pending, outcome: 'ok' | 'error', error?: string) => {
    if (job.settled) return;
    job.settled = true;
    reportUsage({
      task: job.task,
      model: job.model,
      outcome,
      durationMs: Date.now() - job.startedAt,
      ...(outcome === 'ok' ? { costUsd: job.costUsd, units: job.units, unit: job.unit } : { error }),
    });
  };

  // Avvia su Atlas, poi in sottofondo aspetta, scarica e salva; attendi legge l'esito.
  const launch = async (found: AtlasModel, request: Record<string, unknown>, target: string, task: Pending['task'], seconds: number) => {
    const client = needAtlas();
    const costUsd = client.cost(found, request, seconds);
    const id = await client.start(found.type === 'Image' ? 'generateImage' : 'generateVideo', request);
    const job: Pending = {
      id,
      model: found.model,
      task,
      costUsd,
      units: found.type === 'Video' ? seconds : 1,
      unit: found.type === 'Video' ? 'secondi' : 'immagini',
      startedAt: Date.now(),
      settled: false,
      outcome: Promise.resolve(''),
    };
    job.outcome = client
      .result(id)
      .then(async ([url]) => {
        settle(job, 'ok');
        await save(target, await download(url!));
        return `salvato in ${target}`;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        settle(job, 'error', message);
        return `non riuscito: ${message}`;
      });
    pending.set(target, job);
    return costUsd;
  };

  const generateImage = tool(
    'genera_immagine',
    'Genera un’immagine, o ne ritocca una partendo dai riferimenti, e la salva nella cartella del brand. ' +
      `Di default ${DEFAULT_IMAGE}, che segue bene testi e riferimenti; un modello di Atlas si passa con il suo nome (modelli).`,
    {
      prompt: z.string().min(1),
      riferimenti: z.array(z.string()).max(14).optional().describe('Immagini della cartella del brand da seguire o da ritoccare, nell’ordine'),
      proporzione: z.enum(ASPECTS),
      dimensione: z.enum(['1K', '2K', '4K']).optional().describe('Solo per Gemini, di default 2K'),
      modello: z.string().optional(),
      parametri: extraParameters,
      salva: savePath.describe('Dove salvarla, es. lavoro/copertina.png; l’estensione segue il formato restituito'),
    },
    async ({ prompt, riferimenti = [], proporzione, dimensione = '2K', modello = DEFAULT_IMAGE, parametri, salva }) => {
      try {
        inside(salva);
        if (modello.includes('/')) {
          const client = needAtlas();
          const found = await client.find(modello);
          const fields: Fields = { prompt, aspect: proporzione, ...(riferimenti.length > 1 ? { images: riferimenti } : riferimenti[0] ? { image: riferimenti[0] } : {}) };
          const { request, notes } = await client.body(found, fields, parametri);
          await launch(found, request, salva, 'image', 1);
          const outcome = await pending.get(salva)!.outcome;
          pending.delete(salva);
          return text([`${salva}: ${outcome}.`, ...notes].join('\n'));
        }
        if (!gemini) throw new Error('Gemini non è configurato');
        const response = await gemini.generate('image', modello, riferimenti, prompt, {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { aspectRatio: proporzione, imageSize: dimensione },
          ...parametri,
        });
        const parts = response.candidates?.[0]?.content?.parts ?? [];
        const image = parts.find((item) => item.inlineData?.data && item.inlineData.mimeType?.startsWith('image/'));
        if (!image?.inlineData?.data) {
          const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason;
          const said = parts.map((item) => (item.thought ? '' : (item.text ?? ''))).join(' ').trim();
          throw new Error(`nessuna immagine restituita${reason ? ` (${reason})` : ''}${said ? `: ${said.slice(0, 400)}` : ''}`);
        }
        const target = salva.replace(/\.[a-z0-9]+$/i, '') + (IMAGE_EXTENSIONS[image.inlineData.mimeType ?? ''] ?? '.png');
        await save(target, Buffer.from(image.inlineData.data, 'base64'));
        return text(`Salvata in ${target}.`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const generateClip = tool(
    'genera_clip',
    'Avvia una clip video, da un’immagine della cartella del brand o solo dal testo, e risponde subito: poi attendi. Più clip si avviano insieme. ' +
      `Di default ${DEFAULT_CLIP.fromImage} (da immagine) e ${DEFAULT_CLIP.fromText} (da testo); gli altri modelli con prezzi e parametri sono in modelli. ` +
      'Un campo che il modello non prende si ignora e te lo dice.',
    {
      prompt: z.string().min(1),
      immagine: z.string().optional().describe('Il primo fotogramma, dalla cartella del brand'),
      immagine_finale: z.string().optional().describe('L’ultimo fotogramma, se il modello lo prende'),
      durata: z.number().int().positive().describe('In secondi'),
      proporzione: z.enum(['9:16', '16:9', '1:1', '4:5', '3:4']).optional(),
      risoluzione: z.string().optional().describe('es. 720p, 1080p'),
      audio: z.boolean().optional().describe('Se il modello genera anche l’audio'),
      modello: z.string().optional(),
      parametri: extraParameters,
      salva: savePath.describe('Dove salvarla, es. lavoro/clip/1.mp4'),
    },
    async ({ prompt, immagine, immagine_finale, durata, proporzione, risoluzione, audio, modello, parametri, salva }) => {
      try {
        inside(salva);
        const client = needAtlas();
        const found = await client.find(modello ?? (immagine ? DEFAULT_CLIP.fromImage : DEFAULT_CLIP.fromText));
        const { request, notes } = await client.body(
          found,
          { prompt, image: immagine, endImage: immagine_finale, duration: durata, aspect: proporzione, resolution: risoluzione, audio },
          parametri,
        );
        const costUsd = await launch(found, request, salva, 'clip', Number(request.duration) || durata);
        return text([`Avviata ${salva} con ${found.model}, circa ${credits(costUsd)}. Aspettala con attendi prima di usarla.`, ...notes].join('\n'));
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const upscale = tool(
    'migliora',
    'Rende più nitida e grande una foto o un video della cartella del brand, senza cambiarne il contenuto. Risponde subito: poi attendi. ' +
      `Di default ${UPSCALER.image} e ${UPSCALER.video}; altri upscaler sono in modelli.`,
    {
      file: z.string().describe('L’immagine (PNG, JPEG, WebP) o il video (MP4, MOV) da migliorare'),
      modello: z.string().optional(),
      parametri: extraParameters.describe('es. {"target_resolution":"2k"} per il video, {"outscale":2} per l’immagine'),
      salva: savePath,
    },
    async ({ file, modello, parametri, salva }) => {
      try {
        inside(salva);
        const client = needAtlas();
        const video = /\.(mp4|mov|webm)$/i.test(file);
        const found = await client.find(modello ?? (video ? UPSCALER.video : UPSCALER.image));
        const { request, notes } = await client.body(found, video ? { video: file } : { image: file }, parametri);
        const seconds = video ? (mp4Seconds(await readFile(inside(file))) ?? 10) : 1;
        const costUsd = await launch(found, request, salva, 'upscale', Math.ceil(seconds));
        return text([`Avviato ${salva} con ${found.model}, circa ${credits(costUsd)}. Aspettalo con attendi.`, ...notes].join('\n'));
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const wait = tool(
    'attendi',
    'Aspetta le clip e i miglioramenti avviati e dice dove sono salvati o perché non sono riusciti. Senza argomenti li aspetta tutti.',
    { salva: z.array(z.string()).optional().describe('I percorsi di salva da aspettare') },
    async ({ salva }) => {
      const targets = salva?.length ? salva : [...pending.keys()];
      if (targets.length === 0) return text('Niente in corso.');
      const lines = await Promise.all(
        targets.map(async (target) => {
          const job = pending.get(target);
          if (!job) return `${target}: niente avviato con questo percorso.`;
          const outcome = await job.outcome;
          pending.delete(target);
          return `${target}: ${outcome}.`;
        }),
      );
      return text(lines.join('\n'));
    },
    PARALLEL,
  );

  const catalog = tool(
    'modelli',
    'I modelli di Atlas per clip, immagini, upscaler e audio, con il prezzo base (al secondo per i video, a pezzo per il resto). ' +
      'Con modello dice i suoi parametri, da passare in parametri se non sono già tra i campi dei tool.',
    {
      tipo: z.enum(['Video', 'Image', 'Audio']).optional(),
      cerca: z.string().optional().describe('Parte del nome, es. kling, seedance, upscaler, image-to-video'),
      modello: z.string().optional().describe('Il nome esatto di un modello, per i suoi parametri'),
    },
    async ({ tipo, cerca, modello }) => {
      try {
        const client = needAtlas();
        if (modello) {
          const found = await client.find(modello);
          const { properties, required } = await client.schema(found);
          const lines = Object.entries(properties)
            .filter(([name]) => name !== 'model')
            .map(
              ([name, property]) =>
                `- ${name}${required.includes(name) ? ' (obbligatorio)' : ''}: ${property.type ?? ''}${property.enum ? ` [${property.enum.join(', ')}]` : ''}${property.default !== undefined ? `, predefinito ${String(property.default)}` : ''}${property.description ? `. ${property.description.slice(0, 200)}` : ''}`,
            );
          return text([`${found.model} (${found.type}, base ${found.price?.actual?.base_price ?? '?'} $)`, found.profile?.slice(0, 400), ...lines].filter(Boolean).join('\n'));
        }
        const query = cerca?.toLowerCase();
        const found = (await client.models())
          .filter((item) => (tipo ? item.type === tipo : item.type !== 'Text'))
          .filter((item) => !query || `${item.model} ${item.displayName}`.toLowerCase().includes(query))
          .slice(0, 80)
          .map((item) => `- ${item.model} (${item.type}, base ${item.price?.actual?.base_price ?? '?'} $)`);
        return text(found.length > 0 ? found.join('\n') : 'Nessun modello trovato.');
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const tools = [...(gemini || atlas ? [generateImage] : []), ...(atlas ? [generateClip, upscale, wait, catalog] : [])];

  return {
    server: createSdkMcpServer({ name: 'media', tools }),
    // A fine chat: quelle non aspettate si guardano una volta, e se non sono fallite si pagano.
    async close() {
      if (!atlas) return;
      await Promise.all(
        [...pending.values()]
          .filter((job) => !job.settled)
          .map(async (job) => {
            const prediction = await atlas.status(job.id).catch(() => null);
            if (prediction?.status === 'failed' || prediction?.status === 'error') settle(job, 'error', prediction.error || 'failed');
            else settle(job, 'ok');
          }),
      );
    },
  };
}
