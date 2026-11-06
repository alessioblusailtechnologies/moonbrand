import { access, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';

// Il passaggio di un brand della v1 al v2, prima del job cartella (StyleJobInput.migrate). La roba che serviva solo alla
// v1 va in v1/, che la chat non legge: il CLAUDE.md lungo, gli esempi e i riferimenti da seguire dell'onboarding, i
// template e il progetto video. Senza CLAUDE.md il job cartella scrive quello del v2. Contenuti, allegati, riferimenti
// caricati e logo restano dove sono. Per tornare indietro basta rimettere fuori quello che c'è in v1/.

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
    // Già archiviato da un giro di prima: quello fuori l'ha scritto il v2, e il job cartella lo rifà.
    if (await exists(path.join(archive, item))) {
      await rm(from, { recursive: true, force: true });
      continue;
    }
    await rename(from, path.join(archive, item));
    moved.push(item);
  }
  return moved;
}
