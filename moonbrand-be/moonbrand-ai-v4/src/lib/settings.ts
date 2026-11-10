import type { Pool } from 'pg';

// Percorso relativo e non @moonbrand/shared: questo file lo carica anche l'estensione di Pi (pi/moonbrand.ts), e il loader
// di Pi non legge i paths del tsconfig. Con l'alias Pi usciva con codice 1 senza nemmeno partire.
import { mergeModelSettings, type ModelSettings, type ModelSettingsPatch, type ModelTool, type ThinkingLevel } from '../../../../moonbrand-shared/src/domain/models';

// I modelli e il ragionamento della chat e degli strumenti, scelti dall'admin (sezione Modelli dello studio, tabella
// presenza.settings). Il worker li legge a ogni lavoro e li passa alla chat per variabile d'ambiente; chat.ts e i tool,
// che girano dentro Pi con lo stesso ambiente, li leggono da lì. Sotto ci sono i predefiniti condivisi (domain/models) e,
// per le prove a mano, PI_MODEL, PI_THINKING e TESTI_MODEL dell'ambiente.

const ENV = 'MOONBRAND_MODELLI';
const CACHE_MS = 30_000;

let cached: { at: number; settings: ModelSettings } | undefined;

export async function readModelSettings(pool: Pool): Promise<ModelSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.settings;
  const { rows } = await pool.query<{ value: ModelSettingsPatch }>(`select value from presenza.settings where key = 'models'`);
  const settings = mergeModelSettings(rows[0]?.value);
  cached = { at: Date.now(), settings };
  return settings;
}

export function modelSettingsEnv(settings: ModelSettings): Record<string, string> {
  return { [ENV]: JSON.stringify(settings) };
}

let own: ModelSettings | undefined;

export function modelSettings(env: Record<string, string | undefined> = process.env): ModelSettings {
  if (env === process.env && own) return own;
  const manual: ModelSettingsPatch = {
    chat: { model: env.PI_MODEL, thinking: env.PI_THINKING as ThinkingLevel | undefined },
    tools: { testi: { model: env.TESTI_MODEL } },
  };
  let stored: ModelSettingsPatch | undefined;
  try {
    stored = env[ENV] ? (JSON.parse(env[ENV]) as ModelSettingsPatch) : undefined;
  } catch {
    stored = undefined;
  }
  const settings = mergeModelSettings(stored, mergeModelSettings(manual));
  if (env === process.env) own = settings;
  return settings;
}

export const toolModel = (tool: ModelTool): string => modelSettings().tools[tool].model;
export const toolThinking = (tool: ModelTool): ThinkingLevel | undefined => modelSettings().tools[tool].thinking;
