import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { PER_CHANNEL, runExamples, workDir } from '../lib/examples';

const [brandDir, dir, brandJson] = process.argv.slice(2);
if (!brandDir || !dir || !brandJson) {
  console.error('Uso: npm run visual -- <cartella del brand> <cartella degli esempi> <contesto del brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as VisualBrandContext;
const channels = brand.channels.map((id) => `${channelName(id)} (${id})`).join(', ');

// Da zero, ma solo nella cartella di questa generazione: le altre restano come sono.
await rm(path.join(brandDir, dir), { recursive: true, force: true });

const prompt = `Crea ${PER_CHANNEL} esempi di post per ciascuno di questi canali: ${channels}.
Ispirati alle immagini di riferimento nella cartella file-riferimento e salva ogni esempio come immagine nella cartella ${dir}.
Tieni i file di lavoro (HTML, script, foto intermedie) nella cartella ${workDir(dir)}.
Rispondi in italiano.

Il brand:
${JSON.stringify(brand, null, 2)}`;

await runExamples({ brandDir, dir, channels: brand.channels, prompt });
