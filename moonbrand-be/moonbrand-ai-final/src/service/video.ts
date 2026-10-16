import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { access, cp } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { ensureBrowser } from '@remotion/renderer';

import { ROOT, VIDEO_KIT } from '../config/env';

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// ffmpeg arriva con Remotion (@remotion/renderer), senza installare altro. Va lanciato dalla sua cartella: lì accanto ci
// sono le librerie che gli servono.
export function ffmpeg(): { bin: string; dir: string } {
  const modules = path.join(ROOT, 'node_modules', '@remotion');
  for (const name of readdirSync(modules)) {
    if (!name.startsWith('compositor-')) continue;
    const dir = path.join(modules, name);
    const bin = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    if (existsSync(bin)) return { bin, dir };
  }
  throw new Error('ffmpeg non trovato tra i pacchetti di Remotion');
}

// Il Chrome headless che Remotion scarica una volta per tutti i brand: il render, le grafiche e i comandi di Claude usano
// questo. L'ambiente per i comandi remotion lanciati nel progetto del brand (remotion.config.ts legge REMOTION_BROWSER).
export async function browserEnv(): Promise<Record<string, string>> {
  const browser = await ensureBrowser();
  return browser.type === 'local-puppeteer-browser' || browser.type === 'user-defined-path' ? { REMOTION_BROWSER: browser.path } : {};
}

// Il progetto Remotion del brand, in <brand>/video: al primo video nasce dal kit di partenza, poi è del brand. La
// documentazione di Remotion (video/docs) si rimette se manca. Le dipendenze le installa pnpm dal suo archivio condiviso,
// quindi per ogni brand costano pochi secondi e quasi niente spazio. Restituisce l'ambiente per i comandi remotion.
export async function prepareVideoProject(brandDir: string): Promise<Record<string, string>> {
  const project = path.join(brandDir, 'video');
  if (!(await exists(path.join(project, 'package.json')))) await cp(VIDEO_KIT, project, { recursive: true });
  if (!(await exists(path.join(project, 'docs')))) await cp(path.join(VIDEO_KIT, 'docs'), path.join(project, 'docs'), { recursive: true });
  if (!(await exists(path.join(project, 'node_modules')))) {
    await promisify(execFile)('pnpm', ['install', '--prefer-offline'], { cwd: project, shell: process.platform === 'win32' });
  }
  return browserEnv();
}
