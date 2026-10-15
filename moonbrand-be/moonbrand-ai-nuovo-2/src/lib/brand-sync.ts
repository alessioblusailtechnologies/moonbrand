import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

// I file dei brand stanno su Supabase Storage (protocollo S3), con la chiave <brand>/<percorso>: lì li legge e li scrive
// l'API. Il worker ne tiene una copia nella cartella del brand: prima di un job scarica quello che è cambiato, dopo
// ricarica quello che il job ha cambiato. Le sessioni di Claude Code del brand fanno lo stesso giro sotto _sessions/<brand>/,
// così un job può riprendere su un'altra macchina la sessione di un job di prima.
// Senza S3_ENDPOINT non c'è niente da sincronizzare: i file restano solo sul disco.

// Mai sullo storage: le dipendenze, che il progetto video reinstalla da solo, e i file temporanei dei job.
const SKIPPED_DIRS = new Set(['node_modules', 'tmp']);
const PARALLEL = 8;
const SESSIONS_PREFIX = '_sessions';
// Il tipo con cui lo storage manda il file allo studio: un video senza il suo tipo non parte in tutti i browser.
const CONTENT_TYPES: Record<string, string> = {
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

// Com'era ogni file all'ultimo giro: etag sullo storage, dimensione e data di modifica sul disco.
type State = Record<string, { etag: string; size: number; mtime: number }>;

interface Store {
  client: S3Client;
  bucket: string;
}

let cached: Store | null | undefined;

function store(): Store | null {
  if (cached !== undefined) return cached;
  const { S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_SESSION_TOKEN, BRANDS_BUCKET } = process.env;
  cached = S3_ENDPOINT
    ? {
        client: new S3Client({
          endpoint: S3_ENDPOINT,
          region: S3_REGION || 'eu-north-1',
          forcePathStyle: true,
          credentials: { accessKeyId: S3_ACCESS_KEY_ID ?? '', secretAccessKey: S3_SECRET_ACCESS_KEY ?? '', ...(S3_SESSION_TOKEN && { sessionToken: S3_SESSION_TOKEN }) },
        }),
        bucket: BRANDS_BUCKET || 'presenza-brands',
      }
    : null;
  return cached;
}

export const syncEnabled = () => store() !== null;

// La cartella dove Claude Code tiene le sessioni avviate dalla cartella del brand: il percorso con ogni carattere che
// non è una lettera o una cifra cambiato in «-».
export function sessionsDir(brandDir: string): string {
  const config = process.env.CLAUDE_CONFIG_DIR || path.join(homedir(), '.claude');
  return path.join(config, 'projects', path.resolve(brandDir).replace(/[^a-zA-Z0-9]/g, '-'));
}

async function inParallel<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) await work(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, lane));
}

async function remoteFiles({ client, bucket }: Store, prefix: string): Promise<Map<string, { etag: string; size: number }>> {
  const files = new Map<string, { etag: string; size: number }>();
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken }));
    for (const item of page.Contents ?? []) {
      if (item.Key && !item.Key.endsWith('/')) files.set(item.Key.slice(prefix.length), { etag: item.ETag ?? '', size: item.Size ?? 0 });
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return files;
}

// I file della cartella, con i percorsi relativi in stile S3 (sempre «/»).
async function localFiles(dir: string): Promise<Map<string, { size: number; mtime: number }>> {
  const files = new Map<string, { size: number; mtime: number }>();
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  await inParallel(entries, async (entry) => {
    if (!entry.isFile()) return;
    const full = path.join(entry.parentPath, entry.name);
    const relative = path.relative(dir, full).split(path.sep);
    if (relative.some((segment) => SKIPPED_DIRS.has(segment))) return;
    const info = await stat(full).catch(() => null);
    if (info) files.set(relative.join('/'), { size: info.size, mtime: Math.round(info.mtimeMs) });
  });
  return files;
}

async function upload({ client, bucket }: Store, key: string, file: string): Promise<string> {
  const ContentType = CONTENT_TYPES[path.extname(key).toLowerCase()] ?? 'application/octet-stream';
  const done = await new Upload({ client, params: { Bucket: bucket, Key: key, Body: createReadStream(file), ContentType } }).done();
  return done.ETag ?? '';
}

// Lo stato dell'ultimo giro sta accanto alle cartelle dei brand, fuori da quella che si sincronizza.
const stateFile = (brandsDir: string, name: string) => path.join(brandsDir, '.sync', `${name}.json`);

async function loadState(file: string): Promise<State> {
  return JSON.parse(await readFile(file, 'utf8').catch(() => '{}')) as State;
}

async function saveState(file: string, state: State): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(state));
  await rename(`${file}.tmp`, file);
}

