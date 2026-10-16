import path from 'node:path';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

import { chatGuide } from '../prompts/chat';
import { jobArgs, runAgent } from '../service/agent';
import { writeBrandGuide } from '../service/brand';
import { creditsFromEnv } from '../service/estimate';
import { prepareVideoProject } from '../service/video';
import { brandTools } from '../tools';

// Un turno della chat: Claude Code nella cartella del brand, che riprende la sessione della conversazione, con tutti i
// tool. Il token del job arriva per variabile d'ambiente: i tool di moonbrand lo usano per chiamare l'API.
const { brandDir, input } = jobArgs<Omit<ChatJobInput, 'brandId'>>('npm run job src/jobs/chat.ts <cartella del brand> <input in JSON>');
const token = process.env.MOONBRAND_AGENT_TOKEN;
if (!token) {
  console.error('Manca il token del job: la chat parte solo dal worker.');
  process.exit(1);
}

const { conversationId, sessionId, brand, message, attachments, idea = null, slot = null } = input;
const workDir = `chat/${conversationId}`;
await writeBrandGuide(brandDir, brand);
// Il progetto video del brand è pronto a ogni turno: un video si può chiedere in qualsiasi momento.
const videoEnv = await prepareVideoProject(brandDir);

// L'idea e l'uscita del piano menzionate nel messaggio: il contenuto che l'utente chiede nasce da quelle.
const ideaBlock =
  idea && [`L’idea menzionata: ${idea.title}`, idea.angleLabel && `Taglio: ${idea.angleLabel}`, idea.angle && `Cosa raccontare: ${idea.angle}`, idea.rationale && `Perché adesso: ${idea.rationale}`, idea.theme && `Tema: ${idea.theme}`].filter(Boolean).join('\n');
const slotBlock = slot && [`L’uscita del piano menzionata (slotId ${slot.id}): ${slot.date} alle ${slot.time} su ${slot.channels.join(', ')}`, slot.theme && `Tema che il piano chiede: ${slot.theme}`].filter(Boolean).join('\n');
const prompt = [message, slotBlock, ideaBlock, attachments.length > 0 && `Allegati:\n${attachments.map((file) => `- ${file}`).join('\n')}`].filter(Boolean).join('\n\n');

const tools = brandTools(brandDir, { video: true, api: { token, workDir } });
try {
  await runAgent({
    brandDir,
    prompt,
    guide: chatGuide(workDir, creditsFromEnv()),
    tools: tools.servers,
    temp: path.join(brandDir, workDir, 'tmp'),
    env: videoEnv,
    stream: true,
    ...(sessionId && { resume: sessionId }),
  });
} finally {
  await tools.close();
}
