import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import { fileKind, type StepMedia } from '@moonbrand/shared/ai/steps';
import { ARTIFACTS_DIR, mimeOf, titleFromFile } from '@moonbrand/shared/domain/artifact';

import { putBrandFiles } from './brand-sync';

// Gli artefatti della chat (domain/artifact.ts): quando un tool che produce un file finisce bene, il file diventa un
// artefatto della conversazione. Se ne fa una copia fissa in artefatti/, che va subito sullo storage (lo studio la mostra
// mentre il turno va avanti), e una riga in presenza.artifacts; rifatto lo stesso file, la riga nuova punta alla
// precedente. Il modello non deve fare niente: basta il file che il tool ha scritto.

export interface ArtifactRecorder {
  // I file di un passaggio appena finito; si registrano uno dopo l'altro, senza fermare il turno.
  record(media: readonly StepMedia[]): void;
  // Aspetta le registrazioni in corso: prima di chiudere il job.
  done(): Promise<void>;
}

interface Owner {
  jobId: string;
  accountId: string;
  brandId: string;
  conversationId: string;
}

export function artifactRecorder(pool: pg.Pool, brandDir: string, owner: Owner): ArtifactRecorder {
  let queue = Promise.resolve();
  return {
    record(media) {
      for (const item of media) {
        if (!item.file) continue;
        queue = queue
          .then(() => save(pool, brandDir, owner, item as StepMedia & { file: string }))
          .catch((error: unknown) => console.error(`[${owner.jobId}] artefatto ${item.file} non registrato`, error));
      }
    },
    done: () => queue,
  };
}

async function save(pool: pg.Pool, brandDir: string, owner: Owner, item: StepMedia & { file: string }): Promise<void> {
  const found = await written(brandDir, item.file, item.kind);
  const { kind } = item;
  if (found.length === 0 || found.some((file) => fileKind(file) !== kind)) return;
  const id = randomUUID();
  await mkdir(path.join(brandDir, ARTIFACTS_DIR), { recursive: true });
  const copies = await Promise.all(
    found.map(async (file, index) => {
      const copy = `${ARTIFACTS_DIR}/${id}${found.length > 1 ? `-${index + 1}` : ''}${path.extname(file).toLowerCase()}`;
      await copyFile(path.join(brandDir, file), path.join(brandDir, copy));
      return copy;
    }),
  );
  await putBrandFiles(brandDir, copies);
  await pool.query(
    `insert into presenza.artifacts (id, account_id, brand_id, conversation_id, job_id, kind, title, source, files, mime, aspect, parent_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
       (select id from presenza.artifacts where conversation_id = $4 and source = $8 order by created_at desc limit 1))`,
    [
      id,
      owner.accountId,
      owner.brandId,
      owner.conversationId,
      owner.jobId,
      kind,
      item.title ?? titleFromFile(item.file),
      item.file,
      copies,
      mimeOf(found[0]!),
      item.aspect ?? null,
    ],
  );
}

// I file che il tool ha scritto davvero al posto di quello chiesto: lui stesso; per l'audio le versioni numerate (Suno ne
// fa 2: musica-1.mp3, musica-2.mp3); per un'immagine lo stesso nome con l'estensione del formato restituito (genera_immagine).
async function written(brandDir: string, file: string, kind: StepMedia['kind']): Promise<string[]> {
  const isFile = (relative: string) =>
    stat(path.join(brandDir, relative)).then(
      (info) => info.isFile(),
      () => false,
    );
  if (await isFile(file)) return [file];
  const dir = path.posix.dirname(file);
  const base = path.posix.basename(file).replace(/\.[^.]+$/, '');
  const names = await readdir(path.join(brandDir, dir)).catch(() => [] as string[]);
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const join = (name: string) => (dir === '.' ? name : `${dir}/${name}`);
  if (kind !== 'audio' && kind !== 'image') return [];
  const numbered = names
    .filter((name) => new RegExp(`^${escaped}-\\d+\\.[a-z0-9]+$`, 'i').test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map(join);
  if (kind === 'audio') return numbered;
  const other = names.find((name) => new RegExp(`^${escaped}\\.[a-z0-9]+$`, 'i').test(name));
  return other ? [join(other)] : [];
}
