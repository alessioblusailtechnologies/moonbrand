import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName, exampleChannels, examplesPerChannel } from '@moonbrand/shared/domain/catalog';
import { FORMAT_ASPECT } from '@moonbrand/shared/domain/content';

import { imageTools } from '../tools/immagini';
import { channelGuide } from './guides';

// Ogni generazione di esempi ha la sua cartella, così due generazioni dello stesso brand non si sovrascrivono;
// una modifica riprende la sessione e lavora nella cartella della generazione da cui parte.
export function examplesDir(jobId: string): string {
  return `esempi/${jobId}`;
}

// File di lavoro di Claude (HTML, script, foto intermedie): restano accanto agli esempi,
// così una modifica successiva li ritrova.
export function workDir(dir: string): string {
  return `${dir}/lavoro`;
}

// Come si presenta un post su ogni canale: la confezione della skill moonbrand:contenuti, in breve. Gli esempi la mostrano
// già nell'onboarding, e quelli scelti diventano i riferimenti del brand per il loro canale. I canali con una guida
// (plugin/skills/contenuti/canali) la prendono da lì, la stessa dei contenuti: qui c'è solo la riga di quelli senza.
const LOOK: Partial<Record<ChannelId, string>> = {
  instagram: 'curato ed editoriale, con la grafica del brand: palette, font, logo',
  facebook: 'come su Instagram, curato e con la grafica del brand',
  linkedin: 'sobrio e leggibile: un titolo chiaro, un concetto o un dato in primo piano, poca decorazione, il logo discreto',
  x: 'un messaggio solo, leggibile anche piccolo',
  pinterest:
    'un pin verticale da salvare: una foto bella e luminosa che occupa quasi tutto, un titolo grande e chiaro che dice cosa si ' +
    'trova (un\'idea, una guida, un prodotto), leggibile anche come miniatura, e il nome o il logo del brand piccolo in basso',
};

// Una riga per canale (proporzione del post e confezione), poi le guide dei canali che ce l'hanno.
export async function channelLooks(channels: readonly ChannelId[]): Promise<string> {
  const guides = await Promise.all(channels.map(async (channel) => ({ channel, guide: await channelGuide(channel) })));
  const lines = guides.map(
    ({ channel, guide }) => `- ${channelName(channel)}, in ${FORMAT_ASPECT.post[channel]}: ${guide ? 'segui la guida del canale qui sotto' : LOOK[channel]}.`,
  );
  // Gli esempi sono immagini ferme: della guida valgono le regole per una foto o una slide, non quelle del video.
  const sections = guides.flatMap(({ channel, guide }) =>
    guide
      ? [
          `## La guida di ${channelName(channel)}\n\nL'esempio è un'immagine ferma: prendi dalla guida quello che vale per una foto o una slide ` +
            `(riprese vere, testo come lo scrive l'app, niente grafiche montate né logo); durata, ritmo e audio valgono per i video.\n\n${guide}`,
        ]
      : [],
  );
  return [lines.join('\n'), ...sections].join('\n\n');
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

// Sessione Claude Code nella cartella del brand; con resume riprende quella di una generazione precedente.
export async function runExamples(options: { brandDir: string; dir: string; channels: ChannelId[]; prompt: string; resume?: string }) {
  const { brandDir, dir, channels, prompt, resume } = options;
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
    process.exit(1);
  }
  const temp = path.join(brandDir, workDir(dir), 'tmp');
  await mkdir(temp, { recursive: true });

  for await (const message of query({
    prompt,
    options: {
      cwd: brandDir,
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers: { immagini: imageTools(brandDir, GEMINI_API_KEY) },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: 'json_schema', schema: examplesSchema(dir, channels) },
      ...(resume && { resume }),
    },
  })) {
    console.log(JSON.stringify(message));
  }
}
