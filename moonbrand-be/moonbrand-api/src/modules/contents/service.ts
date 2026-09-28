import type pg from 'pg';

import type {
  ContentCreated,
  ContentEditJobInput,
  ContentIdea,
  ContentJobInput,
  ContentResponse,
  ContentScriptRequest,
  ContentSummary,
  ContentVideoJobInput,
  CreateContentRequest,
} from '@moonbrand/shared/api/contract';
import { hasScript, hasVideo, type Content, type ContentStatus } from '@moonbrand/shared/domain/content';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { insertJob } from '../ai/repository';
import type { BrandFiles } from '../brand-files/files';
import { findBrandForIdeas, findIdea, updateIdeaStatus } from '../ideas/repository';
import {
  activeContentJobs,
  bumpRevision,
  findContent,
  insertContent,
  lastContentSession,
  listContents,
  setContentScript,
  setContentStatus,
} from './repository';

// Il job del contenuto: il brand come lo vede l'AI e l'idea di partenza.
async function contentJobInput(db: Queryable, content: Pick<Content, 'id' | 'brandId' | 'ideaId' | 'title' | 'channels' | 'format'>) {
  const brand = await findBrandForIdeas(db, content.brandId);
  if (!brand) throw ApiError.notFound('Brand non trovato.');
  const idea = content.ideaId ? await findIdea(db, content.ideaId) : null;
  const theme = brand.themes.find((item) => item.id === idea?.themeId)?.name ?? null;
  const source: ContentIdea = idea
    ? { title: idea.title, angleLabel: idea.angleLabel, angle: idea.angle, rationale: idea.rationale, theme }
    : { title: content.title, angleLabel: '', angle: '', rationale: '', theme };
  const input: ContentJobInput = {
    brandId: content.brandId,
    contentId: content.id,
    format: content.format,
    channels: content.channels,
    brand: brand.context,
    idea: source,
  };
  return input;
}

// Crea la bozza e mette in coda il job che la scrive. Farne un contenuto salva l'idea.
export function createContent(pool: pg.Pool, identity: Identity, ideaId: string, request: CreateContentRequest): Promise<ContentCreated> {
  return withIdentity(pool, identity, async (db) => {
    const idea = await findIdea(db, ideaId);
    if (!idea) throw ApiError.notFound('Idea non trovata.');
    const brand = await findBrandForIdeas(db, idea.brandId);
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const channels = [...new Set(request.channels)];
    if (channels.some((channel) => !brand.context.channels.includes(channel))) {
      throw ApiError.invalid('Scegli tra i canali del brand.');
    }
    if (idea.status !== 'saved') await updateIdeaStatus(db, idea.id, 'saved');
    const id = await insertContent(db, {
      brandId: idea.brandId,
      accountId: identity.accountId,
      ideaId: idea.id,
      title: idea.title,
      themeId: idea.themeId,
      channels,
      format: request.format,
    });
    const input = await contentJobInput(db, { id, brandId: idea.brandId, ideaId: idea.id, title: idea.title, channels, format: request.format });
    const jobId = await insertJob(db, identity.accountId, 'content', input);
    return { id, jobId };
  });
}

// I link alle immagini cambiano a ogni aggiornamento: il browser non mostra quelle vecchie dalla cache.
export function withUrls(content: Content, files: BrandFiles): Content {
  const version = new Date(content.updatedAt).getTime();
  return {
    ...content,
    visual: {
      ...content.visual,
      files: (content.visual.files ?? []).map((file) => ({ ...file, url: `${files.url(content.brandId, file.file)}&v=${version}` })),
    },
  };
}

// Per le card: la prima copertina o la prima slide, e se un job ci sta lavorando.
export function summarize(content: Content, files: BrandFiles, preparing: boolean): ContentSummary {
  const cover = withUrls(content, files).visual.files?.find((file) => file.index === 0 && (file.role === 'cover' || file.role === 'slide'));
  return {
    id: content.id,
    title: content.title,
    format: content.format,
    channels: content.channels,
    status: content.status,
    coverUrl: cover?.url ?? null,
    coverAspect: cover?.aspect ?? null,
    updatedAt: content.updatedAt,
    preparing,
  };
}

export function listBrandContents(pool: pg.Pool, files: BrandFiles, identity: Identity, brandId: string): Promise<ContentSummary[]> {
  return withIdentity(pool, identity, async (db) => {
    const [contents, jobs] = await Promise.all([listContents(db, brandId), activeContentJobs(db, brandId)]);
    return contents.map((content) => summarize(content, files, jobs.has(content.id)));
  });
}

