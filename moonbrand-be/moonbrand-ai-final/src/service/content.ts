import { access } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import type { ContentEditJobInput, ContentIdea, ContentJobInput, ContentVideoJobInput } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import {
  cleanHashtags,
  FORMAT_ASPECT,
  formatAspects,
  hasDocument,
  sortFiles,
  type ChannelVariant,
  type ContentFile,
  type ContentFormat,
  type ContentVisual,
  type SceneSource,
  type VideoScene,
} from '@moonbrand/shared/domain/content';

import { SLIDES } from '../prompts/content';
import { carouselDocument } from './document';

// Un contenuto nasce in due tempi: la proposta (cosa si farà, in breve; per un video il copione) con il consumo stimato,
// che l'utente legge e conferma nella sezione Contenuti, e poi il contenuto vero: i testi per canale e le immagini o il
// video. Qui le forme di tutti e due (gli schemi per Claude) e come si salvano sul DB.

export const FORMAT_NAME: Record<ContentFormat, string> = { post: 'post', carousel: 'carosello', article: 'articolo', video: 'video' };

export const SOURCE_NAME: Record<SceneSource, string> = {
  clip: 'clip generata',
  photo: 'foto generata',
  user: 'foto o video dell’utente',
  graphics: 'solo grafica e testo',
};

export const contentDir = (contentId: string) => `contenuti/${contentId}`;

export const channelList = (channels: readonly ChannelId[]) => channels.map((channel) => `${channelName(channel)} (${channel})`).join(', ');

// L'idea da cui nasce il contenuto, a parole.
export const ideaLines = (idea: ContentIdea) =>
  [idea.title, idea.angleLabel && `Taglio: ${idea.angleLabel}`, idea.angle && `Cosa raccontare: ${idea.angle}`, idea.rationale && `Perché adesso: ${idea.rationale}`, idea.theme && `Tema: ${idea.theme}`]
    .filter(Boolean)
    .join('\n');

// Le inquadrature di un copione, a parole.
export const sceneLines = (scenes: VideoScene[]) =>
  scenes
    .map((scene, index) =>
      [`${index + 1}. ${scene.seconds} s · ${SOURCE_NAME[scene.source] ?? scene.source}`, `   Si vede: ${scene.shot || '—'}`, `   A schermo: ${scene.onScreen || '—'}`, scene.voice && `   Voce: ${scene.voice}`]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n');

// I file che servono, nelle proporzioni dei canali (FORMAT_ASPECT): una copertina per proporzione nel post e nell'articolo,
// un giro di slide per proporzione nel carosello, un MP4 con la copertina per proporzione nel video. Due canali nella stessa
// proporzione con confezioni diverse hanno ciascuno i suoi file: quelli fatti apposta per un canale si salvano con channel.
export function neededFiles(format: ContentFormat, channels: readonly ChannelId[]): string {
  const aspects = formatAspects(format, channels);
  const shared = aspects.length < channels.filter((channel) => FORMAT_ASPECT[format][channel]).length;
  const own = shared ? '. Se due canali nella stessa proporzione vogliono confezioni diverse (per esempio TikTok accanto a Instagram), i file di quello con la sua confezione hanno channel' : '';
  if (format === 'carousel') {
    const rounds = aspects.length > 1 ? `, un giro per proporzione (${aspects.join(', ')}) con gli stessi index` : ` in ${aspects[0]}`;
    const pdf = hasDocument(format, channels) ? '. Per LinkedIn moonbrand riunisce da solo le slide 4:5 in un documento PDF: non farlo tu' : '';
    return `le slide del carosello, da ${SLIDES.min} a ${SLIDES.max}${rounds} (role «slide», index da 0)${pdf}${own}`;
  }
  if (format === 'video') {
    return `per ogni proporzione (${aspects.join(', ')}) il video in MP4 (role «video») e la sua copertina in PNG o JPEG (role «cover»), con lo stesso index, da 0${own}`;
  }
  const what = format === 'article' ? 'la copertina dell’articolo' : 'la copertina del post';
  return `${what} in ${aspects.join(', ')}: una per proporzione (role «cover», index da 0)${own}`;
}

const scenesSchema = {
  type: 'array',
  minItems: 1,
  maxItems: 40,
  description: 'Le inquadrature del copione, nell’ordine',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['seconds', 'shot', 'source', 'onScreen', 'voice'],
    properties: {
      seconds: { type: 'number', minimum: 0.5, description: 'Quanto dura, in secondi' },
      shot: { type: 'string', description: 'Cosa si vede: soggetto, tipo di inquadratura, movimento' },
      source: { type: 'string', enum: ['clip', 'photo', 'user', 'graphics'], description: 'clip generata, foto generata, foto o video dell’utente, solo grafica e testo' },
      onScreen: { type: 'string', description: 'Il testo a schermo; vuoto se non c’è' },
      voice: { type: 'string', description: 'La voce fuori campo in questa inquadratura; vuota se non c’è' },
    },
  },
};

// La proposta: il titolo e cosa si farà. Per un video anche le inquadrature.
export function proposalSchema(format: ContentFormat) {
  const video = format === 'video';
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'script', ...(video ? ['scenes'] : [])],
    properties: {
      title: { type: 'string', description: 'Il titolo del contenuto in una frase' },
      script: {
        type: 'string',
        description: video
          ? 'L’idea del video in breve: tono, ritmo, musica, cosa deve restare in testa a chi guarda'
          : 'Cosa farai, in poche righe che l’utente legge prima di confermare: l’idea del contenuto, il testo in breve, le immagini e come le impagini',
      },
      ...(video && { scenes: scenesSchema }),
    },
  };
}

const variantsSchema = (channels: ChannelId[]) => ({
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
});

