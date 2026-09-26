import type pg from 'pg';

import type { AiJob, AiJobCreated, VisualJobRequest, VisualReading, WebsiteJobRequest } from '@moonbrand/shared/api/contract';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { findJob, insertJob } from './repository';

export function queueWebsiteJob(pool: pg.Pool, identity: Identity, request: WebsiteJobRequest): Promise<AiJobCreated> {
  return withIdentity(pool, identity, async (db) => ({ id: await insertJob(db, identity.accountId, 'website', request) }));
}

export async function queueVisualJob(pool: pg.Pool, files: BrandFiles, identity: Identity, request: VisualJobRequest): Promise<AiJobCreated> {
  await files.claim(request.brandId, identity.accountId);
  return withIdentity(pool, identity, async (db) => ({ id: await insertJob(db, identity.accountId, 'visual', request) }));
}

export function getJob(pool: pg.Pool, files: BrandFiles, identity: Identity, jobId: string): Promise<AiJob> {
  return withIdentity(pool, identity, async (db) => {
    const found = await findJob(db, jobId);
    if (!found) throw ApiError.notFound('Lavoro non trovato.');
    return found.brandId ? withExampleUrls(found.job, found.brandId, files) : found.job;
  });
}

// Gli esempi stanno nella cartella del brand: il worker scrive il percorso, qui si firma il link.
function withExampleUrls(job: AiJob, brandId: string, files: BrandFiles): AiJob {
  const result = job.result as VisualReading | null;
  if (!result?.examples) return job;
  // Una rigenerazione riscrive gli stessi file: l'id del job nel link evita che il browser mostri quelli vecchi dalla cache.
  const url = (file: string) => `${files.url(brandId, file)}&v=${job.id}`;
  return { ...job, result: { examples: result.examples.map((example) => ({ ...example, url: url(example.file) })) } };
}
