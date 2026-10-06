import type pg from 'pg';

import type {
  AiJob,
  AiJobCreated,
  VisualEditJobInput,
  VisualEditJobRequest,
  VisualJobRequest,
  VisualReading,
  WebsiteJobRequest,
} from '@moonbrand/shared/api/contract';
import { exampleChannels } from '@moonbrand/shared/domain/catalog';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { findExamplesJob, findJob, insertJob, isDraftBrand } from './repository';

// Quello che si fa su un brand ancora in bozza è l'onboarding, e non scala crediti. La bozza dev'essere dell'account:
// lo controlla claim prima, così un brand di altri non passa per una bozza.
async function onboarding(files: BrandFiles, identity: Identity, db: Queryable, brandId: string | undefined): Promise<boolean> {
  if (!brandId) return false;
  await files.claim(brandId, identity.accountId);
  return isDraftBrand(db, brandId);
}

export function queueWebsiteJob(pool: pg.Pool, files: BrandFiles, identity: Identity, request: WebsiteJobRequest): Promise<AiJobCreated> {
  const { brandId, ...input } = request;
  return withIdentity(pool, identity, async (db) => {
    const free = await onboarding(files, identity, db, brandId);
    return { id: await insertJob(db, identity.accountId, 'website', input, { free }) };
  });
}

export async function queueVisualJob(pool: pg.Pool, files: BrandFiles, identity: Identity, request: VisualJobRequest): Promise<AiJobCreated> {
  // Gli esempi sono solo per i primi canali scelti: il job ricorda quelli, e una modifica lavora sugli stessi.
  const input: VisualJobRequest = { ...request, brand: { ...request.brand, channels: exampleChannels(request.brand.channels) } };
  return withIdentity(pool, identity, async (db) => {
    const free = await onboarding(files, identity, db, request.brandId);
    return { id: await insertJob(db, identity.accountId, 'visual', input, { free }) };
  });
}

export async function queueVisualEditJob(pool: pg.Pool, files: BrandFiles, identity: Identity, request: VisualEditJobRequest): Promise<AiJobCreated> {
  const previous = await withIdentity(pool, identity, (db) => findExamplesJob(db, request.jobId));
  if (!previous?.brandId || !previous.channels) throw ApiError.notFound('Esempi non trovati.');
  if (previous.status !== 'done' || !previous.sessionId) throw ApiError.conflict('NOT_EDITABLE', 'Questi esempi non sono ancora pronti da modificare.');
  const input: VisualEditJobInput = {
    brandId: previous.brandId,
    dir: previous.dir,
    sessionId: previous.sessionId,
    channels: previous.channels,
    instruction: request.instruction,
    fromJobId: request.jobId,
  };
  return withIdentity(pool, identity, async (db) => {
    const free = await onboarding(files, identity, db, input.brandId);
    return { id: await insertJob(db, identity.accountId, 'visual-edit', input, { free }) };
  });
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
