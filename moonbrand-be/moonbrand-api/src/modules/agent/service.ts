import { randomUUID } from 'node:crypto';
import path from 'node:path';

import type pg from 'pg';

import type { AgentContentRequest, AgentContentSaved, AgentIdeaRequest } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { cleanHashtags, type ChannelVariant, type Content, type ContentFile, type ContentVisual } from '@moonbrand/shared/domain/content';
import type { Idea } from '@moonbrand/shared/domain/idea';

import { withIdentity } from '../../db/identity';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { activeContentJobs, findContent, insertChatContent, listContents, rewriteContent } from '../contents/repository';
import { findBrandForIdeas, insertIdea, listIdeas } from '../ideas/repository';
import type { AgentJob } from './repository';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);
const VIDEO_EXTENSIONS = new Set(['.mp4']);

const contentDir = (contentId: string) => `contenuti/${contentId}`;

const filesOf = (content: Content) =>
  (content.visual.files ?? []).map(({ file, role, index, aspect }) => ({ file, role, index, aspect }));

// Quello che Claude vede di un contenuto: testi e percorsi delle immagini nella cartella del brand.
function describe(content: Content, agent: AgentJob) {
  return {
    id: content.id,
    title: content.title,
    format: content.format,
    channels: content.channels,
    status: content.status,
    fromThisConversation: content.conversationId === agent.conversationId,
    updatedAt: content.updatedAt,
    variants: content.variants,
    headline: content.visual.headline,
    slides: content.visual.slides,
    script: content.visual.script,
    scenes: content.visual.scenes,
    layout: content.visual.layout ?? null,
    files: filesOf(content),
  };
}

export function listAgentContents(pool: pg.Pool, agent: AgentJob) {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) =>
    (await listContents(db, agent.brandId)).map((content) => {
      const { variants: _variants, slides: _slides, ...summary } = describe(content, agent);
      return summary;
    }),
  );
}

export function getAgentContent(pool: pg.Pool, agent: AgentJob, contentId: string) {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) => {
    const content = await findContent(db, contentId);
    if (!content || content.brandId !== agent.brandId) throw ApiError.notFound('Contenuto non trovato in questo brand.');
    return describe(content, agent);
  });
}

// Immagini e video finali vanno nella cartella del contenuto con un nome nuovo a ogni salvataggio:
// così la sorgente può essere anche un'immagine già del contenuto, senza sovrascriverla mentre si copia.
async function publishFiles(files: BrandFiles, brandId: string, contentId: string, requested: AgentContentRequest['files']): Promise<ContentFile[]> {
  const stamp = Date.now().toString(36);
  const taken = new Set<string>();
  const published: ContentFile[] = [];
  for (const item of requested) {
    const key = `${item.role}-${item.index}`;
    if (taken.has(key)) throw ApiError.invalid(`Due immagini con role «${item.role}» e index ${item.index}: ogni immagine ha il suo index.`);
    taken.add(key);
    const extension = path.extname(item.file).toLowerCase();
    if (item.role === 'video' && !VIDEO_EXTENSIONS.has(extension)) throw ApiError.invalid(`${item.file}: il video va in MP4.`);
    if (item.role !== 'video' && !IMAGE_EXTENSIONS.has(extension)) throw ApiError.invalid(`${item.file}: servono immagini PNG o JPEG.`);
    const target = `${contentDir(contentId)}/${key}-${stamp}${extension === '.jpeg' ? '.jpg' : extension}`;
    await files.copy(brandId, item.file, target).catch((error: unknown) => {
      throw error instanceof ApiError
        ? ApiError.invalid(`${item.file}: percorso non valido, usa un percorso relativo alla cartella del brand.`)
        : ApiError.invalid(`Non trovo ${item.file} nella cartella del brand.`);
    });
    published.push({ file: target, role: item.role, index: item.index, aspect: item.aspect });
  }
  const order = { cover: 0, slide: 1, video: 2 };
  return published.sort((a, b) => (a.role === b.role ? a.index - b.index : order[a.role] - order[b.role]));
}

// Le regole che valgono anche per i job dei contenuti: solo i canali del brand, una variante per canale,
// hashtag puliti e contati, le immagini giuste per il formato; un video ha la sua copertina in ogni proporzione.
function check(request: AgentContentRequest, brandChannels: readonly string[]): ChannelVariant[] {
  const channels = [...new Set(request.channels)];
  const outside = channels.filter((channel) => !brandChannels.includes(channel));
  if (outside.length > 0) throw ApiError.invalid(`${outside.map(channelName).join(', ')}: non sono tra i canali del brand (${brandChannels.join(', ')}).`);
  const variants = channels.map((channel) => {
    const variant = request.variants.find((item) => item.channel === channel);
    if (!variant) throw ApiError.invalid(`Manca il testo per ${channelName(channel)}.`);
    return { channel, text: variant.text.trim(), hashtags: cleanHashtags(variant.hashtags, channel) };
  });
  const slides = request.files.filter((file) => file.role === 'slide').length;
  if (request.format === 'carousel' && slides < 2) throw ApiError.invalid('Un carosello ha almeno 2 immagini con role «slide».');
  if (request.format !== 'carousel' && !request.files.some((file) => file.role === 'cover')) {
    throw ApiError.invalid('Serve almeno un’immagine con role «cover».');
  }
  const videos = request.files.filter((file) => file.role === 'video');
  if (request.format === 'video') {
    if (videos.length === 0) throw ApiError.invalid('Un video ha almeno un file MP4 con role «video».');
    const missing = videos.filter((video) => !request.files.some((file) => file.role === 'cover' && file.aspect === video.aspect));
    if (missing.length > 0) throw ApiError.invalid(`Manca la copertina per il video in ${missing.map((video) => video.aspect).join(', ')}.`);
  } else if (videos.length > 0) {
    throw ApiError.invalid('I file con role «video» vanno solo nel formato video.');
  }
  return variants;
}

