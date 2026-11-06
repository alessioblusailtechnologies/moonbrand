import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

// Il logo del brand sta sul DB (visual.logoUri, un data URI): nella cartella del brand diventa logo.<estensione>, così
// chi fa una grafica lo mette com'è invece di ridisegnarlo. Si riscrive prima di ogni job, solo se è cambiato; se il
// brand non ha più un logo, il file si toglie.
const EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const LOGO = /^logo\.(png|jpg|webp|svg)$/;

function decode(uri: string): { extension: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(uri);
  const extension = match && EXTENSIONS[match[1]!.toLowerCase()];
  if (!match || !extension) return null;
  const bytes = match[2]!.includes(';base64') ? Buffer.from(match[3]!, 'base64') : Buffer.from(decodeURIComponent(match[3]!));
  return bytes.length > 0 ? { extension, bytes } : null;
}

// Il nome del file del logo nella cartella, se c'è.
export async function logoFile(brandDir: string): Promise<string | null> {
  const names = await readdir(brandDir).catch(() => [] as string[]);
  return names.find((name) => LOGO.test(name)) ?? null;
}

export async function writeBrandLogo(pool: pg.Pool, brandDir: string, brandId: string): Promise<void> {
  const { rows } = await pool.query<{ logo: string | null }>(`select visual->>'logoUri' as logo from presenza.brands where id = $1`, [brandId]);
  // Un brand ancora in bozza (onboarding) non è sul DB: la cartella resta com'è.
  if (!rows[0]) return;
  const logo = rows[0].logo ? decode(rows[0].logo) : null;
  const current = await logoFile(brandDir);
  const target = logo && `logo${logo.extension}`;
  if (current && current !== target) await rm(path.join(brandDir, current), { force: true });
  if (!logo || !target) return;
  const before = current === target ? await readFile(path.join(brandDir, target)).catch(() => null) : null;
  if (!before?.equals(logo.bytes)) await writeFile(path.join(brandDir, target), logo.bytes);
}
