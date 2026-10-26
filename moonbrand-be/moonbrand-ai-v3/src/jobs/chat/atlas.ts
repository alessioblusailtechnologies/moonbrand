import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { atlasMeasured } from '../../lib/prices';

// Atlas Cloud per i tool della chat: clip, immagini e upscaler. Ogni modello ha i suoi nomi per gli stessi parametri
// (aspect_ratio o ratio, end_image o last_image, sound o generate_audio): li legge dallo schema del modello, così Claude
// passa sempre gli stessi campi.

const API = 'https://api.atlascloud.ai/api/v1';
const POLL_MS = 5_000;
const MAX_WAIT_MS = 15 * 60_000;

export interface AtlasModel {
  model: string;
  type: string;
  displayName: string;
  profile?: string;
  schema?: string;
  categories?: string[];
  price?: { actual?: { base_price?: string } };
}

interface Property {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  description?: string;
}

interface Prediction {
  id?: string;
  status?: string;
  outputs?: string[];
  error?: string | null;
}

// I campi di moonbrand e i nomi che hanno nei modelli, nell'ordine in cui si cercano.
const NAMES = {
  prompt: ['prompt'],
  image: ['image', 'image_url', 'first_frame', 'start_image'],
  images: ['images', 'image_urls', 'reference_images'],
  endImage: ['end_image', 'last_image', 'tail_image', 'last_frame', 'end_frame'],
  video: ['video', 'video_url'],
  duration: ['duration'],
  aspect: ['aspect_ratio', 'ratio'],
  resolution: ['resolution', 'target_resolution'],
  audio: ['generate_audio', 'sound', 'with_audio', 'audio'],
} as const;

export type Fields = Partial<Record<keyof typeof NAMES, unknown>>;

