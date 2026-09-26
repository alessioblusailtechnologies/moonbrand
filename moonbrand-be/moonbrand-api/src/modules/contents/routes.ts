import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { ContentEditRequest, CreateContentRequest } from '@moonbrand/shared/api/contract';

import type { BrandFiles } from '../brand-files/files';
import { channelId } from '../brands/schemas';
import { changeContentStatus, createContent, editContent, getContent, listBrandContents, regenerateContent } from './service';

const ideaParams = z.object({ ideaId: z.uuid('Idea non trovata.') });
const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const contentParams = z.object({ contentId: z.uuid('Contenuto non trovato.') });

const createSchema = z.object({
  format: z.enum(['post', 'carousel', 'article']),
  channels: z.array(channelId).min(1, 'Scegli almeno un canale.').max(5),
}) satisfies z.ZodType<CreateContentRequest>;

const editSchema = z.object({
  instruction: z.string().trim().min(3, 'Scrivi cosa cambiare.').max(2000),
}) satisfies z.ZodType<ContentEditRequest>;

export function registerContentRoutes(app: FastifyInstance, pool: pg.Pool, files: BrandFiles): void {
  app.post('/v1/ideas/:ideaId/content', async (request, reply) => {
    const created = await createContent(pool, request.identity, ideaParams.parse(request.params).ideaId, createSchema.parse(request.body));
    return reply.code(202).send(created);
  });

  app.get('/v1/brands/:brandId/contents', (request) =>
    listBrandContents(pool, files, request.identity, brandParams.parse(request.params).brandId),
  );

  app.get('/v1/contents/:contentId', (request) => getContent(pool, files, request.identity, contentParams.parse(request.params).contentId));

  app.post('/v1/contents/:contentId/edit', async (request, reply) => {
    const job = await editContent(pool, request.identity, contentParams.parse(request.params).contentId, editSchema.parse(request.body).instruction);
    return reply.code(202).send(job);
  });

  app.post('/v1/contents/:contentId/regenerate', async (request, reply) => {
    const job = await regenerateContent(pool, request.identity, contentParams.parse(request.params).contentId);
    return reply.code(202).send(job);
  });

  app.post('/v1/contents/:contentId/approve', (request) =>
    changeContentStatus(pool, files, request.identity, contentParams.parse(request.params).contentId, 'approved'),
  );

  app.post('/v1/contents/:contentId/reopen', (request) =>
    changeContentStatus(pool, files, request.identity, contentParams.parse(request.params).contentId, 'draft'),
  );
}
