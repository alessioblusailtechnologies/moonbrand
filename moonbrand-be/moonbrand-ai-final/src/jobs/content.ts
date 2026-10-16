import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { ContentJobInput } from '@moonbrand/shared/api/contract';
import { formatAspects } from '@moonbrand/shared/domain/content';

import { WRITING_RULES } from '../prompts/content';
import { SCRIPT_RULES } from '../prompts/video';
import { jobArgs, runAgent } from '../service/agent';
import { writeBrandGuide } from '../service/brand';
import { channelList, contentDir, FORMAT_NAME, ideaLines, proposalSchema } from '../service/content';
import { languageRules } from '../service/language';
import { brandTools } from '../tools';

// La proposta di un contenuto dalla sezione Contenuti: cosa si farà, in breve (per un video il copione). L'utente la
// legge nella sezione Contenuti, con il consumo stimato che aggiunge il worker, la corregge e conferma: allora parte il
// lavoro content-video, nella stessa sessione, che fa il contenuto. Qui niente immagini né video.
const { brandDir, input } = jobArgs<Omit<ContentJobInput, 'brandId'>>('npm run job src/jobs/content.ts <cartella del brand> <input in JSON>');
const { contentId, format, channels, brand, idea } = input;
const dir = contentDir(contentId);

// Da zero: via i file di una stesura precedente.
await rm(path.join(brandDir, dir), { recursive: true, force: true });
await writeBrandGuide(brandDir, brand);

const what =
  format === 'video'
    ? `Scrivi il copione del video che nasce dall’idea qui sotto, per il brand descritto in CLAUDE.md. Solo il copione: l’utente lo legge e lo corregge nella sezione Contenuti, poi il video si monta a parte. Non fare immagini né pagine.`
    : `Proponi il ${FORMAT_NAME[format]} che nasce dall’idea qui sotto, per il brand descritto in CLAUDE.md: il titolo e, in poche righe, cosa farai (l’idea, il testo in breve, le immagini e come le impagini). L’utente legge la proposta nella sezione Contenuti, la corregge e conferma: solo allora si fanno testi e immagini. Qui non fare immagini né pagine. Se il brand ha immagini di riferimento, guardale con guarda per proporre qualcosa nel loro stile.`;

const prompt = `${what}

## L’idea
${ideaLines(idea)}

## Canali
${channelList(channels)}: ${format === 'video' ? `il video uscirà in ${formatAspects('video', channels).join(', ')}, il copione è uno per tutti i canali` : `una variante di testo per ciascuno, le immagini in ${formatAspects(format, channels).join(', ')}`}.

${format === 'video' ? SCRIPT_RULES : WRITING_RULES}

${languageRules()}`;

const tools = brandTools(brandDir);
try {
  await runAgent({ brandDir, prompt, tools: tools.servers, temp: path.join(brandDir, dir, 'tmp'), schema: proposalSchema(format) });
} finally {
  await tools.close();
}
