import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { VersionResponse } from '@moonbrand/shared/api/contract';

import { aiDir, type Config } from './config';

// Le versioni per la riga in fondo alle impostazioni dello studio: quella dell'API e del motore attivo (AI_ENGINE), dai
// loro package.json, e il commit del repo. Si leggono una volta all'avvio, quindi dicono cosa sta girando adesso.
// Stessa profondità di dist/server.mjs: la cartella dell'API è un livello sopra, in sviluppo e dopo la build.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function packageVersion(dir: string): string | null {
  try {
    return (JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

function commit(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

export function readVersions(settings: Pick<Config, 'AI_ENGINE' | 'AI_DIR' | 'AI_WORKER_DIR'>): VersionResponse {
  const v2 = settings.AI_ENGINE === 'v2';
  const engineDir = settings.AI_WORKER_DIR ? path.resolve(settings.AI_WORKER_DIR) : v2 ? path.join(ROOT, '../moonbrand-ai-v2') : aiDir(settings);
  const name = /moonbrand-ai-(vd+)$/.exec(engineDir)?.[1] ?? (v2 ? 'v2' : 'v1');
  return { api: packageVersion(ROOT), engine: { name, version: packageVersion(engineDir) }, commit: commit() };
}
