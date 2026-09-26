import { createHmac, timingSafeEqual } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import { brandsDir, type Config } from '../../config';
import { ApiError } from '../../errors';

export const REFERENCES_DIR = 'file-riferimento';
export const FOLLOW_DIR = 'riferimenti-da-seguire';

// Chi ha aperto la cartella di un brand non ancora creato: il brand nasce
// nella bozza dell'onboarding e sul DB arriva solo alla fine.
const OWNER_FILE = '.account';

const RELATIVE_PATH = /^[a-z0-9-]+\/[A-Za-z0-9_-][A-Za-z0-9._-]*$/;

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

export interface BrandFiles {
  claim(brandId: string, accountId: string): Promise<void>;
  save(brandId: string, relativePath: string, bytes: Uint8Array): Promise<void>;
  remove(brandId: string, relativePath: string): Promise<void>;
  copy(brandId: string, from: string, to: string): Promise<void>;
  read(brandId: string, relativePath: string): Promise<{ bytes: Buffer; contentType: string }>;
  url(brandId: string, relativePath: string): string;
  verify(brandId: string, relativePath: string, signature: string): boolean;
}

export function localBrandFiles(pool: pg.Pool, config: Pick<Config, 'BRANDS_DIR' | 'FILES_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY'>): BrandFiles {
  const root = brandsDir(config);
  const secret = config.FILES_SECRET ?? config.SUPABASE_SERVICE_ROLE_KEY;

  const brandDir = (brandId: string) => path.join(root, brandId);
  const filePath = (brandId: string, relativePath: string) => {
    if (!RELATIVE_PATH.test(relativePath)) throw ApiError.invalid('Percorso del file non valido.');
    return path.join(brandDir(brandId), relativePath);
  };
  const sign = (brandId: string, relativePath: string) => createHmac('sha256', secret).update(`${brandId}/${relativePath}`).digest('base64url');

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
    async remove(brandId, relativePath) {
      await rm(filePath(brandId, relativePath), { force: true });
    },
    async copy(brandId, from, to) {
      const target = filePath(brandId, to);
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(filePath(brandId, from), target);
    },
    async read(brandId, relativePath) {
      const target = filePath(brandId, relativePath);
      const bytes = await readFile(target).catch(() => {
        throw ApiError.notFound('File non trovato.');
      });
      return { bytes, contentType: CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream' };
    },
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
