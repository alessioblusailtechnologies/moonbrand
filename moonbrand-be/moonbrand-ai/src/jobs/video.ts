import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import { MOONBRAND_PLUGINS } from '../lib/plugin';
import { prepareVideoProject } from '../lib/video';
import { audioTools } from '../tools/audio';
import { clipTools } from '../tools/clip';
import { imageTools } from '../tools/immagini';

// Prova del video: Claude fa un video per il brand a partire da una richiesta libera.
// Il brand è quello del CLAUDE.md già presente nella cartella; il risultato resta in prove-video/<id>.
const [brandDir, request] = process.argv.slice(2);
if (!brandDir || !request) {
  console.error('Uso: npm run video -- <cartella del brand> "<cosa deve raccontare il video>"');
  process.exit(1);
}

const { GEMINI_API_KEY, ELEVENLABS_API_KEY, ...env } = process.env;
if (!ELEVENLABS_API_KEY) {
  console.error('Manca ELEVENLABS_API_KEY nel .env di moonbrand-ai.');
  process.exit(1);
}

const videoId = randomUUID();
const dir = `prove-video/${videoId}`;
const temp = path.join(brandDir, dir, 'tmp');
await mkdir(temp, { recursive: true });
const videoEnv = await prepareVideoProject(brandDir);

const mcpServers: Record<string, McpServerConfig> = { audio: audioTools(brandDir, ELEVENLABS_API_KEY) };
if (GEMINI_API_KEY) {
  mcpServers.immagini = imageTools(brandDir, GEMINI_API_KEY);
  mcpServers.clip = clipTools(brandDir, GEMINI_API_KEY);
}

const prompt = `Fai un video per il brand, pronto da pubblicare, seguendo la skill moonbrand:video; il brand è descritto in CLAUDE.md.

## Cosa deve raccontare
${request}

## Il video
L'id del video è ${videoId}. Salva i fotogrammi di controllo in ${dir}/fotogrammi, il video finale in ${dir}/video-9x16.mp4 e la copertina in ${dir}/copertina-9x16.jpg.

Rispondi in italiano.`;

for await (const message of query({
  prompt,
  options: {
    cwd: brandDir,
    env: { ...env, ...videoEnv, TEMP: temp, TMP: temp, TMPDIR: temp },
    mcpServers,
    plugins: MOONBRAND_PLUGINS,
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
  },
})) {
  console.log(JSON.stringify(message));
}
