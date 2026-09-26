import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

import { activeBrandSchema, brandDraftSchema } from './schemas';
import { chooseActiveBrand, createBrand, listBrands } from './service';

export function registerBrandRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.get('/v1/brands', (request) => listBrands(pool, request.identity));

  app.post('/v1/brands', async (request, reply) => {
    const brand = await createBrand(pool, request.identity, brandDraftSchema.parse(request.body));
    return reply.code(201).send(brand);
  });

  app.put('/v1/me/active-brand', async (request, reply) => {
    const { brandId } = activeBrandSchema.parse(request.body);
    await chooseActiveBrand(pool, request.identity, brandId);
    return reply.code(204).send();
  });
}
