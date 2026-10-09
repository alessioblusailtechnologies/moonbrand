import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { measure } from '../lib/usage';
import { PARALLEL } from './parallel';

// Le clip dei video con Gemini Omni Flash su Atlas Cloud, via API: da una foto della cartella, da immagini di riferimento
// o solo dal testo. Scelto il 2026-10-02 dopo una prova sulle stesse foto con Grok 1.5, MiniMax H3 Max e Seedance 2.0:
// è quello che segue meglio il prompt quando una persona deve fare un'azione precisa. Esce sempre a 720p, da 3 a 10 s,
// in 9:16 o 16:9. Come la musica, la clip si fa in sottofondo: gira_clip risponde subito e attendi_clip aspetta.
const API = 'https://api.atlascloud.ai/api/v1';
const MODEL = 'google/gemini-omni-flash';
// Dal 2026-10-09 (MOONBRAND_CLIP_MODEL=omni per tornare indietro): Kling 3.0 Pro per le clip da foto e da testo, in 1080p, da 3 a
// 15 s, con l'audio; da foto la proporzione è quella della foto. Non ha i riferimenti: quelli restano a Omni Flash.
// Misurato dal saldo: 0,143 $/s, e circa due minuti e mezzo per una clip di 5 s.
const KLING = process.env.MOONBRAND_CLIP_MODEL !== 'omni';
const KLING_MODEL = 'kwaivgi/kling-v3.0-pro';
const KLING_USD_PER_SECOND = 0.143;
// Il prezzo vero per secondo, misurato dal saldo di Atlas (720p, l'unica risoluzione): il costo di ogni clip va in ai_usage.
const USD_PER_SECOND = { 'image-to-video': 0.13, 'reference-to-video': 0.135, 'text-to-video': 0.125 } as const;
const usdPerSecond = (mode: Mode) => (KLING && mode !== 'reference-to-video' ? KLING_USD_PER_SECOND : USD_PER_SECOND[mode]);
const MAX_SECONDS = KLING ? 15 : 10;
const MAX_REFERENCE_SECONDS = 10;
const creditsPerSecond = Math.round((KLING ? KLING_USD_PER_SECOND : USD_PER_SECOND['image-to-video']) * 100);
// L'indicazione di massima per le clip, per tutta la conversazione (o per il contenuto nei job lanciati dallo studio). Il
// worker passa quanto si è già speso nei turni prima di questo. In chat serve solo a progettare: l'utente conferma il
// consumo stimato nel copione, e se la qualità lo chiede si va oltre. Nei job dello studio non c'è nessuno a cui chiedere,
// quindi lì è un tetto e gira_clip rifiuta.
const BUDGET_USD = Number(process.env.MOONBRAND_CLIP_BUDGET_USD) || 3;
const SPENT_BEFORE_USD = Number(process.env.MOONBRAND_CLIP_SPENT_USD) || 0;
const SCOPE = process.env.MOONBRAND_CLIP_SCOPE === 'contenuto' ? 'contenuto' : 'conversazione';
const POLL_MS = 3_000;
const MAX_WAIT_MS = 10 * 60_000;
// Le foto passano in base64 dentro la richiesta: oltre questa misura meglio una versione più leggera.
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_REFERENCES = 10;
const IMAGE_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

type Mode = keyof typeof USD_PER_SECOND;

interface Prediction {
  status?: string;
  outputs?: string[];
  error?: string | null;
}

// All'agente i costi arrivano in crediti, come li vede l'utente: 1 credito è 1 centesimo di dollaro di costo vero.
const credits = (usd: number) => `${Math.round(usd * 100)} crediti`;