export function getContent(pool: pg.Pool, files: BrandFiles, identity: Identity, contentId: string): Promise<ContentResponse> {
  return withIdentity(pool, identity, async (db) => {
    const content = await findContent(db, contentId);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    const jobs = await activeContentJobs(db, content.brandId);
    return { content: withUrls(content, files), jobId: jobs.get(content.id) ?? null };
  });
}

// Un contenuto nato in chat si ritocca nella sua conversazione, dove Claude sa come l'ha fatto.
function requireOutsideChat(content: Content): void {
  if (content.conversationId) throw ApiError.conflict('IN_CHAT', 'Questo contenuto è nato in chat: ritoccalo nella sua conversazione.');
}

async function requireIdle(db: Queryable, content: Content): Promise<void> {
  if ((await activeContentJobs(db, content.brandId)).has(content.id)) {
    throw ApiError.conflict('BUSY', 'Sto già lavorando su questo contenuto: aspetta che finisca.');
  }
}

// Un ritocco riprende la sessione dell'ultima scrittura: Claude sa come ha fatto testi e immagini.
export function editContent(pool: pg.Pool, identity: Identity, contentId: string, instruction: string): Promise<{ jobId: string }> {
  return withIdentity(pool, identity, async (db) => {
    const content = await findContent(db, contentId);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    requireOutsideChat(content);
    await requireIdle(db, content);
    const sessionId = await lastContentSession(db, contentId);
    if (!sessionId) throw ApiError.conflict('NOT_EDITABLE', 'Questo contenuto non è ancora pronto da ritoccare.');
    const input: ContentEditJobInput = {
      brandId: content.brandId,
      contentId,
      sessionId,
      format: content.format,
      channels: content.channels,
      instruction,
      scriptOnly: content.format === 'video' && !hasVideo(content),
    };
    return { jobId: await insertJob(db, identity.accountId, 'content-edit', input) };
  });
}

// Da zero: una sessione nuova, e il contenuto torna bozza.
export function regenerateContent(pool: pg.Pool, identity: Identity, contentId: string): Promise<{ jobId: string }> {
  return withIdentity(pool, identity, async (db) => {
    const content = await findContent(db, contentId);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    requireOutsideChat(content);
    await requireIdle(db, content);
    const input = await contentJobInput(db, content);
    await bumpRevision(db, contentId);
    return { jobId: await insertJob(db, identity.accountId, 'content', input) };
  });
}

// Il copione corretto dall'utente: vale per il prossimo "Genera il video", e il contenuto torna bozza.
export function saveContentScript(
  pool: pg.Pool,
  files: BrandFiles,
  identity: Identity,
  contentId: string,
  request: ContentScriptRequest,
): Promise<Content> {
  return withIdentity(pool, identity, async (db) => {
    const content = await findContent(db, contentId);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    if (!hasScript(content)) throw ApiError.conflict('NO_SCRIPT', 'Questo contenuto non ha un copione.');
    requireOutsideChat(content);
    await requireIdle(db, content);
    const saved = await setContentScript(db, contentId, request.script.trim(), request.scenes);
    if (!saved) throw ApiError.notFound('Contenuto non trovato.');
    return withUrls(saved, files);
  });
}

// Il video dal copione com'è adesso sul DB, nella sessione che l'ha scritto: Claude sa perché ha scelto ogni inquadratura.
export function generateContentVideo(pool: pg.Pool, identity: Identity, contentId: string): Promise<{ jobId: string }> {
  return withIdentity(pool, identity, async (db) => {
    const content = await findContent(db, contentId);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    if (!hasScript(content)) throw ApiError.conflict('NO_SCRIPT', 'Prima serve il copione del video.');
    requireOutsideChat(content);
    await requireIdle(db, content);
    const sessionId = await lastContentSession(db, contentId);
    if (!sessionId) throw ApiError.conflict('NOT_EDITABLE', 'Il copione non è ancora pronto.');
    const input: ContentVideoJobInput = {
      brandId: content.brandId,
      contentId,
      sessionId,
      format: 'video',
      channels: content.channels,
      script: content.visual.script,
      scenes: content.visual.scenes,
    };
    return { jobId: await insertJob(db, identity.accountId, 'content-video', input) };
  });
}

export function changeContentStatus(
  pool: pg.Pool,
  files: BrandFiles,
  identity: Identity,
  contentId: string,
  status: ContentStatus,
): Promise<Content> {
  return withIdentity(pool, identity, async (db) => {
    const content = await setContentStatus(db, contentId, status);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    return withUrls(content, files);
  });
}
