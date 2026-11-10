import { spawn } from 'node:child_process';

import { GoogleGenAI } from '@google/genai';
import { getSupportedThinkingLevels, type Api, type Model } from '@earendil-works/pi-ai';
import { getBuiltinModel } from '@earendil-works/pi-ai/providers/all';
import type { Pool } from 'pg';

import type { CatalogModel, ModelCatalog, ModelTool } from '@moonbrand/shared/domain/models';

import type { AtlasModel } from '../jobs/chat/atlas';
import { piCli } from './pi-cli';
import { openRouter } from './prices';

// Il catalogo dei modelli tra cui l'admin sceglie nella sezione Modelli dello studio (domain/models): lo scrive il worker in
// presenza.settings (chiave models.catalog) all'avvio e poi ogni ora, dalle fonti a runtime, senza elenchi nostri.
// - chat: la lista di Pi (pi --list-models), cioè i modelli dei fornitori con una chiave configurata, con il flag del ragionamento.
// - testi, vista, ricerca: i modelli Google che fanno generateContent e che OpenRouter dà con uscita solo testo (la vista
//   vuole anche le immagini in ingresso); il ragionamento dal flag thinking di Google.
// - immagini: i modelli Google con uscita immagine, più i modelli Image di Atlas da testo o da immagine.
// - clip: i modelli Video di Atlas, da testo (TEXT-TO-VIDEO) per le righe da testo e da immagine (IMAGE-TO-VIDEO) per le altre.
// - voce: i modelli ElevenLabs che fanno text-to-speech.
// - musica: i modelli Suno di Atlas, perché genera_musica e genera_canzone parlano il formato di Suno.
// Se una fonte non risponde, per la sua parte resta l'ultimo catalogo scritto.

const KEY = 'models.catalog';
export const CATALOG_MS = 60 * 60_000;
const ATLAS_API = 'https://api.atlascloud.ai/api/v1';
const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const TIMEOUT_MS = 60_000;

export interface CatalogKeys {
  gemini?: string;
  atlas?: string;
  elevenlabs?: string;
}

type Part = 'chat' | ModelTool;

const byId = (a: CatalogModel, b: CatalogModel) => a.id.localeCompare(b.id);

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (err = (err + chunk.toString()).slice(-500)));
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(`codice ${code}: ${err.trim()}`));
    });
  });
}

// pi --list-models stampa una tabella: provider, model, context, max-out, thinking (yes/no), images, con le colonne separate da
// almeno due spazi. Non dice quali livelli di ragionamento il modello accetta: quelli vengono dal catalogo statico di Pi
// (getBuiltinModel + getSupportedThinkingLevels), lo stesso che Pi usa per /thinking. Per i modelli non nel catalogo statico
// (es. quelli di models.json) restano assenti e la tendina mostra la lista intera.
const builtinModel = getBuiltinModel as unknown as (provider: string, id: string) => Model<Api> | undefined;

async function piModels(): Promise<CatalogModel[]> {
  const output = await run(process.execPath, [piCli(), '--list-models']);
  return output
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s{2,}/))
    .filter((columns) => columns.length >= 5 && columns[0] !== 'provider')
    .map(([provider, model, , , thinking]) => {
      const builtin = builtinModel(provider!, model!);
      const thinkingLevels = builtin ? getSupportedThinkingLevels(builtin) : undefined;
      return {
        id: `${provider}/${model}`,
        thinking: thinking === 'yes',
        ...(thinkingLevels && { thinkingLevels }),
        source: provider!,
      };
    })
    .sort(byId);
}

async function json<T>(url: string, headers: Record<string, string>): Promise<T> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()) as T;
}

interface GoogleParts {
  text: CatalogModel[];
  vision: CatalogModel[];
  image: CatalogModel[];
}

