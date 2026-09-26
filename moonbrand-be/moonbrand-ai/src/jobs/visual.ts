import { rm } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { imageTools } from '../tools/immagini';

const [brandDir, brandJson] = process.argv.slice(2);
if (!brandDir || !brandJson) {
  console.error('Uso: npm run visual -- <cartella del brand> <contesto del brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as VisualBrandContext;

const { GEMINI_API_KEY, ...claudeEnv } = process.env;
if (!GEMINI_API_KEY) {
  console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
  process.exit(1);
}
const PER_CHANNEL = 3;
const channels = brand.channels.map((id) => `${channelName(id)} (${id})`).join(', ');

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['examples'],
  properties: {
    examples: {
      type: 'array',
      minItems: PER_CHANNEL * brand.channels.length,
      maxItems: PER_CHANNEL * brand.channels.length,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['channel', 'file', 'caption'],
        properties: {
          channel: { type: 'string', enum: brand.channels, description: 'Canale del post' },
          file: {
            type: 'string',
            pattern: '^esempi/[A-Za-z0-9._-]+\\.(png|jpg)$',
            description: 'Immagine del post (PNG o JPEG), percorso relativo alla cartella del brand (es. esempi/instagram-1.png)',
          },
          caption: { type: 'string', description: 'Il testo del post che accompagna l’immagine' },
        },
      },
    },
  },
};

await rm(path.join(brandDir, 'esempi'), { recursive: true, force: true });

const prompt = `Crea ${PER_CHANNEL} esempi di post per ciascuno di questi canali: ${channels}.
Ispirati alle immagini di riferimento nella cartella file-riferimento e salva ogni esempio come immagine nella cartella esempi.
Rispondi in italiano.

Il brand:
${JSON.stringify(brand, null, 2)}`;

for await (const message of query({
  prompt,
  options: {
    cwd: brandDir,
    env: claudeEnv,
    mcpServers: { immagini: imageTools(brandDir, GEMINI_API_KEY) },
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    outputFormat: { type: 'json_schema', schema },
  },
})) {
  console.log(JSON.stringify(message));
}
