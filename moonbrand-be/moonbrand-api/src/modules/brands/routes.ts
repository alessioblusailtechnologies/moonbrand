import type { FastifyInstance } from 'fastify';
import type pg from 'pg';

import { FOLLOW_DIR, type BrandFiles } from '../brand-files/files';
import { FIRST_IDEAS, queueIdeasJob } from '../ideas/service';
import { activeBrandSchema, createBrandSchema } from './schemas';
import { chooseActiveBrand, createBrand, listBrands } from './service';

export function registerBrandRoutes(app: FastifyInstance, pool: pg.Pool, files: BrandFiles): void {
  app.get('/v1/brands', (request) => listBrands(pool, request.identity));

  app.post('/v1/brands', async (request, reply) => {
    const body = createBrandSchema.parse(request.body);
    await files.claim(body.id, request.identity.accountId);
    const brand = await createBrand(pool, request.identity, body);
    // Il brand esiste già: se una copia non riesce lo si segnala nei log, senza far fallire la creazione.
    for (const example of body.referenceExamples ?? []) {
      const name = example.split('/').pop() ?? '';
      await files.copy(body.id, example, `${FOLLOW_DIR}/${name}`).catch((error: unknown) => {
        request.log.warn({ err: error, example }, 'esempio non copiato nei riferimenti da seguire');
      });
    }
    // Le prime idee partono subito, lato server: si preparano anche se chi ha creato il brand chiude la pagina.
    await queueIdeasJob(pool, request.identity, body.id, FIRST_IDEAS).catch((error: unknown) => {
      request.log.warn({ err: error }, 'prime idee non messe in coda');
    });
    return reply.code(201).send(brand);
  });

  app.put('/v1/me/active-brand', async (request, reply) => {
    const { brandId } = activeBrandSchema.parse(request.body);
    await chooseActiveBrand(pool, request.identity, brandId);
    return reply.code(204).send();
  });
}
