import { mkdir, rename } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { exampleChannels, examplesPerChannel } from '@moonbrand/shared/domain/catalog';

import { photoTools } from '../tools/foto';
import { graphicsTools } from '../tools/renderizza';
import { visionTools } from '../tools/vista';
import { MODEL } from './model';

// Ogni generazione di esempi dell'onboarding ha la sua cartella, così due generazioni dello stesso brand non si
// sovrascrivono; una modifica riprende la sessione e lavora nella cartella della generazione da cui parte.
// L'API legge lo stesso percorso (examplesDir in moonbrand-api).
export function examplesDir(jobId: string): string {
  return `esempi/${jobId}`;
}

function examplesSchema(dir: string, chosen: ChannelId[]) {
  const channels = exampleChannels(chosen);
  const count = examplesPerChannel(channels) * channels.length;
  return {
    type: 'object',
    additionalProperties: false,
    required: ['examples'],
    properties: {
      examples: {
        type: 'array',
        minItems: count,
        maxItems: count,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['channel', 'file', 'caption'],
          properties: {
            channel: { type: 'string', enum: channels, description: 'Canale del post' },
            file: {
              type: 'string',
              pattern: `^${dir}/[A-Za-z0-9._-]+\\.(png|jpg)$`,
              description: `Immagine del post (PNG o JPEG), percorso relativo alla cartella del brand (es. ${dir}/instagram-1.png)`,
            },
            caption: { type: 'string', description: 'Il testo del post che accompagna l’immagine' },
          },
        },
      },
    },
  };
}

// Sessione Claude Code nella cartella del brand con renderizza e guarda; con resume riprende quella di una generazione precedente.
export async function runExamples(options: { brandDir: string; dir: string; channels: ChannelId[]; prompt: string; resume?: string }): Promise<void> {
  const { brandDir, dir, channels, prompt, resume } = options;
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai-nuovo-2.');
    process.exit(1);
  }
  const temp = path.join(brandDir, dir, 'tmp');
  await mkdir(temp, { recursive: true });

  // Gli esempi nascono solo da quello che dice il prompt, senza il CLAUDE.md del brand (che può avere lo stile e le
  // impaginazioni degli esempi scelti la volta prima): si sposta fuori dalla cartella per il job e si rimette dopo.
  const guide = path.join(brandDir, 'CLAUDE.md');
  const aside = path.join(path.dirname(path.resolve(brandDir)), `.${path.basename(brandDir)}.CLAUDE.md`);
  const moved = await rename(guide, aside).then(
    () => true,
    () => false,
  );
  const graphics = graphicsTools(brandDir);
  try {
    for await (const message of query({
      prompt,
      options: {
        model: MODEL,
        cwd: brandDir,
        env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
        mcpServers: { grafica: graphics.server, immagini: photoTools(brandDir, GEMINI_API_KEY), vista: visionTools(brandDir, GEMINI_API_KEY) },
        settingSources: [],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        outputFormat: { type: 'json_schema', schema: examplesSchema(dir, channels) },
        ...(resume && { resume }),
      },
    })) {
      console.log(JSON.stringify(message));
    }
  } finally {
    await graphics.close();
    if (moved) await rename(aside, guide).catch(() => undefined);
  }
}
