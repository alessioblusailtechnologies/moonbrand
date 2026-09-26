import type pg from 'pg';

import type { AiJob, AiJobCreated, WebsiteJobRequest } from '@moonbrand/shared/api/contract';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import { findJob, insertJob } from './repository';

export function queueWebsiteJob(pool: pg.Pool, identity: Identity, request: WebsiteJobRequest): Promise<AiJobCreated> {
  return withIdentity(pool, identity, async (db) => ({ id: await insertJob(db, identity.accountId, 'website', request) }));
}

export function getJob(pool: pg.Pool, identity: Identity, jobId: string): Promise<AiJob> {
  return withIdentity(pool, identity, async (db) => {
    const job = await findJob(db, jobId);
    if (!job) throw ApiError.notFound('Lavoro non trovato.');
    return job;
  });
}
