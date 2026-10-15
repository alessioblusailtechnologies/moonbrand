import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { ContentJobInput } from '@moonbrand/shared/api/contract';

import { writeBrandBrief } from '../lib/brief';
import { channelList, CONTENT_RULES, contentDir, neededFiles, runContentAgent } from '../lib/content';
import { languageRules } from '../lib/language';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const FORMAT_NAME = { post: 'post', carousel: 'carosello', article: 'articolo' } as const;

const { contentId, format, channels, brand, idea } = JSON.parse(inputJson) as Omit<ContentJobInput, 'brandId'>;
if (format === 'video') {
  console.error('I video non sono ancora nel motore nuovo.');
  process.exit(1);
}
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
// Il brand sta nel CLAUDE.md della cartella; le regole qui sotto.
await writeBrandBrief(brandDir, brand);

const prompt = `Prepara un ${FORMAT_NAME[format]} pronto da pubblicare per il brand descritto in CLAUDE.md, che nasce dall’idea qui sotto: i testi per ogni canale e le sue immagini.

## L’idea
${ideaLines}

## Canali
Una variante di testo per ciascuno: ${channelList(channels)}.

## Immagini
Servono ${neededFiles(format, channels)}. Salvale in ${dir} (per esempio ${dir}/cover-4x5.png, ${dir}/slide-1-4x5.png).

${CONTENT_RULES}

${languageRules()}`;

await runContentAgent({ brandDir, contentId, format, channels, prompt });