function visualOf(request: AgentContentRequest, files: ContentFile[]): ContentVisual {
  return {
    headline: request.headline.trim(),
    slides: request.format === 'carousel' ? request.slides.map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })) : [],
    script: request.format === 'video' ? (request.script ?? '').trim() : '',
    scenes: request.format === 'video' ? (request.scenes ?? []) : [],
    design: null,
    ...(request.layout?.trim() && { layout: request.layout.trim() }),
    files,
  };
}

// Un contenuto nuovo entra subito tra i Contenuti, come bozza, legato alla conversazione.
export function createAgentContent(pool: pg.Pool, files: BrandFiles, agent: AgentJob, request: AgentContentRequest): Promise<AgentContentSaved> {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) => {
    const brand = await findBrandForIdeas(db, agent.brandId);
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const variants = check(request, brand.context.channels);
    const id = randomUUID();
    const published = await publishFiles(files, agent.brandId, id, request.files);
    const title = request.title.trim();
    await insertChatContent(db, {
      id,
      brandId: agent.brandId,
      accountId: agent.accountId,
      conversationId: agent.conversationId,
      title,
      channels: variants.map((variant) => variant.channel),
      format: request.format,
      variants,
      visual: visualOf(request, published),
    });
    return { id, title, files: published.map((file) => file.file) };
  });
}

// Riscrive tutto il contenuto, che torna bozza; le immagini che non servono più si tolgono dalla cartella.
export function updateAgentContent(
  pool: pg.Pool,
  files: BrandFiles,
  agent: AgentJob,
  contentId: string,
  request: AgentContentRequest,
): Promise<AgentContentSaved> {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) => {
    const content = await findContent(db, contentId);
    if (!content || content.brandId !== agent.brandId) throw ApiError.notFound('Contenuto non trovato in questo brand.');
    if ((await activeContentJobs(db, agent.brandId)).has(contentId)) {
      throw ApiError.conflict('BUSY', 'Un altro lavoro sta preparando questo contenuto: riprova quando ha finito.');
    }
    const brand = await findBrandForIdeas(db, agent.brandId);
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const variants = check(request, brand.context.channels);
    const published = await publishFiles(files, agent.brandId, contentId, request.files);
    const title = request.title.trim();
    await rewriteContent(db, {
      id: contentId,
      title,
      channels: variants.map((variant) => variant.channel),
      format: request.format,
      variants,
      visual: visualOf(request, published),
    });
    const kept = new Set(published.map((file) => file.file));
    for (const old of content.visual.files ?? []) {
      if (!kept.has(old.file)) await files.remove(agent.brandId, old.file).catch(() => undefined);
    }
    return { id: contentId, title, files: published.map((file) => file.file) };
  });
}

export function listAgentIdeas(pool: pg.Pool, agent: AgentJob) {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) => {
    const [ideas, brand] = await Promise.all([listIdeas(db, agent.brandId), findBrandForIdeas(db, agent.brandId)]);
    const theme = (idea: Idea) => brand?.themes.find((item) => item.id === idea.themeId)?.name ?? null;
    return ideas.map((idea) => ({
      id: idea.id,
      title: idea.title,
      angleLabel: idea.angleLabel,
      angle: idea.angle,
      rationale: idea.rationale,
      theme: theme(idea),
      status: idea.status,
      createdAt: idea.createdAt,
    }));
  });
}

// Un'idea dalla chat finisce tra le Idee da decidere, come quelle che arrivano dal job.
export function createAgentIdea(pool: pg.Pool, agent: AgentJob, request: AgentIdeaRequest): Promise<{ id: string; title: string }> {
  return withIdentity(pool, { accountId: agent.accountId }, async (db) => {
    const [ideas, brand] = await Promise.all([listIdeas(db, agent.brandId), findBrandForIdeas(db, agent.brandId)]);
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const title = request.title.trim();
    if (ideas.some((idea) => idea.title.trim().toLowerCase() === title.toLowerCase())) {
      throw ApiError.conflict('DUPLICATE', 'C’è già un’idea con questo titolo.');
    }
    const themeId = brand.themes.some((theme) => theme.id === request.themeId) ? request.themeId : null;
    const idea = await insertIdea(db, agent.brandId, agent.accountId, {
      title,
      angleLabel: request.angleLabel.trim(),
      angle: request.angle.trim(),
      rationale: request.rationale.trim(),
      themeId,
      signal: { kind: 'prompt', label: 'Dalla chat' },
      formats: [],
      channels: [],
    });
    return { id: idea.id, title: idea.title };
  });
}
