import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { measure } from '../service/usage';
import { brandFolder, failure, IMAGE_TYPES, PARALLEL, text } from './common';

// Le clip dei video su Atlas Cloud, via API: da una foto della cartella (il primo fotogramma), da immagini di riferimento
// (persone, prodotti o luoghi da tenere uguali) o solo dal testo. Kling 3.0 Pro per le clip da foto e da testo (1080p,
// da 3 a 15 s, con l'audio); Gemini Omni Flash per quelle con i riferimenti (720p, da 3 a 10 s). Come la musica, la clip
// si fa in sottofondo: gira_clip risponde subito e attendi_clip aspetta.
const API = 'https://api.atlascloud.ai/api/v1';
const OMNI_MODEL = 'google/gemini-omni-flash';
const KLING_MODEL = 'kwaivgi/kling-v3.0-pro';
// MOONBRAND_CLIP_MODEL=omni per fare tutto con Omni Flash.
const KLING = process.env.MOONBRAND_CLIP_MODEL !== 'omni';
// I prezzi per secondo, misurati dal saldo di Atlas: il costo di ogni clip va in ai_usage.
const KLING_USD_PER_SECOND = 0.143;
const OMNI_USD_PER_SECOND = { 'image-to-video': 0.13, 'reference-to-video': 0.135, 'text-to-video': 0.125 } as const;
type Mode = keyof typeof OMNI_USD_PER_SECOND;
const usdPerSecond = (mode: Mode) => (KLING && mode !== 'reference-to-video' ? KLING_USD_PER_SECOND : OMNI_USD_PER_SECOND[mode]);
const MAX_SECONDS = KLING ? 15 : 10;
const MAX_REFERENCE_SECONDS = 10;
const CREDITS_PER_SECOND = Math.round(usdPerSecond('image-to-video') * 100);
const POLL_MS = 3_000;
// Una clip arriva in 1-3 minuti; oltre i 5 è bloccata da Atlas: meglio dirlo subito e farla rilanciare.
const MAX_WAIT_MS = 5 * 60_000;
// Le foto passano in base64 dentro la richiesta: oltre questa misura meglio una versione più leggera.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCES = 10;

interface Prediction {
  status?: string;
  outputs?: string[];
  error?: string | null;
  id?: string;
}

// All'agente i costi arrivano in crediti, come li vede l'utente: 1 credito è 1 centesimo di dollaro di costo vero.
const credits = (usd: number) => `${Math.round(usd * 100)} crediti`;

