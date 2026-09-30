import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig, type Options } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { VIDEO_ASPECT, type ContentFormat } from '@moonbrand/shared/domain/content';

import { audioTools } from '../tools/audio';
import { frameTools } from '../tools/fotogrammi';
import { higgsfield, higgsfieldToken } from '../tools/higgsfield';
import { imageTools } from '../tools/immagini';
import { musicTools } from '../tools/musica';
import { visionTools } from '../tools/vista';
import { claudeModel } from './model';
import { MOONBRAND_PLUGINS } from './plugin';
import { prepareVideoProject } from './video';

// Le regole di scrittura e di stile stanno nelle skill moonbrand:contenuti e moonbrand:video (plugin/skills); qui i numeri
// che servono allo schema e al prompt del job.

// Le proporzioni della copertina di un post, per canale.
export const POST_ASPECT: Record<ChannelId, string> = { instagram: '4:5', facebook: '4:5', linkedin: '1:1', tiktok: '9:16', x: '16:9' };
export const CAROUSEL_ASPECT = '4:5';
export const ARTICLE_ASPECT = '1.91:1';
export const SLIDES = { min: 5, max: 7 };

export const videoAspects = (channels: readonly ChannelId[]) => [...new Set(channels.map((channel) => VIDEO_ASPECT[channel]))];

// I file che servono: una copertina per proporzione nel post, le slide nel carosello, una copertina nell'articolo,
// un video con la sua copertina per proporzione nel video.
export function neededFiles(format: ContentFormat, channels: readonly ChannelId[]): string {
  if (format === 'carousel') return `le slide del carosello, da ${SLIDES.min} a ${SLIDES.max}, tutte in ${CAROUSEL_ASPECT} (role «slide», index da 0)`;
  if (format === 'article') return `una copertina in ${ARTICLE_ASPECT} (role «cover», index 0)`;
  if (format === 'video') {
    return `per ogni proporzione (${videoAspects(channels).join(', ')}) il video in MP4 (role «video») e la sua copertina in JPEG (role «cover»), con lo stesso index, da 0`;
  }
  const aspects = [...new Set(channels.map((channel) => POST_ASPECT[channel]))];
  return `la copertina del post in ${aspects.join(', ')}: una per proporzione, con lo stesso visivo adattato (role «cover», index da 0)`;
}

export function contentDir(contentId: string): string {
  return `contenuti/${contentId}`;
}

const scenesSchema = {
  type: 'array',
  minItems: 1,
  description: 'Le inquadrature del copione, nell’ordine',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['seconds', 'shot', 'source', 'onScreen', 'voice'],
    properties: {
      seconds: { type: 'number', description: 'Quanto dura, in secondi' },
      shot: { type: 'string', description: 'Cosa si vede: soggetto, tipo di inquadratura, movimento di macchina' },
      source: {
        type: 'string',
        enum: ['clip', 'photo', 'user', 'graphics'],
        description: 'clip generata, foto generata, foto o clip dell’utente, solo grafica e testo',
      },
      onScreen: { type: 'string', description: 'Il testo a schermo; vuoto se non c’è' },
      voice: { type: 'string', description: 'La voce fuori campo in questa inquadratura; vuota se non c’è' },
    },
  },
};

const scriptSchema = { type: 'string', description: 'L’idea del video in breve: tono, ritmo, musica e voce' };

// Il copione di un video, prima di generarlo: niente testi per canale né file.
export function scriptOnlySchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'visual'],
    properties: {
      title: { type: 'string', description: 'Il titolo del contenuto in una frase' },
      visual: {
        type: 'object',
        additionalProperties: false,
        required: ['script', 'scenes'],
        properties: { script: scriptSchema, scenes: scenesSchema },
      },
    },
  };
}

