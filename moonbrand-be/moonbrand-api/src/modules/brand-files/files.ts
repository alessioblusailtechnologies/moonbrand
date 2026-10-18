import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, type ReadStream } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type pg from 'pg';

import type { AiEngine } from '@moonbrand/shared/api/contract';

import { brandsDir, type Config } from '../../config';
import { ApiError } from '../../errors';

export const REFERENCES_DIR = 'file-riferimento';
// Con il motore v2 i riferimenti caricati vanno direttamente in riferimenti/, la cartella che quel motore legge.
const V2_REFERENCES_DIR = 'riferimenti';
export const referencesDir = (engine: AiEngine): string => (engine === 'v2' ? V2_REFERENCES_DIR : REFERENCES_DIR);
// Un riferimento caricato, in una cartella o nell'altra: i brand nati prima restano in file-riferimento/.
export const isReference = (path: string): boolean => path.startsWith(`${REFERENCES_DIR}/`) || path.startsWith(`${V2_REFERENCES_DIR}/`);
export const FOLLOW_DIR = 'riferimenti-da-seguire';
// Gli esempi dell'onboarding, una cartella per generazione; LEGACY_WORK_DIR è dove finivano i file di lavoro prima.
export const EXAMPLES_DIR = 'esempi';
export const LEGACY_WORK_DIR = 'lavoro';
// Le foto allegate ai messaggi della chat.
export const ATTACHMENTS_DIR = 'allegati';

// Chi ha aperto la cartella di un brand non ancora creato: il brand nasce
// nella bozza dell'onboarding e sul DB arriva solo alla fine.
export const OWNER_FILE = '.account';

// Una cartella e uno o più livelli sotto; nessun segmento inizia col punto, quindi niente "..".
export const RELATIVE_PATH = /^[a-z0-9-]+(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/;
// Una cartella al primo livello del brand.
export const DIR_NAME = /^[a-z0-9-]+$/;

export const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.pdf': 'application/pdf',
};

// Un file da mandare a pezzi: i video si scorrono chiedendo solo la parte che serve (Range).
export interface OpenFile {
  size: number;
  contentType: string;
  stream(start: number, end: number): ReadStream;
}

export interface BrandFiles {
  claim(brandId: string, accountId: string): Promise<void>;
  save(brandId: string, relativePath: string, bytes: Uint8Array): Promise<void>;
  // Un file già su disco (per esempio uscito da ffmpeg), senza tenerlo in memoria.
  saveFile(brandId: string, relativePath: string, localFile: string): Promise<void>;
  read(brandId: string, relativePath: string): Promise<Buffer>;
  remove(brandId: string, relativePath: string): Promise<void>;
  removeDir(brandId: string, dir: string): Promise<void>;
  // I file di una cartella del brand (solo il primo livello), come percorsi relativi in ordine di nome; vuota se non c'è.
  list(brandId: string, dir: string): Promise<string[]>;
  copy(brandId: string, from: string, to: string): Promise<void>;
  // Il file da mandare dall'API, oppure, se i file stanno su uno storage, un link temporaneo dove scaricarlo.
  open(brandId: string, relativePath: string): Promise<OpenFile | { redirect: string }>;
  url(brandId: string, relativePath: string): string;
  verify(brandId: string, relativePath: string, signature: string): boolean;
  // La sessione di Claude Code di un lavoro del brand (il .jsonl), per l'admin; null se non c'è.
  session(brandId: string, sessionId: string): Promise<string | null>;
  // Quello che Claude legge del brand oltre al codice, per l'admin: il CLAUDE.md dell'ultimo lavoro e la memoria che
  // Claude Code si scrive da solo (memory/ accanto alle sessioni), in ordine di nome.
  promptFiles(brandId: string): Promise<{ guide: string | null; memory: { name: string; text: string }[] }>;
}

export const SESSION_ID = /^[0-9a-f-]{36}$/;

