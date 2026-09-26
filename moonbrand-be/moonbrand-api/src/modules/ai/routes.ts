import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

import { jobParamsSchema, websiteJobSchema } from './schemas';
import { getJob, queueWebsiteJob } from './service';

export function registerAiRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post('/v1/ai/website', async (request, reply) => {
    const job = await queueWebsiteJob(pool, request.identity, websiteJobSchema.parse(request.body));
    return reply.code(202).send(job);
  });

  app.get('/v1/ai/jobs/:id', (request) => getJob(pool, request.identity, jobParamsSchema.parse(request.params).id));
}
