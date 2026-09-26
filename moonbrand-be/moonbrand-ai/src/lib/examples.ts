import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';

import { imageTools } from '../tools/immagini';

export const PER_CHANNEL = 3;

// File di lavoro di Claude (HTML, script, foto intermedie): restano nella cartella del brand,
// così una modifica successiva li ritrova.
export const WORK_DIR = 'lavoro';

function examplesSchema(channels: ChannelId[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['examples'],
    properties: {
      examples: {
        type: 'array',
        minItems: PER_CHANNEL * channels.length,
        maxItems: PER_CHANNEL * channels.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['channel', 'file', 'caption'],
          properties: {
            channel: { type: 'string', enum: channels, description: 'Canale del post' },
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
}

// Sessione Claude Code nella cartella del brand; con resume riprende quella di una generazione precedente.
export async function runExamples({ brandDir, channels, prompt, resume }: { brandDir: string; channels: ChannelId[]; prompt: string; resume?: string }) {
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
    process.exit(1);
  }
  const temp = path.join(brandDir, WORK_DIR, 'tmp');
  await mkdir(temp, { recursive: true });

  for await (const message of query({
    prompt,
    options: {
      cwd: brandDir,
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers: { immagini: imageTools(brandDir, GEMINI_API_KEY) },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: 'json_schema', schema: examplesSchema(channels) },
      ...(resume && { resume }),
    },
  })) {
    console.log(JSON.stringify(message));
  }
}
