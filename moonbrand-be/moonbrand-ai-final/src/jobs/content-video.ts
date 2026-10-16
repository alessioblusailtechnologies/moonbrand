import path from 'node:path';

import type { ContentVideoJobInput } from '@moonbrand/shared/api/contract';
import { VIDEO_ASPECT } from '@moonbrand/shared/domain/content';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { CONTENT_RULES, WRITING_RULES } from '../prompts/content';
import { VIDEO_RULES } from '../prompts/video';
import { CLIP_CAP_USD } from '../config/env';
import { jobArgs, runAgent } from '../service/agent';
import { channelList, contentDir, contentSchema, FORMAT_NAME, neededFiles, sceneLines } from '../service/content';
import { languageRules } from '../service/language';
import { prepareVideoProject } from '../service/video';
import { brandTools } from '../tools';

// Il contenuto dalla proposta confermata (per un video, il montaggio dal copione approvato): testi per canale e immagini o
// video. Riprende la sessione della proposta, quando c'è: Claude sa perché ha proposto così. La proposta arriva com'è sul
// DB, perché l'utente può averla corretta.
const { brandDir, input } = jobArgs<Omit<ContentVideoJobInput, 'brandId'>>('npm run job src/jobs/content-video.ts <cartella del brand> <input in JSON>');
const { contentId, sessionId, format, channels, script, scenes } = input;
const dir = contentDir(contentId);
const video = format === 'video';
if (video && (!Array.isArray(scenes) || scenes.length === 0)) {
  console.error('Il copione non ha inquadrature: prima serve il copione del video.');
  process.exit(1);
}

const prompt = video
  ? `L’utente ha approvato il copione del video: ora fai il video, seguendo il copione qui sotto, che può essere diverso da quello che avevi scritto. Poi scrivi i testi per canale.

## Il copione
${script.trim() || '—'}

${sceneLines(scenes)}

## Canali
Una variante di testo per ciascuno: ${channels.map((channel) => `${channelName(channel)} (${channel}, video in ${VIDEO_ASPECT[channel]})`).join(', ')}.

## File
Servono ${neededFiles('video', channels)}. L’id del video è ${contentId}: salva MP4 e copertine finali in ${dir} (es. ${dir}/video-9x16.mp4 e ${dir}/cover-9x16.jpg).
Nel risultato riporta anche il copione, con le correzioni che hai dovuto fare mentre facevi il video.

${VIDEO_RULES}

${WRITING_RULES}

${languageRules()}`
  : `L’utente ha confermato la proposta: ora fai il ${FORMAT_NAME[format]}, seguendo la proposta qui sotto, che può essere diversa da quella che avevi scritto: i testi per ogni canale e le immagini.

## La proposta confermata
${script.trim() || '—'}

## Canali
Una variante di testo per ciascuno: ${channelList(channels)}.

## Immagini
Servono ${neededFiles(format, channels)}. Salvale in ${dir} (per esempio ${dir}/cover-4x5.png, ${dir}/slide-1-4x5.png), con l’HTML in ${dir}/lavoro.

${CONTENT_RULES}

${languageRules()}`;

const env = video ? await prepareVideoProject(brandDir) : {};
const tools = brandTools(brandDir, { video, clipCap: CLIP_CAP_USD });
try {
  await runAgent({ brandDir, prompt, tools: tools.servers, temp: path.join(brandDir, dir, 'tmp'), env, schema: contentSchema(contentId, format, channels), ...(sessionId && { resume: sessionId }) });
} finally {
  await tools.close();
}