export function atlasClient(apiKey: string, inside: (relative: string) => string) {
  const headers = { authorization: `Bearer ${apiKey}`, 'user-agent': 'curl/8.5.0' };

  const call = async <T>(url: string, body?: unknown): Promise<T> => {
    const response = await fetch(url, {
      method: body ? 'POST' : 'GET',
      headers: { ...headers, 'content-type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(60_000),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`${response.status}: ${raw.slice(0, 500)}`);
    const parsed = JSON.parse(raw) as { data?: T };
    return (parsed.data ?? parsed) as T;
  };

  let catalog: Promise<AtlasModel[]> | undefined;
  const models = () => (catalog ??= call<AtlasModel[]>(`${API}/models`).catch((error: unknown) => ((catalog = undefined), Promise.reject(error))));
  const find = async (model: string) => {
    const found = (await models()).find((item) => item.model === model);
    if (!found) throw new Error(`il modello ${model} non è nel catalogo di Atlas (vedi modelli)`);
    return found;
  };

  const schemas = new Map<string, Promise<{ properties: Record<string, Property>; required: string[] }>>();
  const schema = (found: AtlasModel) => {
    if (!schemas.has(found.model)) {
      schemas.set(
        found.model,
        (found.schema ? fetch(found.schema).then((response) => response.json()) : Promise.resolve({})).then((json: unknown) => {
          // Lo schema è un OpenAPI: le proprietà del corpo stanno nell'oggetto che ha model o prompt.
          const search = (node: unknown): { properties: Record<string, Property>; required?: string[] } | undefined => {
            if (!node || typeof node !== 'object') return undefined;
            const value = node as { properties?: Record<string, Property>; required?: string[] };
            if (value.properties && ('model' in value.properties || 'prompt' in value.properties)) return value as never;
            for (const child of Object.values(node)) {
              const result = search(child);
              if (result) return result;
            }
            return undefined;
          };
          const found = search(json);
          return { properties: found?.properties ?? {}, required: found?.required ?? [] };
        }),
      );
    }
    return schemas.get(found.model)!;
  };

  const upload = async (relative: string) => {
    const form = new FormData();
    form.append('file', new Blob([await readFile(inside(relative))]), path.basename(relative));
    const response = await fetch(`${API}/model/uploadMedia`, { method: 'POST', headers, body: form, signal: AbortSignal.timeout(180_000) });
    const raw = await response.text();
    if (!response.ok) throw new Error(`caricamento di ${relative}: ${response.status} ${raw.slice(0, 300)}`);
    const url = (JSON.parse(raw) as { data?: { download_url?: string } }).data?.download_url;
    if (!url) throw new Error(`caricamento di ${relative}: nessun indirizzo restituito`);
    return url;
  };

  // Il corpo della richiesta: ogni campo va nel nome che il modello usa; i valori fuori dall'elenco del modello si
  // scartano e si dice perché. I file si caricano e al loro posto va l'indirizzo.
  const body = async (found: AtlasModel, fields: Fields, extra: Record<string, unknown> = {}) => {
    const { properties } = await schema(found);
    const known = Object.keys(properties).length > 0;
    const request: Record<string, unknown> = { model: found.model };
    const notes: string[] = [];
    for (const [field, value] of Object.entries(fields) as [keyof typeof NAMES, unknown][]) {
      if (value === undefined) continue;
      const name = NAMES[field].find((candidate) => candidate in properties) ?? (known ? undefined : NAMES[field][0]);
      if (!name) {
        notes.push(`${found.model} non prende ${field}, ignorato`);
        continue;
      }
      let resolved: unknown = value;
      if (field === 'image' || field === 'endImage' || field === 'video') resolved = await upload(String(value));
      else if (field === 'images') resolved = await Promise.all((value as string[]).map(upload));
      const options = properties[name]?.enum;
      if (options && !options.includes(resolved)) {
        const match = options.find((option) => String(option).toLowerCase() === String(resolved).toLowerCase());
        if (match === undefined) {
          notes.push(`${name} ${String(resolved)} non è tra quelli di ${found.model} (${options.join(', ')}), usato il suo predefinito`);
          continue;
        }
        resolved = match;
      }
      request[name] = resolved;
    }
    return { request: { ...request, ...extra }, notes };
  };

  // Il prezzo: quello misurato vince sul catalogo, che per alcuni modelli dà solo il «a partire da». I video si pagano al
  // secondo, il resto a pezzo.
  const cost = (found: AtlasModel, request: Record<string, unknown>, seconds: number) => {
    const measuredPrice = found.type === 'Video' ? atlasMeasured(found.model, typeof request.resolution === 'string' ? request.resolution : undefined) : undefined;
    const base = measuredPrice ?? (Number(found.price?.actual?.base_price) || undefined);
    if (base === undefined) console.warn(`[atlas] ${found.model} senza prezzo nel catalogo`);
    return base === undefined ? undefined : base * (found.type === 'Video' ? seconds : 1);
  };

  const start = async (endpoint: 'generateVideo' | 'generateImage', request: Record<string, unknown>) => {
    const { id } = await call<Prediction>(`${API}/model/${endpoint}`, request);
    if (!id) throw new Error('Atlas non ha restituito il lavoro');
    return id;
  };

  const status = (id: string) => call<Prediction>(`${API}/model/prediction/${id}`);

  // Aspetta il risultato e restituisce gli indirizzi dei file.
  const result = async (id: string): Promise<string[]> => {
    const started = Date.now();
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      const prediction = await status(id).catch(() => null);
      if (prediction?.status === 'failed' || prediction?.status === 'error') throw new Error(prediction.error || 'generazione non riuscita');
      if ((prediction?.status === 'completed' || prediction?.status === 'succeeded') && prediction.outputs?.length) return prediction.outputs;
      if (Date.now() - started > MAX_WAIT_MS) throw new Error('nessun risultato entro 15 minuti');
    }
  };

  return { models, find, schema, body, cost, start, status, result };
}

// La durata di un MP4 o MOV dal box mvhd, senza ffprobe: serve per il prezzo degli upscaler, che vanno al secondo.
export function mp4Seconds(data: Buffer): number | undefined {
  const index = data.indexOf('mvhd');
  if (index < 0) return undefined;
  const version = data[index + 4];
  const scale = version === 1 ? data.readUInt32BE(index + 24) : data.readUInt32BE(index + 16);
  const duration = version === 1 ? Number(data.readBigUInt64BE(index + 28)) : data.readUInt32BE(index + 20);
  return scale > 0 ? duration / scale : undefined;
}
