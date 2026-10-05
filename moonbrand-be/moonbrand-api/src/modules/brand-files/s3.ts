import { createReadStream } from 'node:fs';
import path from 'node:path';

import {
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type pg from 'pg';

import type { Config } from '../../config';
import { ApiError } from '../../errors';
import { CONTENT_TYPES, DIR_NAME, fileLinks, OWNER_FILE, RELATIVE_PATH, type BrandFiles } from './files';

// Quanto vale il link allo storage: firmato sull'ora intera, così nella stessa ora il link è lo stesso e il browser
// tiene in cache il file; vale almeno un'ora da quando l'API lo manda.
const LINK_SECONDS = 2 * 60 * 60;
export const LINK_CACHE_SECONDS = 50 * 60;

// Il bucket dei brand, privato: si crea al primo avvio dell'API se non c'è.
export async function ensureBrandsBucket(files: BrandFiles & { client?: S3Client; bucket?: string }): Promise<void> {
  const { client, bucket: Bucket } = files;
  if (!client || !Bucket) return;
  const exists = await client.send(new HeadBucketCommand({ Bucket })).then(
    () => true,
    () => false,
  );
  if (!exists) await client.send(new CreateBucketCommand({ Bucket }));
}

// I file dei brand su uno storage S3 (Supabase Storage): la chiave è <brand>/<percorso>, gli stessi percorsi della
// cartella del brand sul disco del worker, che a ogni job li scarica e li ricarica.
export function s3BrandFiles(
  pool: pg.Pool,
  config: Pick<Config, 'S3_ENDPOINT' | 'S3_REGION' | 'S3_ACCESS_KEY_ID' | 'S3_SECRET_ACCESS_KEY' | 'S3_SESSION_TOKEN' | 'BRANDS_BUCKET' | 'FILES_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY'>,
): BrandFiles & { client: S3Client; bucket: string } {
  const client = new S3Client({
    endpoint: config.S3_ENDPOINT,
    region: config.S3_REGION,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: config.S3_SECRET_ACCESS_KEY ?? '',
      ...(config.S3_SESSION_TOKEN && { sessionToken: config.S3_SESSION_TOKEN }),
    },
  });
  const Bucket = config.BRANDS_BUCKET;
  const { url, verify } = fileLinks(config.FILES_SECRET ?? config.SUPABASE_SERVICE_ROLE_KEY);

  const key = (brandId: string, relativePath: string) => {
    if (!RELATIVE_PATH.test(relativePath)) throw ApiError.invalid('Percorso del file non valido.');
    return `${brandId}/${relativePath}`;
  };
  const contentType = (relativePath: string) => CONTENT_TYPES[path.extname(relativePath).toLowerCase()] ?? 'application/octet-stream';

  const get = async (Key: string): Promise<Buffer | null> => {
    try {
      const { Body } = await client.send(new GetObjectCommand({ Bucket, Key }));
      return Body ? Buffer.from(await Body.transformToByteArray()) : Buffer.alloc(0);
    } catch (error) {
      if (error instanceof NoSuchKey) return null;
      throw error;
    }
  };

  const keysUnder = async (prefix: string): Promise<string[]> => {
    const keys: string[] = [];
    let ContinuationToken: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix: prefix, ContinuationToken }));
      for (const item of page.Contents ?? []) if (item.Key) keys.push(item.Key);
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (ContinuationToken);
    return keys;
  };

  return {
    async claim(brandId, accountId) {
      const { rows } = await pool.query<{ account_id: string }>('select account_id from presenza.brands where id = $1', [brandId]);
      if (rows[0]) {
        if (rows[0].account_id !== accountId) throw ApiError.forbidden('NOT_YOUR_BRAND', 'Questo brand non è tuo.');
        return;
      }
      const marker = `${brandId}/${OWNER_FILE}`;
      const owner = await get(marker);
      if (owner === null) {
        await client.send(new PutObjectCommand({ Bucket, Key: marker, Body: accountId, ContentType: 'text/plain' }));
      } else if (owner.toString('utf8').trim() !== accountId) {
        throw ApiError.forbidden('NOT_YOUR_BRAND', 'Questo brand non è tuo.');
      }
    },
    async save(brandId, relativePath, bytes) {
      await client.send(new PutObjectCommand({ Bucket, Key: key(brandId, relativePath), Body: bytes, ContentType: contentType(relativePath) }));
    },
    // A pezzi, per i video lunghi.
    async saveFile(brandId, relativePath, localFile) {
      const upload = new Upload({
        client,
        params: { Bucket, Key: key(brandId, relativePath), Body: createReadStream(localFile), ContentType: contentType(relativePath) },
      });
      await upload.done();
    },
    async read(brandId, relativePath) {
      const bytes = await get(key(brandId, relativePath));
      if (bytes === null) throw ApiError.notFound('File non trovato.');
      return bytes;
    },
    async remove(brandId, relativePath) {
      await client.send(new DeleteObjectCommand({ Bucket, Key: key(brandId, relativePath) }));
    },
    async removeDir(brandId, dir) {
      if (!DIR_NAME.test(dir)) throw ApiError.invalid('Cartella non valida.');
      const keys = await keysUnder(`${brandId}/${dir}/`);
      for (let start = 0; start < keys.length; start += 1000) {
        const Objects = keys.slice(start, start + 1000).map((Key) => ({ Key }));
        await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects, Quiet: true } }));
      }
    },
    async copy(brandId, from, to) {
      const source = key(brandId, from);
      try {
        await client.send(new CopyObjectCommand({ Bucket, Key: key(brandId, to), CopySource: `${Bucket}/${source}` }));
      } catch (error) {
        if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') throw new Error(`${from} non c'è`);
        throw error;
      }
    },
    async open(brandId, relativePath) {
      const hour = Math.floor(Date.now() / 3_600_000) * 3_600_000;
      const redirect = await getSignedUrl(client, new GetObjectCommand({ Bucket, Key: key(brandId, relativePath) }), {
        expiresIn: LINK_SECONDS,
        signingDate: new Date(hour),
      });
      return { redirect };
    },
    url,
    verify,
    client,
    bucket: Bucket,
  };
}
