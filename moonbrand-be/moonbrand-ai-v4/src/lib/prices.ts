import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// I prezzi con cui i tool della chat (jobs/chat) dicono quanto è costata una chiamata: nessuna risposta dei fornitori
// porta i dollari, e noi non teniamo listini. Ogni prezzo si prende a runtime da chi lo sa:
// - modelli di testo e di immagini (Gemini) e la ricerca Google: il listino pubblico di OpenRouter
//   (openrouter.ai/api/v1/models, senza chiave), che ha anche i token immagine in uscita e il prezzo a query della
//   ricerca. In cache su disco un giorno; se non si raggiunge vale la cache vecchia, e senza cache il listino di Pi,
//   che ha solo i modelli di testo;
// - Atlas: il prezzo che Atlas addebita a lavoro finito (jobs/chat/atlas.ts); la stima prima di partire dalle misure
//   nostre in ai_usage (measuredPrice, MOONBRAND_PREZZI dal worker) o dal catalogo di Atlas;
// - ElevenLabs: i crediti addebitati nell'header della risposta e il prezzo del credito dall'uso fatturato (jobs/chat/audio.ts);
// - Lambda: la stima di Remotion.
// La chat di Pi (Opus) la prezza Pi con il suo listino, che si aggiorna con Pi.

// Dollari per milione di token; webSearch per query.
export interface ModelPrice {
  input: number;
  output: number;
  imageOutput?: number;
  cacheRead?: number;
  cacheWrite?: number;
  webSearch?: number;
}

export type TextPrice = Pick<ModelPrice, 'input' | 'output' | 'cacheRead'>;

// Il listino di Pi, registrato dall'estensione (pi/moonbrand.ts): la riserva quando OpenRouter non c'è.
let piPrice: (model: string) => TextPrice | undefined = () => undefined;
export function useTextPrices(lookup: (model: string) => TextPrice | undefined) {
  piPrice = lookup;
}

const OPENROUTER = 'https://openrouter.ai/api/v1/models';
// Il nome della cache cambia quando cambia cosa si tiene di ogni modello (v2: anche le modalità).
const CACHE_FILE = path.join(os.tmpdir(), 'moonbrand', 'listino-openrouter-v2.json');
// Un'ora, come il giro del catalogo dei modelli (lib/catalog.ts): un modello nuovo arriva nella sezione Modelli entro l'ora.
const CACHE_MS = 60 * 60_000;