// I file dei brand sul disco di questa macchina: per lo sviluppo, o con API e worker sulla stessa macchina.
export function localBrandFiles(
  pool: pg.Pool,
  config: Pick<Config, 'BRANDS_DIR' | 'FILES_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY' | 'CLAUDE_CONFIG_DIR'>,
): BrandFiles {
  const root = brandsDir(config);
  const secret = config.FILES_SECRET ?? config.SUPABASE_SERVICE_ROLE_KEY;

  const brandDir = (brandId: string) => path.join(root, brandId);
  // Dove Claude Code tiene sessioni e memoria del brand sulla macchina del worker: il percorso della cartella del brand
  // con ogni carattere che non è una lettera o una cifra cambiato in «-» (come sessionsDir di moonbrand-ai).
  const sessionsDir = (brandId: string) =>
    path.join(config.CLAUDE_CONFIG_DIR ?? path.join(homedir(), '.claude'), 'projects', path.resolve(brandDir(brandId)).replace(/[^a-zA-Z0-9]/g, '-'));
  const filePath = (brandId: string, relativePath: string) => {
    if (!RELATIVE_PATH.test(relativePath)) throw ApiError.invalid('Percorso del file non valido.');
    return path.join(brandDir(brandId), relativePath);
  };
  const { url, verify } = fileLinks(secret);

  return {
    async claim(brandId, accountId) {
      const { rows } = await pool.query<{ account_id: string }>('select account_id from presenza.brands where id = $1', [brandId]);
      if (rows[0]) {
        if (rows[0].account_id !== accountId) throw ApiError.forbidden('NOT_YOUR_BRAND', 'Questo brand non è tuo.');
        return;
      }
      const marker = path.join(brandDir(brandId), OWNER_FILE);
      const owner = await readFile(marker, 'utf8').catch(() => null);
      if (owner === null) {
        await mkdir(brandDir(brandId), { recursive: true });
        await writeFile(marker, accountId);
      } else if (owner.trim() !== accountId) {
        throw ApiError.forbidden('NOT_YOUR_BRAND', 'Questo brand non è tuo.');
      }
    },
    async save(brandId, relativePath, bytes) {
      const target = filePath(brandId, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    },
    async saveFile(brandId, relativePath, localFile) {
      const target = filePath(brandId, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(localFile, target);
    },
    async read(brandId, relativePath) {
      return readFile(filePath(brandId, relativePath));
    },
    async remove(brandId, relativePath) {
      await rm(filePath(brandId, relativePath), { force: true });
    },
    async removeDir(brandId, dir) {
      if (!DIR_NAME.test(dir)) throw ApiError.invalid('Cartella non valida.');
      await rm(path.join(brandDir(brandId), dir), { recursive: true, force: true });
    },
    async list(brandId, dir) {
      if (!DIR_NAME.test(dir)) throw ApiError.invalid('Cartella non valida.');
      const entries = await readdir(path.join(brandDir(brandId), dir), { withFileTypes: true }).catch(() => []);
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => `${dir}/${entry.name}`)
        .sort();
    },
    async copy(brandId, from, to) {
      const target = filePath(brandId, to);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(filePath(brandId, from), target);
    },
    async open(brandId, relativePath) {
      const target = filePath(brandId, relativePath);
      const info = await stat(target).catch(() => null);
      if (!info?.isFile()) throw ApiError.notFound('File non trovato.');
      return {
        size: info.size,
        contentType: CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream',
        stream: (start, end) => createReadStream(target, { start, end }),
      };
    },
    url,
    verify,
    async session(brandId, sessionId) {
      if (!SESSION_ID.test(sessionId)) return null;
      return readFile(path.join(sessionsDir(brandId), `${sessionId}.jsonl`), 'utf8').catch(() => null);
    },
    async promptFiles(brandId) {
      const memoryDir = path.join(sessionsDir(brandId), 'memory');
      const names = (await readdir(memoryDir).catch(() => [])).filter((name) => name.endsWith('.md')).sort();
      const [guide, memory] = await Promise.all([
        readFile(path.join(brandDir(brandId), 'CLAUDE.md'), 'utf8').catch(() => null),
        Promise.all(names.map(async (name) => ({ name, text: await readFile(path.join(memoryDir, name), 'utf8') }))),
      ]);
      return { guide, memory };
    },
  };
}

// I link firmati dell'API ai file dei brand: un <img> o un <video> non può mandare il token.
export function fileLinks(secret: string): Pick<BrandFiles, 'url' | 'verify'> {
  const sign = (brandId: string, relativePath: string) => createHmac('sha256', secret).update(`${brandId}/${relativePath}`).digest('base64url');
  return {
    url(brandId, relativePath) {
      return `/v1/files/${brandId}/${relativePath}?sig=${sign(brandId, relativePath)}`;
    },
    verify(brandId, relativePath, signature) {
      const expected = Buffer.from(sign(brandId, relativePath));
      const given = Buffer.from(signature);
      return expected.length === given.length && timingSafeEqual(expected, given);
    },
  };
}
