import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';

import { AD_IMAGE_ASPECT, BRAND_LOGO, type AdImageOption, type AdImageRole } from '@moonbrand/shared/domain/ads';
import type { ContentFile } from '@moonbrand/shared/domain/content';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { parseImage } from '../media/routes';

const run = promisify(execFile);

// Le immagini degli annunci: si scelgono tra quelle dei contenuti del brand, il logo o una caricata apposta (cartella
// pubblicita/). All'avvio il server le taglia al centro nella proporzione che Google vuole e le carica su Zernio.

export const AD_UPLOADS = 'pubblicita';
const IMAGE = /\.(png|jpe?g|webp)$/i;
const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
// Le misure consigliate da Google per ogni formato.
const SIZES: Record<AdImageRole, [number, number]> = { landscape: [1200, 628], square: [1200, 1200], portrait: [960, 1200], logo: [1200, 1200] };

const ratio = (aspect: string | undefined): number | null => {
  const [w, h] = (aspect ?? '').split(':').map(Number);
  return w && h ? w / h : null;
};

export async function adImageOptions(db: Queryable, files: BrandFiles, brandId: string): Promise<AdImageOption[]> {
  const { rows } = await db.query<{ title: string; files: ContentFile[] | null }>(
    `select title, visual -> 'files' as files from presenza.contents where brand_id = $1 order by updated_at desc limit 80`,
    [brandId],
  );
  const logo = await brandLogo(db, brandId);
  const options: AdImageOption[] = logo ? [{ file: BRAND_LOGO, url: logo, aspect: 1, source: 'logo', title: 'Logo' }] : [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const file of row.files ?? []) {
      if ((file.role !== 'cover' && file.role !== 'slide') || !IMAGE.test(file.file) || seen.has(file.file)) continue;
      seen.add(file.file);
      options.push({ file: file.file, url: files.url(brandId, file.file), aspect: ratio(file.aspect), source: 'content', title: row.title });
    }
  }
  const uploads = (await files.list(brandId, AD_UPLOADS))
    .filter((file) => IMAGE.test(file))
    .map((file): AdImageOption => ({ file, url: files.url(brandId, file), aspect: null, source: 'upload', title: '' }));
  options.splice(logo ? 1 : 0, 0, ...uploads);
  return options.slice(0, 120);
}

export async function brandLogo(db: Queryable, brandId: string): Promise<string | null> {
  const { rows } = await db.query<{ logo: string | null }>("select visual ->> 'logoUri' as logo from presenza.brands where id = $1", [brandId]);
  return rows[0]?.logo || null;
}

export async function uploadAdImage(files: BrandFiles, brandId: string, dataUri: string): Promise<AdImageOption> {
  const { bytes, mimeType } = parseImage(dataUri);
  const file = `${AD_UPLOADS}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
  await files.save(brandId, file, bytes);
  return { file, url: files.url(brandId, file), aspect: null, source: 'upload', title: '' };
}

// I byte di un'immagine scelta: un file del brand o il logo (data URI o indirizzo).
async function readChoice(files: BrandFiles, brandId: string, choice: string, logo: string | null): Promise<Buffer> {
  if (choice !== BRAND_LOGO) {
    if (choice.includes('..') || !IMAGE.test(choice)) throw ApiError.invalid('Immagine non valida.');
    return files.read(brandId, choice);
  }
  if (!logo) throw ApiError.invalid('Il brand non ha un logo: scegline un’immagine.');
  if (logo.startsWith('data:')) return Buffer.from(logo.slice(logo.indexOf(',') + 1), 'base64');
  const local = /^\/v1\/files\/[^/]+\/([^?]+)/.exec(logo);
  if (local) return files.read(brandId, decodeURIComponent(local[1]!));
  const response = await fetch(logo, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!response?.ok) throw ApiError.invalid('Non riesco a leggere il logo del brand.');
  return Buffer.from(await response.arrayBuffer());
}

// Taglia al centro nella proporzione del formato e porta alla misura consigliata, in JPEG (PNG per il logo).
async function crop(bytes: Buffer, role: AdImageRole): Promise<{ bytes: Buffer; type: string; ext: string }> {
  if (!ffmpegPath) throw new Error('ffmpeg non è disponibile su questa piattaforma');
  const dir = await mkdtemp(path.join(tmpdir(), 'ad-image-'));
  const png = role === 'logo';
  const output = path.join(dir, png ? 'out.png' : 'out.jpg');
  try {
    const input = path.join(dir, 'in');
    await writeFile(input, bytes);
    const r = AD_IMAGE_ASPECT[role];
    const [w, h] = SIZES[role];
    await run(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        input,
        '-frames:v',
        '1',
        '-vf',
        `crop='if(gt(iw/ih,${r}),ih*${r},iw)':'if(gt(iw/ih,${r}),ih,iw/${r})',scale=${w}:${h}`,
        ...(png ? [] : ['-q:v', '3']),
        output,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    return { bytes: await readFile(output), type: png ? 'image/png' : 'image/jpeg', ext: png ? 'png' : 'jpg' };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type ImageUploader = (name: string, contentType: string, bytes: Uint8Array) => Promise<string>;

// Le immagini scelte, tagliate e caricate: per ogni formato gli indirizzi pubblici nello stesso ordine.
export async function resolveAdImages(
  files: BrandFiles,
  brandId: string,
  logo: string | null,
  images: Partial<Record<AdImageRole, string[]>>,
  upload: ImageUploader,
): Promise<Record<AdImageRole, string[]>> {
  const out: Record<AdImageRole, string[]> = { landscape: [], square: [], portrait: [], logo: [] };
  for (const role of Object.keys(out) as AdImageRole[]) {
    for (const choice of images[role] ?? []) {
      const cropped = await crop(await readChoice(files, brandId, choice, logo), role).catch((error: unknown) => {
        if (error instanceof ApiError) throw error;
        throw ApiError.invalid(`Non riesco a preparare l’immagine ${path.basename(choice)}: scegline un’altra.`);
      });
      out[role].push(await upload(`${role}-${randomUUID().slice(0, 8)}.${cropped.ext}`, cropped.type, cropped.bytes));
    }
  }
  return out;
}

// Una carta del carosello: un'immagine quadrata.
export async function resolveCardImage(files: BrandFiles, brandId: string, logo: string | null, choice: string, upload: ImageUploader): Promise<string> {
  return (await resolveAdImages(files, brandId, logo, { square: [choice] }, upload)).square[0]!;
}
