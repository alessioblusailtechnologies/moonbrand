import type pg from 'pg';

import type { BrandSummary } from '@moonbrand/shared/api/contract';
import type { BrandDraft, MediaFile, Visual } from '@moonbrand/shared/domain/brand';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import { setActiveBrand } from '../auth/accounts';
import { brandExists, insertBrand, listBrandSummaries } from './repository';

export function listBrands(pool: pg.Pool, identity: Identity): Promise<BrandSummary[]> {
  return withIdentity(pool, identity, (db) => listBrandSummaries(db, identity.accountId));
}

export function createBrand(pool: pg.Pool, identity: Identity, draft: BrandDraft): Promise<BrandSummary> {
  const stored: BrandDraft = { ...draft, visual: storableVisual(identity.accountId, draft.visual) };
  return withIdentity(pool, identity, async (db) => {
    const brand = await insertBrand(db, identity.accountId, stored);
    await setActiveBrand(db, identity.accountId, brand.id);
    return brand;
  });
}

export function chooseActiveBrand(pool: pg.Pool, identity: Identity, brandId: string): Promise<void> {
  return withIdentity(pool, identity, async (db) => {
    if (!(await brandExists(db, brandId))) throw ApiError.notFound('Brand non trovato.');
    await setActiveBrand(db, identity.accountId, brandId);
  });
}

function storableVisual(accountId: string, visual: Visual): Visual {
  const own = (file: MediaFile | null | undefined) => !file?.path || file.path.startsWith(`${accountId}/`);
  const unsigned = (file: MediaFile): MediaFile => (file.path ? { ...file, url: '' } : file);
  return {
    ...visual,
    ...(visual.references && { references: visual.references.filter(own).map(unsigned) }),
    ...(visual.examples && {
      examples: visual.examples
        .filter((example) => own(example.file) && own(example.photo))
        .map((example) => ({ ...example, file: example.file && unsigned(example.file), ...(example.photo && { photo: unsigned(example.photo) }) })),
    }),
    ...(visual.music && { music: visual.music.filter((track) => own(track.file)).map((track) => ({ ...track, file: unsigned(track.file) })) }),
    ...(visual.line?.band?.photo && {
      line: { ...visual.line, band: { ...visual.line.band, photo: own(visual.line.band.photo) ? unsigned(visual.line.band.photo) : null } },
    }),
  };
}
