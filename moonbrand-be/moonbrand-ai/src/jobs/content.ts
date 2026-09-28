import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { ContentJobInput } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { writeBrandGuide } from '../lib/brand-guide';
import { contentDir, neededImages, runContentAgent } from '../lib/content';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const FORMAT_NAME = { post: 'post', carousel: 'carosello', article: 'articolo' } as const;

const { contentId, format, channels, brand, idea } = JSON.parse(inputJson) as Omit<ContentJobInput, 'brandId'>;
const dir = contentDir(contentId);
const ideaLines = [
  idea.title,
  idea.angleLabel && `Taglio: ${idea.angleLabel}`,
  idea.angle && `Cosa raccontare: ${idea.angle}`,
  idea.rationale && `Perché adesso: ${idea.rationale}`,
  idea.theme && `Tema: ${idea.theme}`,
]
  .filter(Boolean)
  .join('\n');

// Da zero: via i file di una stesura precedente.
await rm(path.join(brandDir, dir), { recursive: true, force: true });
// Il brand sta nel CLAUDE.md della cartella e le regole nella skill: il prompt dice solo cosa vale per questo contenuto.
await writeBrandGuide(brandDir, brand);

const prompt = `Scrivi il contenuto che nasce dall’idea qui sotto, pronto da pubblicare, e prepara le sue immagini.
Segui la skill moonbrand:contenuti; il brand è descritto in CLAUDE.md.

## L’idea
${ideaLines}

## Formato
${FORMAT_NAME[format]}

## Canali
Una variante di testo per ciascuno: ${channels.map((channel) => `${channelName(channel)} (${channel})`).join(', ')}.

## Immagini
Servono ${neededImages(format, channels)}.
Salva le immagini finali in ${dir} e tieni i file di lavoro (HTML, script, foto intermedie) in ${dir}/lavoro.

Rispondi in italiano.`;

await runContentAgent({ brandDir, contentId, format, channels, prompt });