// cap: nei lavori senza nessuno a cui chiedere (quelli dello studio) un tetto in dollari per le clip di questo lavoro;
// nella chat non c'è, l'utente ha confermato il copione con la stima.
export function clipTools(folder: string, apiKey: string, cap?: number) {
  const { inside } = brandFolder(folder);
  // Quanto si è speso in questo lavoro: si conta all'avvio di ogni clip e si restituisce se la clip non riesce (Atlas non
  // addebita le clip fallite).
  let spent = 0;
  const status = () => `Clip di questo lavoro finora: ${credits(spent)}${cap ? ` su un tetto di ${credits(cap)}` : ''}.`;

  const call = async (url: string, body?: unknown): Promise<Prediction> => {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Il motore video ha risposto ${response.status}: ${raw.slice(0, 300)}`);
    const parsed = JSON.parse(raw) as { data?: Prediction } & Prediction;
    return parsed.data ?? parsed;
  };

  // Una foto della cartella come data URI, come la vuole Atlas.
  const image = async (relative: string) => {
    const type = IMAGE_TYPES[path.extname(relative).toLowerCase()];
    if (!type) throw new Error(`${relative}: servono foto JPEG, PNG o WebP.`);
    const bytes = await readFile(inside(relative));
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`${relative}: la foto supera 8 MB, usane una più leggera.`);
    return `data:${type};base64,${bytes.toString('base64')}`;
  };

  const generate = async (request: Record<string, unknown>, file: string) => {
    const { id } = await call(`${API}/model/generateVideo`, request);
    if (!id) throw new Error('Il motore video non ha restituito il lavoro.');
    const started = Date.now();
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      // Un errore di rete durante l'attesa non perde la clip: si riprova al giro dopo.
      const prediction = await call(`${API}/model/prediction/${id}`).catch(() => null);
      if (prediction?.status === 'failed') throw new Error(prediction.error || 'Il motore video non è riuscito a girare la clip.');
      const url = prediction?.status === 'completed' || prediction?.status === 'succeeded' ? prediction.outputs?.[0] : undefined;
      if (url) {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Non riesco a scaricare la clip: ${response.status}`);
        const target = inside(file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        return text(`Clip salvata in ${file}.`);
      }
      if (Date.now() - started > MAX_WAIT_MS) throw new Error('La clip non è arrivata entro 5 minuti: si è bloccata, rilanciala.');
    }
  };

  // Le clip in corso, per file chiesto: ognuna finisce con il messaggio di generate o con l'errore.
  type Result = Awaited<ReturnType<typeof generate>> | ReturnType<typeof failure>;
  const pending = new Map<string, Promise<Result>>();

  const shoot = tool(
    'gira_clip',
    `Avvia una clip video con il motore video e la salva nella cartella del brand: risponde subito e la clip arriva in ${KLING ? 'due o tre minuti' : 'circa un minuto'} (poi attendi_clip). ` +
      'Più clip si avviano insieme, nello stesso messaggio. Tre modi: da una foto della cartella, che diventa il primo fotogramma (foto); da immagini di riferimento per persone, prodotti o luoghi da tenere uguali (riferimenti); o solo dal testo. ' +
      (KLING
        ? `Da foto o da testo esce in 1080p, da 3 a ${MAX_SECONDS} secondi; da foto la proporzione è quella della foto, quindi preparala già nel formato giusto; con i riferimenti esce a 720p, da 3 a ${MAX_REFERENCE_SECONDS} secondi. `
        : `Esce a 720p, da 3 a ${MAX_SECONDS} secondi. `) +
      'Da testo e con i riferimenti esce in 9:16 o 16:9 (per 4:5 e 1:1 gira in 9:16 e ritaglia nella composizione). La clip ha un suo audio: nel video toglilo o abbassalo se serve. ' +
      `Costa circa ${CREDITS_PER_SECOND} crediti al secondo: chiedi solo i secondi che userai.`,
    {
      prompt: z.string().min(10).describe('Cosa succede nella clip, in inglese: azione, movimento di macchina, luce, cosa deve restare uguale (es. "no text changes")'),
      foto: z.string().optional().describe('La foto di partenza, relativa alla cartella del brand: il primo fotogramma della clip'),
      riferimenti: z.array(z.string()).min(1).max(MAX_REFERENCES).optional().describe(`In alternativa alla foto: da 1 a ${MAX_REFERENCES} immagini di riferimento, relative alla cartella del brand, descritte nel prompt`),
      durata: z.number().int().min(3).max(MAX_SECONDS).describe(`Secondi, da 3 a ${MAX_SECONDS}: quelli che userai nel montaggio`),
      formato: z.enum(['9:16', '16:9']).describe('La proporzione: 9:16 per i verticali (anche da ritagliare in 4:5 o 1:1), 16:9 per gli orizzontali'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.mp4$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. video/public/contenuti/<id>/clip-1.mp4'),
    },
    async ({ prompt, foto, riferimenti, durata, formato, file }) => {
      try {
        if (foto && riferimenti) throw new Error('usa la foto di partenza oppure i riferimenti, non tutti e due.');
        inside(file);
        const mode: Mode = foto ? 'image-to-video' : riferimenti ? 'reference-to-video' : 'text-to-video';
        if (mode === 'reference-to-video' && durata > MAX_REFERENCE_SECONDS) throw new Error(`con i riferimenti la clip dura al massimo ${MAX_REFERENCE_SECONDS} secondi.`);
        const cost = durata * usdPerSecond(mode);
        if (cap !== undefined && spent + cost > cap) {
          throw new Error(`questa clip consumerebbe ${credits(cost)}. ${status()} Qui non c’è nessuno a cui chiedere: chiudi il video con foto, immagini animate e grafica, e nella risposta di’ quali clip sono mancate.`);
        }
        const request =
          KLING && mode !== 'reference-to-video'
            ? { model: `${KLING_MODEL}/${mode}`, prompt, duration: durata, sound: true, ...(foto ? { image: await image(foto), resolution: '1080P' } : { aspect_ratio: formato }) }
            : {
                model: `${OMNI_MODEL}/${mode}`,
                prompt,
                duration: durata,
                aspect_ratio: formato,
                resolution: '720p',
                ...(foto && { image: await image(foto) }),
                ...(riferimenti && { images: await Promise.all(riferimenti.map(image)) }),
              };
        spent += cost;
        const job = measure({ task: 'clip', model: request.model, extra: () => ({ costUsd: cost, units: durata, unit: 'secondi' }) }, () => generate(request, file)).catch((error: unknown) => {
          spent -= cost;
          return failure(error);
        });
        pending.set(file, job);
        return text(`Avviata (${credits(cost)}): la clip arriva in ${file}. ${status()} Intanto continua: le altre clip, la composizione, i testi. Prima di usarla o di renderizzare chiama attendi_clip.`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const wait = tool(
    'attendi_clip',
    'Aspetta che le clip avviate con gira_clip siano pronte e dice dove sono salvate o perché non sono riuscite. Senza file aspetta tutte quelle in corso. Da chiamare prima di usare una clip nel video, di guardarla o di renderizzare.',
    { file: z.array(z.string()).optional().describe('I file chiesti a gira_clip; vuoto per tutti') },
    async ({ file }) => {
      const files = file?.length ? file : [...pending.keys()];
      if (files.length === 0) return text('Nessuna clip in corso.');
      const results = await Promise.all(
        files.map(async (item) => {
          const job = pending.get(item);
          if (!job) return { text: `${item}: nessuna clip avviata con questo nome.`, error: true };
          const result = await job;
          pending.delete(item);
          return { text: result.content[0].text, error: 'isError' in result };
        }),
      );
      return { content: [{ type: 'text' as const, text: [...results.map((result) => result.text), status()].join('\n') }], ...(results.some((result) => result.error) && { isError: true as const }) };
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'clip', tools: [shoot, wait] });
}
