import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// Il cli.js di Pi installato globalmente (npm i -g @earendil-works/pi-coding-agent), per la chat e per il catalogo dei
// modelli. PI_CLI se c'è; altrimenti la cartella dei pacchetti globali di npm: su Windows in %APPDATA%\npm, su Linux in
// <prefisso di node>/lib/node_modules; come ultima strada `npm root -g`, che chiede a npm dove sono.
const PACKAGE = path.join('@earendil-works', 'pi-coding-agent', 'dist', 'cli.js');

function globalRoots(): string[] {
  if (process.platform === 'win32') return [path.join(process.env.APPDATA ?? '', 'npm', 'node_modules')];
  return [path.join(path.dirname(path.dirname(process.execPath)), 'lib', 'node_modules')];
}

function npmRoot(): string | null {
  try {
    return execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['root', '-g'], { encoding: 'utf8', shell: process.platform === 'win32' }).trim() || null;
  } catch {
    return null;
  }
}

export function piCli(): string {
  if (process.env.PI_CLI) return process.env.PI_CLI;
  const found = globalRoots()
    .map((root) => path.join(root, PACKAGE))
    .find((file) => existsSync(file));
  if (found) return found;
  const root = npmRoot();
  if (root && existsSync(path.join(root, PACKAGE))) return path.join(root, PACKAGE);
  throw new Error('Pi non trovato: installalo con npm i -g @earendil-works/pi-coding-agent oppure metti PI_CLI nel .env');
}