// Google dice quali modelli ci sono con la nostra chiave e se ragionano, ma non cosa producono: le modalità vengono da
// OpenRouter, con il nome esatto (google/<modello>). Un modello che OpenRouter non ha, o che produce altro (video, audio,
// parlato), resta fuori.
async function googleModels(apiKey: string): Promise<GoogleParts> {
  const ai = new GoogleGenAI({ apiKey });
  const router = await openRouter();
  if (!router) throw new Error('listino di OpenRouter non disponibile');
  const parts: GoogleParts = { text: [], vision: [], image: [] };
  for await (const model of await ai.models.list({ config: { pageSize: 200 } })) {
    if (!model.name || !model.supportedActions?.includes('generateContent')) continue;
    const id = model.name.replace(/^models\//, '');
    const architecture = router.find((entry) => entry.id === `google/${id}`)?.architecture;
    if (!architecture?.output_modalities) continue;
    const thinking = (model as { thinking?: boolean }).thinking === true;
    const item: CatalogModel = { id, ...(model.displayName && { label: model.displayName }), thinking, source: 'Gemini' };
    const out = architecture.output_modalities;
    if (out.includes('image')) parts.image.push(item);
    else if (out.length === 1 && out[0] === 'text') {
      parts.text.push(item);
      if (architecture.input_modalities?.includes('image')) parts.vision.push(item);
    }
  }
  for (const list of Object.values(parts)) list.sort(byId);
  return parts;
}

interface AtlasParts {
  image: CatalogModel[];
  clipText: CatalogModel[];
  clipImage: CatalogModel[];
  music: CatalogModel[];
}

async function atlasModels(apiKey: string): Promise<AtlasParts> {
  const parsed = await json<{ data?: AtlasModel[] } | AtlasModel[]>(`${ATLAS_API}/models`, { authorization: `Bearer ${apiKey}`, 'user-agent': 'curl/8.5.0' });
  const models = Array.isArray(parsed) ? parsed : (parsed.data ?? []);
  const item = (model: AtlasModel): CatalogModel => ({ id: model.model, ...(model.displayName && { label: model.displayName }), source: 'Atlas' });
  const of = (type: string, ...categories: string[]) =>
    models
      .filter((model) => model.type === type && (model.categories ?? []).some((category) => categories.includes(category)))
      .map(item)
      .sort(byId);
  const music = models
    .filter((model) => model.type === 'Audio' && model.model.startsWith('suno/'))
    .map(item)
    .sort(byId);
  return { image: of('Image', 'TEXT-TO-IMAGE', 'IMAGE-TO-IMAGE'), clipText: of('Video', 'TEXT-TO-VIDEO'), clipImage: of('Video', 'IMAGE-TO-VIDEO'), music };
}

async function elevenLabsModels(apiKey: string): Promise<CatalogModel[]> {
  const models = await json<{ model_id: string; name?: string; can_do_text_to_speech?: boolean }[]>(`${ELEVENLABS_API}/models`, { 'xi-api-key': apiKey });
  return models
    .filter((model) => model.can_do_text_to_speech)
    .map((model) => ({ id: model.model_id, ...(model.name && { label: model.name }), source: 'ElevenLabs' }))
    .sort(byId);
}

// Ogni fonte per conto suo: quella che fallisce lascia undefined, e le sue parti restano come erano.
async function attempt<T>(name: string, work: () => Promise<T>): Promise<T | undefined> {
  try {
    return await work();
  } catch (error) {
    console.warn(`[catalogo] ${name} non letto: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

export async function buildCatalog(keys: CatalogKeys, previous?: ModelCatalog | null): Promise<ModelCatalog> {
  const [pi, google, atlas, eleven] = await Promise.all([
    attempt('Pi', piModels),
    keys.gemini ? attempt('Google', () => googleModels(keys.gemini!)) : undefined,
    keys.atlas ? attempt('Atlas', () => atlasModels(keys.atlas!)) : undefined,
    keys.elevenlabs ? attempt('ElevenLabs', () => elevenLabsModels(keys.elevenlabs!)) : undefined,
  ]);
  const keep = (part: Part): CatalogModel[] => (part === 'chat' ? previous?.chat : previous?.tools[part]) ?? [];
  // Le immagini vengono da due fonti: della fonte che manca resta la parte di prima.
  const kept = (source: string) => keep('immagini').filter((model) => model.source === source);
  return {
    chat: pi ?? keep('chat'),
    tools: {
      testi: google?.text ?? keep('testi'),
      vista: google?.vision ?? keep('vista'),
      ricerca: google?.text ?? keep('ricerca'),
      immagini: [...(google?.image ?? kept('Gemini')), ...(atlas?.image ?? kept('Atlas'))],
      clip_persone: atlas?.clipText ?? keep('clip_persone'),
      clip_persone_img: atlas?.clipImage ?? keep('clip_persone_img'),
      clip_altro: atlas?.clipText ?? keep('clip_altro'),
      clip_altro_img: atlas?.clipImage ?? keep('clip_altro_img'),
      voce: eleven ?? keep('voce'),
      musica: atlas?.music ?? keep('musica'),
    },
  };
}

export async function refreshCatalog(pool: Pool, keys: CatalogKeys): Promise<void> {
  try {
    const { rows } = await pool.query<{ value: ModelCatalog }>(`select value from presenza.settings where key = $1`, [KEY]);
    const catalog = await buildCatalog(keys, rows[0]?.value);
    await pool.query(
      `insert into presenza.settings (key, value, updated_at, updated_by) values ($1, $2, now(), null)
       on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = null`,
      [KEY, JSON.stringify(catalog)],
    );
    const counts = [`chat ${catalog.chat.length}`, ...Object.entries(catalog.tools).map(([tool, list]) => `${tool} ${list.length}`)];
    console.log(`[catalogo] modelli scritti: ${counts.join(', ')}`);
  } catch (error) {
    console.error('[catalogo] non scritto', error);
  }
}
