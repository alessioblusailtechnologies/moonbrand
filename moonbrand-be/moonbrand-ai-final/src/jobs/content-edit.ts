import path from 'node:path';

import type { ContentEditJobInput } from '@moonbrand/shared/api/contract';
import { formatAspects } from '@moonbrand/shared/domain/content';

import { CONTENT_RULES, WRITING_RULES } from '../prompts/content';
import { SCRIPT_RULES, VIDEO_RULES } from '../prompts/video';
import { CLIP_CAP_USD } from '../config/env';
import { jobArgs, runAgent } from '../service/agent';
import { channelList, contentDir, contentSchema, neededFiles, proposalSchema } from '../service/content';
import { languageRules } from '../service/language';
import { prepareVideoProject } from '../service/video';
import { brandTools } from '../tools';

// Un ritocco chiesto dalla sezione Contenuti, nella sessione che ha scritto il contenuto: della proposta non ancora
// confermata (scriptOnly) o del contenuto fatto. I canali possono essere cambiati (un canale aggiunto): il risultato vale
// per quelli di adesso.
const { brandDir, input } = jobArgs<Omit<ContentEditJobInput, 'brandId'>>('npm run job src/jobs/content-edit.ts <cartella del brand> <input in JSON>');
const { contentId, sessionId, format, channels, instruction, scriptOnly } = input;
const dir = contentDir(contentId);
const video = format === 'video';

const task = scriptOnly
  ? `Aggiorna ${video ? 'il copione del video' : 'la proposta'} di conseguenza. Non fare ancora immagini né video. Restituisci ${video ? 'il copione completo, anche le inquadrature' : 'la proposta completa, anche le parti'} che non hai cambiato.
Canali: ${channelList(channels)}; ${video ? `il video uscirà in ${formatAspects('video', channels).join(', ')}` : `le immagini in ${formatAspects(format, channels).join(', ')}`}.

${video ? SCRIPT_RULES : WRITING_RULES}`
  : video
    ? `Aggiorna il video di conseguenza: cambia solo quello che la correzione tocca, controlla con controlla_video e riesporta con esporta_video in ${dir}, sugli stessi file. Aggiorna testi per canale e copione solo se la correzione li riguarda. Restituisci il contenuto completo, anche le parti che non hai cambiato.
Canali: ${channelList(channels)}, con una variante di testo per ciascuno. File: ${neededFiles('video', channels)}.

${VIDEO_RULES}

${WRITING_RULES}`
    : `Aggiorna il contenuto di conseguenza: testi e immagini in ${dir}. Rifai solo le immagini che la correzione tocca; le altre restano quelle di prima. Restituisci il contenuto completo, anche le parti che non hai cambiato.
Canali: ${channelList(channels)}, con una variante di testo per ciascuno. File: ${neededFiles(format, channels)}.

${CONTENT_RULES}`;

const prompt = `${instruction}

${task}

${languageRules()}`;

const env = video && !scriptOnly ? await prepareVideoProject(brandDir) : {};
const tools = brandTools(brandDir, { video: video && !scriptOnly, clipCap: CLIP_CAP_USD });
try {
  await runAgent({
    brandDir,
    prompt,
    tools: tools.servers,
    temp: path.join(brandDir, dir, 'tmp'),
    env,
    schema: scriptOnly ? proposalSchema(format) : contentSchema(contentId, format, channels),
    resume: sessionId,
  });
} finally {
  await tools.close();
}
