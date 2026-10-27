import { randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { atlasMeasured, atlasPrice, ELEVENLABS, geminiCost } from './prices';
import type { Usage } from './usage';

// La chat chiama Gemini, Atlas ed ElevenLabs da sé, con node o curl: passa da qui, un server del worker su 127.0.0.1, uno
// per job. Claude ha l'indirizzo del proxy al posto di quello del servizio e una chiave che vale solo qui: la chiave vera
// la mette il proxy, che registra ogni generazione con il suo costo in ai_usage, da cui partono i crediti.
// Il token nel percorso dice di quale job è la chiamata.

export interface ServiceKeys {
  gemini?: string;
  atlas?: string;
  elevenlabs?: string;
}

type Service = keyof ServiceKeys;

const UPSTREAM: Record<Service, string> = {
  gemini: 'https://generativelanguage.googleapis.com',
  atlas: 'https://api.atlascloud.ai',
  elevenlabs: 'https://api.elevenlabs.io',
};

// Le variabili d'ambiente della chat per ogni servizio: l'indirizzo e la chiave.
const ENV: Record<Service, string> = { gemini: 'GEMINI', atlas: 'ATLASCLOUD', elevenlabs: 'ELEVENLABS' };

// Le intestazioni che non si inoltrano: le chiavi di Claude, quelle della connessione e la compressione, perché la
// risposta si legge per contare.
const DROPPED_REQUEST = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'expect',
  'accept-encoding',
  'authorization',
  'x-goog-api-key',
  'xi-api-key',
]);
const DROPPED_RESPONSE = new Set(['connection', 'content-length', 'content-encoding', 'transfer-encoding', 'keep-alive']);

interface Exchange {
  method: string;
  path: string;
  request: unknown;
  status: number;
  response: unknown;
  durationMs: number;
}

// Una clip o un'immagine di Atlas si paga quando è pronta: si registra quando Claude la trova finita, o a fine job.
interface PendingPrediction {
  model: string;
  units: number;
  unit: string;
  usdPerUnit?: number;
  startedAt: number;
}