// Dallo storage al disco: i file nuovi o cambiati sullo storage si scaricano, quelli tolti dallo storage dopo l'ultimo
// giro si tolgono anche dal disco. I file fatti qui e non ancora ricaricati restano.
async function pullDir(target: Store, prefix: string, dir: string, statePath: string): Promise<void> {
  const [remote, state] = await Promise.all([remoteFiles(target, prefix), loadState(statePath)]);
  const missing = [...remote].filter(([relative, file]) => state[relative]?.etag !== file.etag);
  await inParallel(missing, async ([relative, file]) => {
    const full = path.join(dir, ...relative.split('/'));
    await mkdir(path.dirname(full), { recursive: true });
    const { Body } = await target.client.send(new GetObjectCommand({ Bucket: target.bucket, Key: prefix + relative }));
    await pipeline(Body as Readable, createWriteStream(`${full}.download`));
    await rename(`${full}.download`, full);
    const info = await stat(full);
    state[relative] = { etag: file.etag, size: info.size, mtime: Math.round(info.mtimeMs) };
  });
  for (const relative of Object.keys(state)) {
    if (remote.has(relative)) continue;
    await rm(path.join(dir, ...relative.split('/')), { force: true });
    delete state[relative];
  }
  await saveState(statePath, state);
}

// Dal disco allo storage: i file cambiati dall'ultimo giro si caricano, quelli tolti dal disco si tolgono dallo storage.
// Un file nuovo che sullo storage c'è già con la stessa dimensione l'ha caricato putBrandFiles durante il job.
async function pushDir(target: Store, prefix: string, dir: string, statePath: string): Promise<void> {
  const [local, remote, state] = await Promise.all([localFiles(dir), remoteFiles(target, prefix), loadState(statePath)]);
  const changed = [...local].filter(([relative, file]) => state[relative]?.size !== file.size || state[relative]?.mtime !== file.mtime);
  await inParallel(changed, async ([relative, file]) => {
    const there = remote.get(relative);
    const etag =
      !state[relative] && there?.size === file.size ? there.etag : await upload(target, prefix + relative, path.join(dir, ...relative.split('/')));
    state[relative] = { etag, ...file };
  });
  await inParallel(
    Object.keys(state).filter((relative) => !local.has(relative)),
    async (relative) => {
      if (remote.has(relative)) await target.client.send(new DeleteObjectCommand({ Bucket: target.bucket, Key: prefix + relative }));
      delete state[relative];
    },
  );
  await saveState(statePath, state);
}

// Un giro alla volta per brand: due job dello stesso brand sulla stessa macchina non scrivono lo stato insieme.
const queues = new Map<string, Promise<void>>();
function serial(brandId: string, work: () => Promise<void>): Promise<void> {
  const run = (queues.get(brandId) ?? Promise.resolve()).then(work);
  const tail = run.catch(() => undefined);
  queues.set(brandId, tail);
  void tail.then(() => queues.get(brandId) === tail && queues.delete(brandId));
  return run;
}

export function pullBrand(brandsDir: string, brandId: string): Promise<void> {
  const target = store();
  if (!target) return Promise.resolve();
  const brandDir = path.join(brandsDir, brandId);
  return serial(brandId, async () => {
    await pullDir(target, `${brandId}/`, brandDir, stateFile(brandsDir, brandId));
    await pullDir(target, `${SESSIONS_PREFIX}/${brandId}/`, sessionsDir(brandDir), stateFile(brandsDir, `${brandId}.sessions`));
  });
}

export function pushBrand(brandsDir: string, brandId: string): Promise<void> {
  const target = store();
  if (!target) return Promise.resolve();
  const brandDir = path.join(brandsDir, brandId);
  return serial(brandId, async () => {
    await pushDir(target, `${brandId}/`, brandDir, stateFile(brandsDir, brandId));
    await pushDir(target, `${SESSIONS_PREFIX}/${brandId}/`, sessionsDir(brandDir), stateFile(brandsDir, `${brandId}.sessions`));
  });
}

// Alcuni file servono sullo storage prima della fine del job: le immagini e i video che lo studio mostra appena
// pronti, e i file che un tool passa all'API (che li legge dallo storage). Si caricano subito, se non ci sono già.
export async function putBrandFiles(brandDir: string, files: string[]): Promise<void> {
  const target = store();
  if (!target) return;
  const brandId = path.basename(brandDir);
  await inParallel([...new Set(files)], async (relative) => {
    const full = path.join(brandDir, ...relative.split('/'));
    const info = await stat(full).catch(() => null);
    if (!info?.isFile()) return;
    const key = `${brandId}/${relative}`;
    const there = await target.client.send(new HeadObjectCommand({ Bucket: target.bucket, Key: key })).catch(() => null);
    if (there?.ContentLength !== info.size) await upload(target, key, full);
  });
}
