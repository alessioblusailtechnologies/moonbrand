import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { ReferenceUploadResponse } from '@moonbrand/shared/api/contract';

import { ApiError } from '../../errors';
import { EXTENSIONS, parseImage, uploadSchema } from '../media/routes';
import { REFERENCES_DIR, type BrandFiles } from './files';

const brandParams = z.object({ brandId: z.uuid('Brand non valido.') });
const referenceParams = brandParams.extend({ name: z.string().regex(/^[A-Za-z0-9_-][A-Za-z0-9._-]*$/, 'File non valido.') });
const fileParams = brandParams.extend({ folder: z.string(), name: z.string() });
const fileQuery = z.object({ sig: z.string().min(1) });

export function registerBrandFileRoutes(app: FastifyInstance, files: BrandFiles): void {
  app.post('/v1/brands/:brandId/references', async (request): Promise<ReferenceUploadResponse> => {
    const { brandId } = brandParams.parse(request.params);
    const { bytes, mimeType } = parseImage(uploadSchema.parse(request.body).dataUri);
    await files.claim(brandId, request.identity.accountId);
    const path = `${REFERENCES_DIR}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
    await files.save(brandId, path, bytes);
    return { path, url: files.url(brandId, path) };
  });

  app.delete('/v1/brands/:brandId/references/:name', async (request, reply) => {
    const { brandId, name } = referenceParams.parse(request.params);
    await files.claim(brandId, request.identity.accountId);
    await files.remove(brandId, `${REFERENCES_DIR}/${name}`);
    return reply.code(204).send();
  });

  // Pubblica: un <img> non può mandare il token, il link è firmato.
  app.get('/v1/files/:brandId/:folder/:name', async (request, reply) => {
    const { brandId, folder, name } = fileParams.parse(request.params);
    const { sig } = fileQuery.parse(request.query);
    const path = `${folder}/${name}`;
    if (!files.verify(brandId, path, sig)) throw ApiError.notFound('File non trovato.');
    const { bytes, contentType } = await files.read(brandId, path);
    return reply.header('content-type', contentType).header('cache-control', 'private, max-age=3600').send(bytes);
  });
}