export interface OpenRouterModel {
  id: string;
  pricing?: Record<string, string | undefined>;
  // Cosa entra e cosa esce (text, image, video, audio, file): dice a cosa serve un modello, per il catalogo (lib/catalog.ts).
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

let listing: Promise<OpenRouterModel[] | undefined> | undefined;
let listingAt = 0;

// La lista di OpenRouter: dalla cache se ha meno di CACHE_MS, altrimenti dalla rete (e si salva); se la rete non risponde,
// la cache anche vecchia. In memoria la si tiene per CACHE_MS, poi si rilegge: il worker resta acceso per giorni.
export function openRouter(): Promise<OpenRouterModel[] | undefined> {
  if (Date.now() - listingAt >= CACHE_MS) {
    listing = undefined;
    listingAt = Date.now();
  }
  return (listing ??= (async () => {
    const cached = async () => JSON.parse(await readFile(CACHE_FILE, 'utf8')) as OpenRouterModel[];
    const age = await stat(CACHE_FILE).then((info) => Date.now() - info.mtimeMs).catch(() => Infinity);
    if (age < CACHE_MS) return cached().catch(() => undefined);
    try {
      const response = await fetch(OPENROUTER, { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error(`${response.status}`);
      const { data } = (await response.json()) as { data: OpenRouterModel[] };
      const models = data.map(({ id, pricing, architecture }) => ({
        id,
        pricing,
        ...(architecture && { architecture: { input_modalities: architecture.input_modalities, output_modalities: architecture.output_modalities } }),
      }));
      await mkdir(path.dirname(CACHE_FILE), { recursive: true });
      await writeFile(CACHE_FILE, JSON.stringify(models));
      return models;
    } catch (error) {
      console.warn(`[prezzi] listino di OpenRouter non raggiunto (${error instanceof Error ? error.message : String(error)})`);
      return cached().catch(() => undefined);
    }
  })());
}

// OpenRouter dà i prezzi per token, in stringhe.
const perMillion = (value: string | undefined) => (value === undefined ? undefined : Number(value) * 1_000_000);

function fromOpenRouter(entry: OpenRouterModel): ModelPrice | undefined {
  const pricing = entry.pricing ?? {};
  const input = perMillion(pricing.prompt);
  const output = perMillion(pricing.completion);
  if (input === undefined || output === undefined || !Number.isFinite(input) || !Number.isFinite(output)) return undefined;
  const webSearch = pricing.web_search === undefined ? undefined : Number(pricing.web_search);
  return {
    input,
    output,
    imageOutput: perMillion(pricing.image_output),
    cacheRead: perMillion(pricing.input_cache_read),
    cacheWrite: perMillion(pricing.input_cache_write),
    ...(webSearch !== undefined && Number.isFinite(webSearch) && { webSearch }),
  };
}

// Il modello si cerca con il suo nome sotto il fornitore (google/gemini-3.8-flash); se manca, senza i suffissi preview e
// latest, poi il nome più lungo del fornitore che fa da inizio (gemini-3-pro-image-preview-2 è gemini-3-pro-image).
function findModel(models: OpenRouterModel[], provider: string, model: string): OpenRouterModel | undefined {
  const own = models.filter((entry) => entry.id.startsWith(`${provider}/`) && !entry.id.includes(':'));
  const names = [model, model.replace(/-(preview|latest)(-[\w.]+)?$/, '')];
  for (const name of names) {
    const exact = own.find((entry) => entry.id === `${provider}/${name}`);
    if (exact) return exact;
  }
  return own
    .filter((entry) => model.startsWith(entry.id.slice(provider.length + 1)))
    .sort((a, b) => b.id.length - a.id.length)[0];
}

const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

// Il prezzo di un modello, da OpenRouter o, in riserva, dal listino di Pi (solo testo). undefined se nessuno lo conosce.
export async function modelPrice(model: string, provider = 'google'): Promise<ModelPrice | undefined> {
  const models = await openRouter();
  const found = models && findModel(models, provider, model);
  const price = found && fromOpenRouter(found);
  if (price) return price;
  const fallback = piPrice(model);
  if (fallback) {
    warnOnce(`pi:${model}`, `[prezzi] ${model} prezzato con il listino di Pi (OpenRouter non lo ha)`);
    return fallback;
  }
  warnOnce(`none:${model}`, `[prezzi] ${model} senza prezzo: il costo resta non noto`);
  return undefined;
}

// Il costo di una chiamata a Gemini dai token della risposta: il ragionamento si paga come il testo in uscita, i token
// immagine al loro prezzo (se il listino non lo ha, il costo resta non noto invece di uscire basso), i token letti dalla
// cache al prezzo della cache.
export async function geminiCost(model: string, tokens: { input: number; output: number; image: number; cached?: number }): Promise<number | undefined> {
  const price = await modelPrice(model);
  if (!price) return undefined;
  if (tokens.image > 0 && price.imageOutput === undefined) {
    warnOnce(`image:${model}`, `[prezzi] ${model} senza prezzo dei token immagine: il costo resta non noto`);
    return undefined;
  }
  const cached = tokens.cached ?? 0;
  return (
    ((tokens.input - cached) * price.input + cached * (price.cacheRead ?? price.input) + tokens.output * price.output + tokens.image * (price.imageOutput ?? 0)) /
    1_000_000
  );
}

// Le misure nostre: quanto è costata per unità ogni generazione negli ultimi giorni (ai_usage), dal worker per variabile
// d'ambiente (lib/estimate.ts). Servono alla stima detta prima di partire e ai crediti che la chat dice all'utente.
export interface MeasuredPrice {
  unit: string;
  usdPerUnit: number;
  samples: number;
}

export interface MeasuredPrices {
  // Per modello (un modello di Atlas, un modello di Gemini).
  models: Record<string, MeasuredPrice>;
  // Per tipo di lavoro (image, clip, music, voice...), qualunque modello.
  tasks: Record<string, MeasuredPrice>;
}

const PRICES_ENV = 'MOONBRAND_PREZZI';

export function measuredPricesEnv(prices: MeasuredPrices): Record<string, string> {
  return { [PRICES_ENV]: JSON.stringify(prices) };
}

export function measuredPrices(env: Record<string, string | undefined> = process.env): MeasuredPrices {
  try {
    const parsed = JSON.parse(env[PRICES_ENV] ?? '') as MeasuredPrices;
    if (parsed.models && parsed.tasks) return parsed;
  } catch {
    // senza misure
  }
  return { models: {}, tasks: {} };
}

// Il prezzo misurato di un modello: dall'inizio del nome, perché il catalogo di Atlas ha un modello per modo
// (kwaivgi/kling-v4.0/image-to-video e text-to-video costano uguale).
export function measuredPrice(model: string, env?: Record<string, string | undefined>): MeasuredPrice | undefined {
  const { models } = measuredPrices(env);
  if (models[model]) return models[model];
  const prefix = Object.keys(models)
    .filter((key) => model.startsWith(key) || key.startsWith(model))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? models[prefix] : undefined;
}
