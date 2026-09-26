import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { WritableFormat } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';

import { imageTools } from '../tools/immagini';

// Regole di scrittura per canale e formato, riprese da social-app.

export const CHANNEL_GUIDE: Record<ChannelId, string> = {
  linkedin:
    'la prima riga deve fermare lo scorrimento; paragrafi brevi separati da una riga vuota; da 700 a 1.500 caratteri, fino a 2.900 per un articolo',
  instagram: 'didascalia da 300 a 900 caratteri con l’aggancio nella prima riga; per un carosello invita a scorrere',
  facebook: 'tono vicino e discorsivo, da 300 a 1.000 caratteri',
  tiktok: 'didascalia cortissima, una o due righe sotto i 150 caratteri',
  x: 'al massimo 250 caratteri, una sola idea',
};

export const HASHTAGS: Record<ChannelId, number> = { linkedin: 3, instagram: 6, facebook: 2, tiktok: 4, x: 2 };

// Le proporzioni della copertina di un post, per canale.
const POST_ASPECT: Record<ChannelId, string> = { instagram: '4:5', facebook: '4:5', linkedin: '1:1', tiktok: '9:16', x: '16:9' };
export const CAROUSEL_ASPECT = '4:5';
export const ARTICLE_ASPECT = '1.91:1';
export const SLIDES = { min: 5, max: 7 };

// Le immagini che servono: una copertina per proporzione nel post, le slide nel carosello, una copertina nell'articolo.
export function neededImages(format: WritableFormat, channels: readonly ChannelId[]): string {
  if (format === 'carousel') return `le slide del carosello, da ${SLIDES.min} a ${SLIDES.max}, tutte in ${CAROUSEL_ASPECT} (role «slide», index da 0)`;
  if (format === 'article') return `una copertina in ${ARTICLE_ASPECT} (role «cover», index 0)`;
  const aspects = [...new Set(channels.map((channel) => POST_ASPECT[channel]))];
  return `la copertina del post in ${aspects.join(', ')}: una per proporzione, con lo stesso visivo adattato (role «cover», index da 0)`;
}

export const FORMAT_GUIDE: Record<WritableFormat, string> = {
  post: 'Post: testo e un’immagine. headline è il titolo dell’immagine, fino a 60 caratteri, se l’immagine ne ha uno; slides resta vuoto.',
  carousel: `Carosello: da ${SLIDES.min} a ${SLIDES.max} slide. La prima è l’aggancio, le centrali sviluppano un punto ciascuna, l’ultima chiude con un’azione; titoli fino a 40 caratteri, testi fino a 160. headline è il titolo della prima slide.`,
  article:
    'Articolo: su LinkedIn il testo lungo, con un’apertura forte e tre o quattro paragrafi; sugli altri canali un testo breve che lo presenta. headline è il titolo dell’articolo; slides resta vuoto.',
};

export const WRITING_RULES = [
  'Scrivi in italiano semplice e concreto: niente gergo di marketing, niente frasi fatte, niente trattini lunghi.',
  'Segui la voce del brand alla lettera: se «Da evitare» nomina esclamativi o emoji, non usarne; se il lessico chiede i numeri in cifre, scrivi 3 e non tre.',
  'Non inventare fatti, numeri, prezzi, nomi di clienti o risultati: quando serve un dato che non conosci, metti il segnaposto tra parentesi quadre, per esempio [prezzo].',
  'Ogni canale ha la sua variante, scritta per quel canale e non copiata dalle altre.',
  'Gli hashtag stanno solo nel campo hashtags e mai nel testo: pochi e specifici, con # davanti e senza spazi.',
].join('\n');

export function contentDir(contentId: string): string {
  return `contenuti/${contentId}`;
}

export function contentSchema(contentId: string, format: WritableFormat, channels: ChannelId[]) {
  const carousel = format === 'carousel';
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
        required: ['headline', 'slides', 'files'],
        properties: {
          headline: { type: 'string', description: 'Il titolo dell’immagine o della prima slide; vuoto se l’immagine non ha testo' },
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
                  pattern: `^${contentDir(contentId)}/[A-Za-z0-9._-]+\\.(png|jpg)$`,
                  description: `L’immagine finale, percorso relativo alla cartella del brand (es. ${contentDir(contentId)}/cover-4x5.png)`,
                },
                role: { type: 'string', enum: ['cover', 'slide'] },
                index: { type: 'integer', minimum: 0, description: 'L’ordine: 0 per la prima copertina o la prima slide' },
                aspect: { type: 'string', enum: ['4:5', '1:1', '9:16', '16:9', '1.91:1'] },
              },
            },
          },
        },
      },
    },
  };
}

// Claude Code nella cartella del brand, con il tool delle immagini; con resume riprende la sessione di prima.
export async function runContentAgent(options: {
  brandDir: string;
  contentId: string;
  format: WritableFormat;
  channels: ChannelId[];
  prompt: string;
  resume?: string;
}): Promise<void> {
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
    process.exit(1);
  }
  const temp = path.join(options.brandDir, contentDir(options.contentId), 'lavoro', 'tmp');
  await mkdir(temp, { recursive: true });

  for await (const message of query({
    prompt: options.prompt,
    options: {
      cwd: options.brandDir,
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers: { immagini: imageTools(options.brandDir, GEMINI_API_KEY) },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: 'json_schema', schema: contentSchema(options.contentId, options.format, options.channels) },
      ...(options.resume && { resume: options.resume }),
    },
  })) {
    console.log(JSON.stringify(message));
  }
}