// Il contenuto fatto: testi per canale, impaginazione e file finali.
export function contentSchema(contentId: string, format: ContentFormat, channels: ChannelId[]) {
  const carousel = format === 'carousel';
  const video = format === 'video';
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'variants', 'visual'],
    properties: {
      title: { type: 'string', description: 'Il titolo del contenuto in una frase' },
      variants: variantsSchema(channels),
      visual: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'slides', 'layout', 'files', ...(video ? ['script', 'scenes'] : [])],
        properties: {
          headline: { type: 'string', description: 'Il titolo dell’immagine, della prima slide o del video; vuoto se non ha testo' },
          layout: {
            type: 'string',
            description: 'L’impaginazione in una o due frasi, al massimo 500 caratteri: dove stanno foto, titolo, testo e logo, con quali colori. La leggono i contenuti dopo per variare.',
          },
          slides: {
            type: 'array',
            minItems: carousel ? SLIDES.min : 0,
            maxItems: carousel ? SLIDES.max : 0,
            items: { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } },
          },
          ...(video && {
            script: { type: 'string', description: 'L’idea del video in breve, com’è stato montato' },
            scenes: scenesSchema,
          }),
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
                aspect: { type: 'string', enum: formatAspects(format, channels), description: 'La proporzione: solo quelle dei canali del contenuto' },
                channel: { type: 'string', enum: channels, description: 'Solo per un file fatto apposta per un canale, nella sua confezione; senza, vale per tutti i canali con quella proporzione' },
              },
            },
          },
        },
      },
    },
  };
}

interface ProposalResult {
  title: string;
  script: string;
  scenes?: VideoScene[];
}

interface ContentResult {
  title: string;
  variants: ChannelVariant[];
  visual: { headline: string; slides?: { title: string; body: string }[]; script?: string; scenes?: VideoScene[]; layout?: string; files: ContentFile[] };
}

const cleanScenes = (scenes: VideoScene[]): VideoScene[] =>
  scenes.map((scene) => ({
    seconds: Math.max(0.5, Math.round(scene.seconds * 10) / 10),
    shot: scene.shot.trim(),
    source: scene.source,
    onScreen: scene.onScreen.trim(),
    voice: (scene.voice ?? '').trim(),
  }));

// La proposta va nella riga del contenuto: titolo, idea in breve, inquadrature (video) e consumo stimato in crediti; testi
// e file restano vuoti finché l'utente non conferma.
export async function saveProposal(pool: pg.Pool, input: ContentJobInput | ContentEditJobInput, result: unknown, estimate: number): Promise<void> {
  const { contentId, format, channels } = input;
  const written = result as ProposalResult;
  const scenes = format === 'video' ? cleanScenes(written.scenes ?? []) : [];
  if (format === 'video' && scenes.length === 0) throw new Error('il copione non ha inquadrature');
  const script = written.script.trim();
  if (!script) throw new Error('la proposta è vuota');
  const visual: ContentVisual = { headline: '', slides: [], script, scenes, design: null, estimate, files: [] };
  await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb, channels = $5 where id = $1', [
    contentId,
    written.title.trim().slice(0, 300) || 'Contenuto',
    '[]',
    JSON.stringify(visual),
    channels,
  ]);
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// Il contenuto fatto va nella sua riga, nella forma che legge anche lo studio. Qui valgono le regole che il modello
// potrebbe non rispettare: solo i canali richiesti, hashtag puliti e contati, solo i file che esistono davvero.
export async function saveContent(pool: pg.Pool, brandsDir: string, input: ContentEditJobInput | ContentVideoJobInput, result: unknown): Promise<void> {
  const { brandId, contentId, format, channels } = input;
  const brandDir = path.join(brandsDir, brandId);
  const dir = `${contentDir(contentId)}/`;
  const written = result as ContentResult;

  const variants: ChannelVariant[] = channels.flatMap((channel) => {
    const variant = written.variants.find((item) => item.channel === channel);
    return variant ? [{ channel, text: variant.text.trim(), hashtags: cleanHashtags(variant.hashtags, channel) }] : [];
  });
  if (variants.length === 0) throw new Error('nessuna variante di testo per i canali richiesti');

  const files: ContentFile[] = [];
  for (const file of written.visual.files) {
    if (!file.file.startsWith(dir) || file.file.includes('..')) continue;
    const channel = file.channel && channels.includes(file.channel) ? file.channel : undefined;
    if (await exists(path.join(brandDir, file.file))) files.push({ file: file.file, role: file.role, index: file.index, aspect: file.aspect, ...(channel && { channel }) });
  }
  if (files.length === 0) throw new Error('nessun file trovato nella cartella del contenuto');
  if (format === 'video' && !files.some((file) => file.role === 'video')) throw new Error('nessun video trovato nella cartella del contenuto');
  // Il documento PDF per LinkedIn lo fa moonbrand dalle slide.
  if (hasDocument(format, channels)) {
    const document = await carouselDocument(brandDir, files, `${dir}documento-linkedin.pdf`);
    if (document) files.push(document);
  }

  const visual: ContentVisual = {
    headline: written.visual.headline.trim(),
    slides: format === 'carousel' ? (written.visual.slides ?? []).slice(0, 10).map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })) : [],
    script: (written.visual.script ?? '').trim(),
    scenes: format === 'video' ? cleanScenes(written.visual.scenes ?? []) : [],
    design: null,
    ...(written.visual.layout?.trim() && { layout: written.visual.layout.trim() }),
    files: sortFiles(files),
  };
  await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb, channels = $5 where id = $1', [
    contentId,
    written.title.trim().slice(0, 300) || 'Contenuto',
    JSON.stringify(variants),
    JSON.stringify(visual),
    variants.map((variant) => variant.channel),
  ]);
}
