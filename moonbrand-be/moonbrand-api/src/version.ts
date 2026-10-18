import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { VersionResponse } from '@moonbrand/shared/api/contract';

import { aiDir, type Config } from './config';

// Le versioni per la riga in fondo alle impostazioni dello studio: quella dell'API e dei due motori, dai loro
// package.json, e il commit del repo; lo studio mostra il motore dell'account. Si leggono una volta all'avvio, quindi dicono cosa sta girando adesso.
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

export function readVersions(settings: Pick<Config, 'AI_DIR'>): VersionResponse {
  return {
    api: packageVersion(ROOT),
    engines: { v1: packageVersion(aiDir(settings)), v2: packageVersion(path.join(ROOT, '../moonbrand-ai-v2')) },
    commit: commit(),
  };
}
