import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { PER_CHANNEL, runExamples, WORK_DIR } from '../lib/examples';

const [brandDir, brandJson] = process.argv.slice(2);
if (!brandDir || !brandJson) {
  console.error('Uso: npm run visual -- <cartella del brand> <contesto del brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as VisualBrandContext;
const channels = brand.channels.map((id) => `${channelName(id)} (${id})`).join(', ');

await rm(path.join(brandDir, 'esempi'), { recursive: true, force: true });
await rm(path.join(brandDir, WORK_DIR), { recursive: true, force: true });

const prompt = `Crea ${PER_CHANNEL} esempi di post per ciascuno di questi canali: ${channels}.
Ispirati alle immagini di riferimento nella cartella file-riferimento e salva ogni esempio come immagine nella cartella esempi.
Tieni i file di lavoro (HTML, script, foto intermedie) nella cartella ${WORK_DIR}.
Rispondi in italiano.

Il brand:
${JSON.stringify(brand, null, 2)}`;

await runExamples({ brandDir, channels: brand.channels, prompt });