export async function startProxy(keys: ServiceKeys, record: (usage: Usage) => void) {
  const token = randomBytes(18).toString('hex');
  const pending = new Map<string, PendingPrediction>();
  let base = '';

  const warn = (message: string) => console.warn(`[proxy] ${message}`);

  // Gemini: generateContent e streamGenerateContent riportano i token, anche quelli delle immagini.
  const gemini = ({ method, path, status, response, durationMs }: Exchange) => {
    const call = /\/models\/([^/:]+):(\w+)/.exec(path);
    if (method !== 'POST' || !call || call[2] === 'countTokens' || call[2] === 'embedContent' || call[2] === 'batchEmbedContents') return;
    const [, model, action] = call as unknown as [string, string, string];
    if (status >= 400) return record({ task: 'gemini', model, outcome: 'error', error: `${action} ${status}`, durationMs });
    const metadata = geminiUsage(response);
    if (!metadata) {
      warn(`Gemini ${model}:${action} senza token, costo non calcolato`);
      return record({ task: 'gemini', model, outcome: 'ok', durationMs });
    }
    const image = metadata.candidatesTokensDetails?.find((detail) => detail.modality === 'IMAGE')?.tokenCount ?? 0;
    const output = (metadata.candidatesTokenCount ?? 0) - image + (metadata.thoughtsTokenCount ?? 0);
    const input = metadata.promptTokenCount ?? 0;
    const costUsd = geminiCost(model, { input, output, image });
    if (costUsd === undefined) warn(`Gemini ${model} non è nel listino (prices.ts)`);
    const images = countImages(response);
    record({
      task: images > 0 ? 'image' : 'gemini',
      model,
      outcome: 'ok',
      durationMs,
      costUsd,
      inputTokens: input,
      outputTokens: output + image,
      ...(images > 0 && { units: images, unit: 'immagini' }),
    });
  };

  const atlasDone = async (id: string, status: string, error?: string) => {
    const job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    const task = job.unit === 'secondi' ? 'clip' : 'image';
    if (status === 'failed') return record({ task, model: job.model, outcome: 'error', error: error || 'failed', durationMs: Date.now() - job.startedAt });
    record({
      task,
      model: job.model,
      outcome: 'ok',
      durationMs: Date.now() - job.startedAt,
      units: job.units,
      unit: job.unit,
      costUsd: job.usdPerUnit === undefined ? undefined : job.units * job.usdPerUnit,
    });
  };

  // Atlas: generateVideo e generateImage avviano, prediction/{id} dice quando è pronta. I modelli di testo, sullo stile
  // di OpenAI, riportano i token.
  const atlas = async ({ method, path, request, status, response, durationMs }: Exchange) => {
    const body = (request ?? {}) as Record<string, unknown>;
    const data = (response as { data?: { id?: string; status?: string; error?: string } } | null)?.data;
    if (method === 'POST' && /\/model\/generate(Video|Image)$/.test(path)) {
      const model = String(body.model ?? '');
      if (status >= 400 || !data?.id) return record({ task: path.endsWith('Video') ? 'clip' : 'image', model, outcome: 'error', error: `${status}`, durationMs });
      const video = path.endsWith('Video');
      const measured = video ? atlasMeasured(model, typeof body.resolution === 'string' ? body.resolution : undefined) : undefined;
      const price = measured === undefined ? await atlasPrice(keys.atlas!, model).catch((error: unknown) => warn(String(error))) : undefined;
      if (measured === undefined && !price?.base) warn(`Atlas ${model} senza prezzo nel catalogo`);
      const seconds = Number(body.duration);
      if (video && !(seconds > 0)) warn(`Atlas ${model} senza durata: contati 5 secondi`);
      pending.set(data.id, {
        model,
        units: video ? (seconds > 0 ? seconds : 5) : Number(body.num_images ?? body.n ?? 1) || 1,
        unit: video ? 'secondi' : 'immagini',
        usdPerUnit: measured ?? price?.base,
        startedAt: Date.now() - durationMs,
      });
      return;
    }
    const prediction = /\/model\/prediction\/([^/?]+)/.exec(path);
    if (method === 'GET' && prediction && data?.status && ['completed', 'succeeded', 'failed'].includes(data.status)) {
      return atlasDone(prediction[1]!, data.status === 'failed' ? 'failed' : 'completed', data.error);
    }
    if (method === 'POST' && path.endsWith('/chat/completions')) {
      const model = String(body.model ?? '');
      const usage = (response as { usage?: { prompt_tokens?: number; completion_tokens?: number } } | null)?.usage;
      const price = await atlasPrice(keys.atlas!, model).catch(() => undefined);
      const input = usage?.prompt_tokens ?? 0;
      const output = usage?.completion_tokens ?? 0;
      const costUsd = price?.input !== undefined && price.output !== undefined ? (input * price.input + output * price.output) / 1_000_000 : undefined;
      if (costUsd === undefined) warn(`Atlas ${model} senza prezzo dei token`);
      record({ task: 'text', model, outcome: status >= 400 ? 'error' : 'ok', durationMs, costUsd, inputTokens: input, outputTokens: output });
    }
  };

  // ElevenLabs: la voce si paga a caratteri, musica ed effetti a durata, la trascrizione a durata dell'audio.
  const elevenlabs = ({ method, path, request, status, response, durationMs }: Exchange) => {
    if (method !== 'POST') return;
    const body = (request ?? {}) as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === 'string' ? value.length : 0);
    let usage: Omit<Usage, 'outcome' | 'durationMs'> | undefined;
    if (/^\/v1\/text-to-speech\//.test(path)) {
      const characters = text(body.text);
      usage = { task: 'voice', model: String(body.model_id ?? 'tts'), units: characters, unit: 'caratteri', costUsd: (characters / 1000) * ELEVENLABS.voicePerThousandCharacters };
    } else if (/^\/v1\/text-to-dialogue/.test(path)) {
      const characters = ((body.inputs as { text?: string }[] | undefined) ?? []).reduce((sum, item) => sum + text(item.text), 0);
      usage = { task: 'voice', model: String(body.model_id ?? 'dialogue'), units: characters, unit: 'caratteri', costUsd: (characters / 1000) * ELEVENLABS.voicePerThousandCharacters };
    } else if (/^\/v1\/music/.test(path)) {
      const sections = (body.composition_plan as { sections?: { duration_ms?: number }[] } | undefined)?.sections ?? [];
      const ms = Number(body.music_length_ms) || sections.reduce((sum, section) => sum + (section.duration_ms ?? 0), 0);
      if (!ms) warn('musica senza durata, costo non calcolato');
      usage = { task: 'music', model: String(body.model_id ?? 'music'), units: ms / 1000, unit: 'secondi', costUsd: ms ? (ms / 60_000) * ELEVENLABS.musicPerMinute : undefined };
    } else if (/^\/v1\/sound-generation/.test(path)) {
      const seconds = Number(body.duration_seconds);
      if (!seconds) warn('effetto senza durata, costo non calcolato');
      usage = { task: 'effect', model: 'sound-generation', units: seconds || undefined, unit: 'secondi', costUsd: seconds ? (seconds / 60) * ELEVENLABS.effectPerMinute : undefined };
    } else if (/^\/v1\/(speech-to-text|forced-alignment)/.test(path)) {
      const words = (response as { words?: { end?: number }[] } | null)?.words ?? [];
      const seconds = words.at(-1)?.end ?? 0;
      usage = { task: 'word-timing', model: path.includes('forced') ? 'forced-alignment' : 'scribe', units: seconds, unit: 'secondi audio', costUsd: (seconds / 3600) * ELEVENLABS.transcriptionPerHour };
    } else if (/^\/v1\/(audio-isolation|speech-to-speech|sound-effects|voice-generation|text-to-voice)/.test(path)) {
      warn(`ElevenLabs ${path} non ha un prezzo nel proxy`);
      usage = { task: 'audio', model: path.split('/')[2] ?? 'elevenlabs' };
    }
    if (!usage) return;
    record({ ...usage, outcome: status >= 400 ? 'error' : 'ok', ...(status >= 400 && { error: `${status}`, costUsd: undefined }), durationMs });
  };

  const account: Record<Service, (exchange: Exchange) => void | Promise<void>> = { gemini, atlas, elevenlabs };

  const handle = async (incoming: IncomingMessage, outgoing: ServerResponse) => {
    const url = new URL(incoming.url ?? '/', 'http://proxy');
    const [, given, name, ...rest] = url.pathname.split('/');
    const service = name as Service;
    if (given !== token || !(service in UPSTREAM) || !keys[service]) {
      outgoing.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Indirizzo o chiave non validi.' }));
      return;
    }
    const upstream = UPSTREAM[service];
    const prefix = `${base}/${service}`;
    const path = `/${rest.join('/')}`;
    url.searchParams.delete('key');

    const headers = new Headers();
    for (const [header, value] of Object.entries(incoming.headers)) {
      if (value === undefined || DROPPED_REQUEST.has(header)) continue;
      headers.set(header, Array.isArray(value) ? value.join(', ') : value);
    }
    const key = keys[service]!;
    if (service === 'gemini') headers.set('x-goog-api-key', key);
    else if (service === 'atlas') headers.set('authorization', `Bearer ${key}`);
    else headers.set('xi-api-key', key);

    const chunks: Buffer[] = [];
    for await (const chunk of incoming) chunks.push(chunk as Buffer);
    let body: Buffer | undefined = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
    // Gli indirizzi del proxy nel corpo (i file di Gemini, per esempio) tornano quelli del servizio.
    const textual = (type: string | null | undefined) => !!type && /json|text|x-www-form-urlencoded/.test(type);
    let request: unknown;
    if (body && textual(incoming.headers['content-type'])) {
      const text = body.toString('utf8').replaceAll(prefix, upstream);
      body = Buffer.from(text, 'utf8');
      request = parseJson(text);
    }

    const start = Date.now();
    let response: Response;
    try {
      response = await fetch(`${upstream}${path}${url.search}`, { method: incoming.method, headers, body });
    } catch (error) {
      outgoing.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: `${service} non risponde: ${String(error)}` }));
      return;
    }
    let payload = Buffer.from(await response.arrayBuffer());
    const durationMs = Date.now() - start;
    const type = response.headers.get('content-type');
    let parsed: unknown;
    if (textual(type) || type?.includes('event-stream')) {
      const text = payload.toString('utf8');
      parsed = type?.includes('event-stream') ? parseEvents(text) : parseJson(text);
      payload = Buffer.from(text.replaceAll(upstream, prefix), 'utf8');
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, header) => {
      if (!DROPPED_RESPONSE.has(header)) responseHeaders[header] = value.replaceAll(upstream, prefix);
    });
    outgoing.writeHead(response.status, responseHeaders).end(payload);

    try {
      await account[service]({ method: incoming.method ?? 'GET', path, request, status: response.status, response: parsed, durationMs });
    } catch (error) {
      warn(`conteggio non riuscito per ${service}${path}: ${String(error)}`);
    }
  };

  const server = createServer((incoming, outgoing) => {
    handle(incoming, outgoing).catch((error: unknown) => {
      warn(String(error));
      if (!outgoing.headersSent) outgoing.writeHead(500).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/${token}`;

  const env: Record<string, string> = {};
  for (const service of Object.keys(UPSTREAM) as Service[]) {
    if (!keys[service]) continue;
    env[`${ENV[service]}_BASE_URL`] = `${base}/${service}`;
    env[`${ENV[service]}_API_KEY`] = token;
  }

  return {
    env,
    // A fine job le clip e le immagini di Atlas che Claude non ha guardato si controllano una volta: se non sono fallite
    // si pagano, perché Atlas le fa comunque.
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await Promise.all(
        [...pending.keys()].map(async (id) => {
          const status = await fetch(`${UPSTREAM.atlas}/api/v1/model/prediction/${id}`, { headers: { authorization: `Bearer ${keys.atlas}` } })
            .then((response) => response.json() as Promise<{ data?: { status?: string; error?: string } }>)
            .then(({ data }) => (data?.status === 'failed' ? { status: 'failed', error: data.error } : { status: 'completed' }))
            .catch(() => ({ status: 'completed' }));
          await atlasDone(id, status.status, (status as { error?: string }).error);
        }),
      );
    },
  };
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  candidatesTokensDetails?: { modality?: string; tokenCount?: number }[];
}

// Una risposta di Gemini è un oggetto, o un elenco di pezzi con streamGenerateContent: i token sono nell'ultimo pezzo.
function geminiUsage(response: unknown): GeminiUsageMetadata | undefined {
  const parts = Array.isArray(response) ? response : [response];
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const metadata = (parts[index] as { usageMetadata?: GeminiUsageMetadata } | null)?.usageMetadata;
    if (metadata) return metadata;
  }
  return undefined;
}

function countImages(response: unknown): number {
  const parts = Array.isArray(response) ? response : [response];
  let images = 0;
  for (const part of parts) {
    for (const candidate of (part as { candidates?: { content?: { parts?: { inlineData?: { mimeType?: string } }[] } }[] } | null)?.candidates ?? []) {
      for (const item of candidate.content?.parts ?? []) if (item.inlineData?.mimeType?.startsWith('image/')) images += 1;
    }
  }
  return images;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function parseEvents(text: string): unknown[] {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => parseJson(line.slice(5).trim()))
    .filter((item) => item !== null);
}
