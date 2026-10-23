import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type Anthropic from '@anthropic-ai/sdk';

// Gli strumenti di lavoro della chat, eseguiti qui: la shell (lo strumento bash di Anthropic) e l'editor dei file
// (str_replace_based_edit_tool). Al posto di quelli di Claude Code, con due differenze volute: un comando che smette di
// lavorare si ferma dopo pochi minuti invece di tenere ferma la chat fino al limite, e i file sono solo quelli del brand.

type ToolContent = Anthropic.Beta.BetaToolResultBlockParam['content'];
export interface ToolOutcome {
  content: ToolContent;
  isError?: boolean;
}

const IDLE_MS = 3 * 60_000;
const MAX_MS = 30 * 60_000;
const CHECK_MS = 10_000;
const MAX_OUTPUT = 30_000;
const IMAGE_TYPES: Record<string, 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};
const MAX_IMAGE_BYTES = 3_750_000;
const MAX_VIEW = 60_000;
const SKIPPED = new Set(['node_modules', '.git']);

// Su Windows (il collaudo) la shell è quella di Git; su Linux quella del sistema.
const BASH = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/bash';

// Il file scritto più di recente sotto le cartelle di lavoro: un comando che scrive file sta lavorando anche se tace.
function lastWrite(dirs: string[]): number {
  let latest = 0;
  const visit = (dir: string, depth: number) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (SKIPPED.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (depth < 6) visit(full, depth + 1);
        continue;
      }
      try {
        latest = Math.max(latest, statSync(full).mtimeMs);
      } catch {
        // file appena tolto
      }
    }
  };
  for (const dir of dirs) visit(dir, 0);
  return latest;
}