export function contentSchema(contentId: string, format: ContentFormat, channels: ChannelId[]) {
  const carousel = format === 'carousel';
  const video = format === 'video';
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'variants', 'visual'],
    properties: {
      title: { type: 'string', description: 'Il titolo del contenuto in una frase' },
      variants: {
        type: 'array',
        minItems: channels.length,
        maxItems: channels.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['channel', 'text', 'hashtags'],
          properties: {
            channel: { type: 'string', enum: channels },
            text: { type: 'string', description: 'Il testo del post per questo canale, senza hashtag' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Gli hashtag, con # davanti' },
          },
        },
      },
      visual: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'slides', 'files', ...(video ? ['script', 'scenes'] : [])],
        properties: {
          headline: { type: 'string', description: 'Il titolo dell’immagine, della prima slide o del video; vuoto se non ha testo' },
          slides: {
            type: 'array',
            minItems: carousel ? SLIDES.min : 0,
            maxItems: carousel ? SLIDES.max : 0,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'body'],
              properties: { title: { type: 'string' }, body: { type: 'string' } },
            },
          },
          ...(video && { script: scriptSchema, scenes: scenesSchema }),
          files: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['file', 'role', 'index', 'aspect'],
              properties: {
                file: {
                  type: 'string',
                  pattern: `^${contentDir(contentId)}/[A-Za-z0-9._-]+\\.(png|jpg${video ? '|mp4' : ''})$`,
                  description: `Il file finale, percorso relativo alla cartella del brand (es. ${contentDir(contentId)}/${video ? 'video-9x16.mp4' : 'cover-4x5.png'})`,
                },
                role: { type: 'string', enum: video ? ['cover', 'video'] : ['cover', 'slide'] },
                index: { type: 'integer', minimum: 0, description: 'L’ordine: 0 per la prima copertina, slide o video' },
                aspect: { type: 'string', enum: ['4:5', '1:1', '9:16', '16:9', '1.91:1'] },
              },
            },
          },
        },
      },
    },
  };
}

// Claude Code nella cartella del brand, con i tool per immagini (e per i video: Higgsfield per le clip, Mureka per la musica,
// ElevenLabs per voce ed effetti);
// con resume riprende la sessione di prima. scriptOnly: il copione di un video, senza testi per canale né file.
export async function runContentAgent(options: {
  brandDir: string;
  contentId: string;
  format: ContentFormat;
  channels: ChannelId[];
  prompt: string;
  scriptOnly?: boolean;
  resume?: string;
}): Promise<void> {
  const { GEMINI_API_KEY, ELEVENLABS_API_KEY, MUREKA_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
    process.exit(1);
  }
  const temp = path.join(options.brandDir, contentDir(options.contentId), 'lavoro', 'tmp');
  await mkdir(temp, { recursive: true });

  const mcpServers: Record<string, McpServerConfig> = {
    immagini: imageTools(options.brandDir, GEMINI_API_KEY),
    vista: visionTools(options.brandDir, GEMINI_API_KEY),
  };
  let videoEnv: Record<string, string> = {};
  let clips: Pick<Options, 'disallowedTools' | 'hooks'> = {};
  if (options.format === 'video') {
    if (!ELEVENLABS_API_KEY) {
      console.error('Manca ELEVENLABS_API_KEY nel .env di moonbrand-ai.');
      process.exit(1);
    }
    mcpServers.audio = audioTools(options.brandDir, ELEVENLABS_API_KEY);
    mcpServers.video = frameTools(options.brandDir);
    if (MUREKA_API_KEY) mcpServers.musica = musicTools(options.brandDir, MUREKA_API_KEY);
    else console.error('Manca MUREKA_API_KEY nel .env di moonbrand-ai: il video si fa senza musica generata.');
    videoEnv = await prepareVideoProject(options.brandDir);
    // Le clip le gira Higgsfield; i suoi file arrivano nella cartella di lavoro del contenuto.
    const token = await higgsfieldToken();
    if (token) {
      const { server, disallowedTools, hooks } = higgsfield(token, options.brandDir, `${contentDir(options.contentId)}/lavoro/higgsfield`);
      mcpServers.higgsfield = server;
      clips = { disallowedTools, hooks };
    }
  }

  for await (const message of query({
    prompt: options.prompt,
    options: {
      ...claudeModel(),
      cwd: options.brandDir,
      env: { ...env, ...videoEnv, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers,
      ...clips,
      plugins: MOONBRAND_PLUGINS,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: {
        type: 'json_schema',
        schema: options.scriptOnly ? scriptOnlySchema() : contentSchema(options.contentId, options.format, options.channels),
      },
      ...(options.resume && { resume: options.resume }),
    },
  })) {
    console.log(JSON.stringify(message));
  }
}
