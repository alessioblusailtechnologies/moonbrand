import { access, mkdir, readdir, rename, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';

// Il passaggio di un brand da un motore all'altro, prima del job cartella (StyleJobInput.migrate). Verso v2 la roba che
// serviva solo alla v1 va in v1/, che la chat non legge: il CLAUDE.md lungo, gli esempi e i riferimenti da seguire
// dell'onboarding, i template e il progetto video. Senza CLAUDE.md il job cartella scrive quello del v2. Verso v1 torna
// tutto fuori, al posto del CLAUDE.md del v2. Contenuti, allegati, riferimenti caricati e logo restano dove sono.

export const ARCHIVE = 'v1';
const V1_ONLY = ['CLAUDE.md', 'esempi', 'riferimenti-da-seguire', 'template', 'video'];

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

export async function archiveV1(brandDir: string): Promise<string[]> {
  const archive = path.join(brandDir, ARCHIVE);
  await mkdir(archive, { recursive: true });
  const moved: string[] = [];
  for (const item of V1_ONLY) {
    const from = path.join(brandDir, item);
    if (!(await exists(from))) continue;
    // Già archiviato da un passaggio di prima: quello fuori l'ha scritto il v2, si rifà.
    if (await exists(path.join(archive, item))) {
      await rm(from, { recursive: true, force: true });
      continue;
    }
    await rename(from, path.join(archive, item));
    moved.push(item);
  }
  return moved;
}

export async function restoreV1(brandDir: string): Promise<string[]> {
  const archive = path.join(brandDir, ARCHIVE);
  // Il CLAUDE.md del v2 non serve alla v1, che ne scrive uno suo a ogni job.
  await rm(path.join(brandDir, 'CLAUDE.md'), { force: true });
  if (!(await exists(archive))) return [];
  const moved: string[] = [];
  for (const item of await readdir(archive)) {
    const to = path.join(brandDir, item);
    if (await exists(to)) continue;
    await rename(path.join(archive, item), to);
    moved.push(item);
  }
  await rmdir(archive).catch(() => undefined);
  return moved;
}