function killTree(child: ChildProcess) {
  if (!child.pid) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore' });
  else {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

// Testa e coda di un output lungo: l'errore di solito sta in fondo.
function clip(text: string): string {
  if (text.length <= MAX_OUTPUT) return text;
  return `${text.slice(0, 8_000)}\n[… tagliate ${text.length - MAX_OUTPUT} lettere …]\n${text.slice(-(MAX_OUTPUT - 8_000))}`;
}

export class Shell {
  private running = new Set<ChildProcess>();

  constructor(
    private root: string,
    private env: Record<string, string | undefined>,
  ) {}

  stop() {
    for (const child of this.running) killTree(child);
  }

  // Ogni comando parte dalla cartella del brand, in una shell nuova.
  run(command: string, signal: AbortSignal): Promise<ToolOutcome> {
    return new Promise((resolve) => {
      const started = Date.now();
      const child = spawn(BASH, ['-c', command], { cwd: this.root, env: this.env, detached: process.platform !== 'win32', windowsHide: true });
      this.running.add(child);
      let output = '';
      let lastOutput = started;
      let stopped: string | undefined;
      const onData = (chunk: Buffer) => {
        output += chunk.toString();
        if (output.length > 4 * MAX_OUTPUT) output = output.slice(0, MAX_OUTPUT) + output.slice(-2 * MAX_OUTPUT);
        lastOutput = Date.now();
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      const watched = ['lavoro', 'contenuti'].map((dir) => path.join(this.root, dir)).filter((dir) => existsSync(dir));
      const timer = setInterval(() => {
        const now = Date.now();
        if (now - started > MAX_MS) stopped = `Comando fermato dopo ${MAX_MS / 60_000} minuti, il massimo.`;
        else if (now - Math.max(lastOutput, lastWrite(watched)) > IDLE_MS)
          stopped = `Comando fermato: da ${IDLE_MS / 60_000} minuti non stampava niente e non scriveva file, quindi era bloccato. Se deve davvero lavorare a lungo, fallo stampare l'avanzamento.`;
        if (stopped) killTree(child);
      }, CHECK_MS);
      const abort = () => {
        stopped = 'Comando fermato: la chat è stata interrotta.';
        killTree(child);
      };
      signal.addEventListener('abort', abort, { once: true });
      child.on('error', (error) => {
        output += `\n${error.message}`;
      });
      child.on('close', (code) => {
        clearInterval(timer);
        signal.removeEventListener('abort', abort);
        this.running.delete(child);
        const text = [clip(output.trim()), stopped, code && !stopped ? `(uscito con codice ${code})` : ''].filter(Boolean).join('\n');
        resolve({ content: text || '(nessun output)', ...((code !== 0 || stopped) && { isError: true }) });
      });
    });
  }
}

export interface EditorInput {
  command: 'view' | 'create' | 'str_replace' | 'insert';
  path: string;
  view_range?: [number, number];
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  insert_text?: string;
}

// L'editor lavora solo dentro la cartella del brand; i percorsi possono essere relativi a quella o assoluti.
export class Editor {
  constructor(private root: string) {}

  private resolve(target: string): string {
    const full = path.resolve(this.root, target);
    const relative = path.relative(this.root, full);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${target} è fuori dalla cartella del brand.`);
    return full;
  }

  async run(input: EditorInput): Promise<ToolOutcome> {
    try {
      const full = this.resolve(input.path);
      switch (input.command) {
        case 'view':
          return await this.view(full, input.view_range);
        case 'create':
          await mkdir(path.dirname(full), { recursive: true });
          await writeFile(full, input.file_text ?? '');
          return { content: `Scritto ${input.path}.` };
        case 'str_replace': {
          const text = await readFile(full, 'utf8');
          const old = input.old_str ?? '';
          const count = old ? text.split(old).length - 1 : 0;
          if (count !== 1) return { content: count === 0 ? 'Il testo da sostituire non c’è nel file.' : `Il testo da sostituire c’è ${count} volte: allargalo finché è unico.`, isError: true };
          await writeFile(full, text.replace(old, () => input.new_str ?? ''));
          return { content: `Modificato ${input.path}.` };
        }
        case 'insert': {
          const lines = (await readFile(full, 'utf8')).split('\n');
          const at = input.insert_line ?? 0;
          if (at < 0 || at > lines.length) return { content: `Riga ${at} fuori dal file (${lines.length} righe).`, isError: true };
          lines.splice(at, 0, ...(input.insert_text ?? '').split('\n'));
          await writeFile(full, lines.join('\n'));
          return { content: `Inserito in ${input.path} dopo la riga ${at}.` };
        }
        default:
          return { content: `Comando ${String((input as { command: unknown }).command)} non previsto.`, isError: true };
      }
    } catch (error) {
      return { content: error instanceof Error ? error.message : String(error), isError: true };
    }
  }

  private async view(full: string, range?: [number, number]): Promise<ToolOutcome> {
    const info = await stat(full);
    if (info.isDirectory()) return { content: await this.listing(full) };
    const imageType = IMAGE_TYPES[path.extname(full).toLowerCase()];
    if (imageType) {
      if (info.size > MAX_IMAGE_BYTES) return { content: `L'immagine pesa ${(info.size / 1e6).toFixed(1)} MB, troppo per guardarla: fanne una copia più piccola (per esempio con ffmpeg) e guarda quella.`, isError: true };
      return { content: [{ type: 'image', source: { type: 'base64', media_type: imageType, data: (await readFile(full)).toString('base64') } }] };
    }
    const lines = (await readFile(full, 'utf8')).split('\n');
    const [from, to] = range ? [Math.max(1, range[0]), range[1] === -1 ? lines.length : Math.min(lines.length, range[1])] : [1, lines.length];
    let text = lines
      .slice(from - 1, to)
      .map((line, index) => `${String(from + index).padStart(6)}\t${line}`)
      .join('\n');
    if (text.length > MAX_VIEW) text = `${text.slice(0, MAX_VIEW)}\n[… file lungo: leggi il resto con view_range …]`;
    return { content: text };
  }

  // Due livelli, senza node_modules e file nascosti.
  private async listing(dir: string): Promise<string> {
    const out: string[] = [];
    const visit = async (current: string, depth: number) => {
      const entries = (await readdir(current, { withFileTypes: true })).filter((entry) => !entry.name.startsWith('.') && !SKIPPED.has(entry.name));
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(current, entry.name);
        out.push(`${'  '.repeat(depth)}${entry.name}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory() && depth < 1) await visit(full, depth + 1);
        if (out.length > 400) return;
      }
    };
    await visit(dir, 0);
    return out.join('\n') || '(cartella vuota)';
  }
}