// La chiave resta in questo processo: Claude vede solo i tool, non le chiamate ad Atlas.
export function clipTools(folder: string, apiKey: string) {
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };

  // La spesa della conversazione: si conta all'avvio di ogni clip, e si restituisce se la clip non riesce (Atlas non addebita
  // le clip fallite).
  let spent = SPENT_BEFORE_USD;
  const left = () => Math.max(0, BUDGET_USD - spent);
  const status = () =>
    spent > BUDGET_USD
      ? `In questa ${SCOPE} le clip sono a ${credits(spent)}, oltre l’indicazione di ${credits(BUDGET_USD)}.`
      : `In questa ${SCOPE} le clip sono a ${credits(spent)} sull’indicazione di ${credits(BUDGET_USD)}.`;

  const call = async (url: string, body?: unknown): Promise<Prediction & { id?: string }> => {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Il motore video ha risposto ${response.status}: ${text.slice(0, 300)}`);
    const parsed = JSON.parse(text) as { data?: Prediction & { id?: string } } & Prediction & { id?: string };
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
        return { content: [{ type: 'text' as const, text: `Clip salvata in ${file}.` }] };
      }
      if (Date.now() - started > MAX_WAIT_MS) throw new Error('La clip non è arrivata entro 10 minuti.');
    }
  };
  const failure = (error: unknown) => ({
    content: [{ type: 'text' as const, text: `Non riuscita: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });

  // Le clip in corso, per file chiesto: ognuna finisce con il messaggio di generate o con l'errore.
  type Result = Awaited<ReturnType<typeof generate>> | ReturnType<typeof failure>;
  const pending = new Map<string, Promise<Result>>();

  const shoot = tool(
    'gira_clip',
    `Avvia una clip video con il motore video e la salva nella cartella del brand: risponde subito e la clip arriva in ${KLING ? 'due o tre minuti' : 'circa un minuto'} ` +
      '(poi attendi_clip). Più clip si avviano insieme, nello stesso messaggio. Tre modi: da una foto della cartella, che diventa il primo fotogramma (foto); ' +
      'da immagini di riferimento per persone, prodotti o luoghi da tenere uguali (riferimenti); o solo dal testo. ' +
      (KLING
        ? `Da foto o da testo esce in 1080p, da 3 a ${MAX_SECONDS} secondi; da foto la proporzione è quella della foto (JPEG o PNG), quindi preparala già nel formato giusto; con i riferimenti esce a 720p, da 3 a ${MAX_REFERENCE_SECONDS} secondi. `
        : `Esce a 720p, da 3 a ${MAX_SECONDS} secondi. `) +
      'Da testo e con i riferimenti esce in 9:16 o 16:9 (per 4:5 e 1:1 gira in 9:16 e ritaglia nella composizione). La clip ha un suo audio: nel video toglilo o abbassalo se serve. ' +
      `Costa circa ${creditsPerSecond} crediti al secondo: chiedi solo i secondi che userai. ` +
      (SCOPE === 'conversazione'
        ? `L’indicazione di massima per le clip di tutta la conversazione è ${credits(BUDGET_USD)}: serve a progettare, e si supera se la qualità lo chiede e il consumo stimato del copione lo comprende.`
        : `Le clip di questo contenuto hanno un tetto di ${credits(BUDGET_USD)}: oltre, la clip non parte.`),
    {
      prompt: z
        .string()
        .min(10)
        .describe('Cosa succede nella clip, in inglese: azione, movimento di macchina, luce, cosa deve restare uguale (es. "no text changes")'),
      foto: z.string().optional().describe('La foto di partenza, relativa alla cartella del brand: il primo fotogramma della clip'),
      riferimenti: z
        .array(z.string())
        .min(1)
        .max(MAX_REFERENCES)
        .optional()
        .describe(`In alternativa alla foto: da 1 a ${MAX_REFERENCES} immagini di riferimento, relative alla cartella del brand, descritte nel prompt`),
      durata: z.number().int().min(3).max(MAX_SECONDS).describe(`Secondi, da 3 a ${MAX_SECONDS}: quelli che userai nel montaggio`),
      formato: z.enum(['9:16', '16:9']).describe('La proporzione: 9:16 per i verticali (anche da ritagliare in 4:5 o 1:1), 16:9 per gli orizzontali'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.mp4$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. video/public/contenuti/<id>/clip-1.mp4'),
    },
    async ({ prompt, foto, riferimenti, durata, formato, file }) => {
      try {
        if (foto && riferimenti) throw new Error('Usa la foto di partenza oppure i riferimenti, non tutti e due.');
        inside(file);
        const mode: Mode = foto ? 'image-to-video' : riferimenti ? 'reference-to-video' : 'text-to-video';
        if (mode === 'reference-to-video' && durata > MAX_REFERENCE_SECONDS) throw new Error(`Con i riferimenti la clip dura al massimo ${MAX_REFERENCE_SECONDS} secondi.`);
        const cost = durata * usdPerSecond(mode);
        if (SCOPE === 'contenuto' && cost > left()) {
          throw new Error(
            `questa clip consumerebbe ${credits(cost)}: ${status()} ` +
              'Qui non c’è nessuno a cui chiedere: chiudi il video con foto, immagini animate e grafica, e nella risposta di’ quali clip sono mancate.',
          );
        }
        const request =
          KLING && mode !== 'reference-to-video'
            ? {
                model: `${KLING_MODEL}/${mode}`,
                prompt,
                duration: durata,
                sound: true,
                ...(foto ? { image: await image(foto), resolution: '1080P' } : { aspect_ratio: formato }),
              }
            : {
                model: `${MODEL}/${mode}`,
                prompt,
                duration: durata,
                aspect_ratio: formato,
                resolution: '720p',
                ...(foto && { image: await image(foto) }),
                ...(riferimenti && { images: await Promise.all(riferimenti.map(image)) }),
              };
        spent += cost;
        const job = measure({ task: 'clip', model: request.model, extra: () => ({ costUsd: cost, units: durata, unit: 'secondi' }) }, () =>
          generate(request, file),
        ).catch((error: unknown) => {
          spent -= cost;
          return failure(error);
        });
        pending.set(file, job);
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Avviata (${credits(cost)}): la clip arriva in ${file} in circa un minuto. ${status()} ` +
                'Intanto continua: le altre clip, la composizione, i testi. Prima di usarla o di renderizzare chiama attendi_clip.',
            },
          ],
        };
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const wait = tool(
    'attendi_clip',
    'Aspetta che le clip avviate con gira_clip siano pronte e dice dove sono salvate o perché non sono riuscite. ' +
      'Senza file aspetta tutte quelle in corso. Da chiamare prima di usare una clip nel video, di guardarla o di renderizzare.',
    { file: z.array(z.string()).optional().describe('I file chiesti a gira_clip; vuoto per tutti') },
    async ({ file }) => {
      const files = file?.length ? file : [...pending.keys()];
      if (files.length === 0) return { content: [{ type: 'text' as const, text: 'Nessuna clip in corso.' }] };
      const results = await Promise.all(
        files.map(async (item) => {
          const job = pending.get(item);
          if (!job) return { text: `${item}: nessuna clip avviata con questo nome.`, error: true };
          const result = await job;
          pending.delete(item);
          return { text: result.content[0].text, error: 'isError' in result };
        }),
      );
      return {
        content: [{ type: 'text' as const, text: [...results.map((result) => result.text), status()].join('\n') }],
        ...(results.some((result) => result.error) && { isError: true }),
      };
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'clip', tools: [shoot, wait] });
}
