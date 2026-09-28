import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { ContentJobInput } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { describeBrand } from '../lib/brand-brief';
import {
  CHANNEL_GUIDE,
  contentDir,
  FORMAT_GUIDE,
  HASHTAGS,
  neededImages,
  photoRules,
  runContentAgent,
  STYLE_RULES,
  WRITING_RULES,
} from '../lib/content';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

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

const prompt = `Scrivi il contenuto che nasce dall’idea qui sotto, pronto da pubblicare, e prepara le sue immagini.

## L’idea
${ideaLines}

## Formato
${FORMAT_GUIDE[format]}

## Canali
Una variante di testo per ciascuno:
${channels.map((channel) => `- ${channelName(channel)} (${channel}): ${CHANNEL_GUIDE[channel]}; hashtag al massimo ${HASHTAGS[channel]}`).join('\n')}

## Regole di scrittura
${WRITING_RULES}

## Immagini
Servono ${neededImages(format, channels)}.
${STYLE_RULES}
${photoRules(contentId)}
Salva le immagini finali in ${dir} e tieni i file di lavoro (HTML, script, foto intermedie) in ${dir}/lavoro.
Controlla ogni immagine finale prima di consegnarla: testo leggibile, niente tagli, colori del brand.

Rispondi in italiano.

${describeBrand(brand)}`;

await runContentAgent({ brandDir, contentId, format, channels, prompt });
