import { existsSync } from 'node:fs';
import { hostname } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// La configurazione del motore, dalle variabili d'ambiente: il .env nella cartella del motore si carica qui, una volta,
// senza sovrascrivere le variabili già presenti (gli script dei job ricevono l'ambiente dal worker).

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const envFile = path.join(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Le cartelle: le copie di lavoro dei brand e il progetto Remotion di partenza di ogni brand.
export const BRANDS_DIR = path.resolve(process.env.BRANDS_DIR || path.join(ROOT, '../../moonbrand-brands'));
export const VIDEO_KIT = path.join(ROOT, 'video-kit');
export const LAMBDA_ENV_FILE = path.join(ROOT, '.env.lambda');

// Il worker: il suo nome in presenza.brand_workers (ogni brand appartiene a un worker) e quanti lavori insieme.
export const WORKER_ID = process.env.WORKER_ID || hostname();
export const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 2;
export const API_URL = process.env.API_URL || 'http://localhost:3012';

// I modelli, scelti qui e mai lasciati al default dell'SDK (che è il più caro).
export const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
// Il lettore dei passaggi: il nome esatto, perché l'alias «haiku» porta ancora a Haiku 4.5, dieci volte più caro.
export const STEP_MODEL = 'claude-haiku-5-5';
// I saluti del mattino, uno per brand al giorno: basta il modello medio (il nome esatto, l'alias «sonnet» porta a Sonnet 5).
export const LIGHT_MODEL = 'claude-sonnet-5-5';
export const VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-3.8-flash';
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-nano-banana-2.1';
export const IMAGE_PRO_MODEL = process.env.GEMINI_IMAGE_PRO_MODEL || 'gemini-3-pro-image';

// Le chiavi dei servizi restano nel processo del job: Claude vede solo i tool.
export const keys = () => ({ gemini: process.env.GEMINI_API_KEY || null, elevenlabs: process.env.ELEVENLABS_API_KEY || null, atlas: process.env.ATLASCLOUD_API_KEY || null });
// Il tetto in dollari per le clip di un lavoro senza nessuno a cui chiedere (quelli dello studio); nella chat non c'è.
export const CLIP_CAP_USD = Number(process.env.MOONBRAND_CLIP_BUDGET_USD) || 3;

// L'ambiente che si passa a Claude Code: tutto meno le chiavi, il token del job e il DB.
export function agentEnv(): Record<string, string | undefined> {
  const { GEMINI_API_KEY: _gemini, ELEVENLABS_API_KEY: _eleven, ATLASCLOUD_API_KEY: _atlas, MOONBRAND_AGENT_TOKEN: _token, DATABASE_URL: _db, ...rest } = process.env;
  return rest;
}
