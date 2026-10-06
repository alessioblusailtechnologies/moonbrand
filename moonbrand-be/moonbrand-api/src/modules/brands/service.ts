import type pg from 'pg';

import type { BrandProfile, BrandSummary, CreateBrandRequest, UpdateBrandRequest, VideoSetupJobInput } from '@moonbrand/shared/api/contract';
import type { BrandDraft, Channels, MediaFile, Visual } from '@moonbrand/shared/domain/brand';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import { insertJob } from '../ai/repository';
import { REFERENCES_DIR, type BrandFiles } from '../brand-files/files';
import { setActiveBrand } from '../auth/accounts';
import type { MediaStorage } from '../media/storage';
import { brandExists, findBrandDraft, insertBrand, listBrandSummaries, updateBrand } from './repository';
import { queueStyleJob } from './style';

export function listBrands(pool: pg.Pool, identity: Identity): Promise<BrandSummary[]> {
  return withIdentity(pool, identity, (db) => listBrandSummaries(db, identity.accountId));
}

// connected: i canali collegati nell'onboarding, già verificati su Zernio.
export function createBrand(
  pool: pg.Pool,
  identity: Identity,
  { id, referenceExamples: _examples, ...draft }: CreateBrandRequest,
  connected: Partial<Channels> = {},
): Promise<BrandSummary> {
  const stored: BrandDraft = {
    ...draft,
    channels: { ...connectionsFrom(draft.channels, null), ...connected },
    visual: storableVisual(identity.accountId, draft.visual),
  };
  return withIdentity(pool, identity, async (db) => {
    const brand = await insertBrand(db, identity.accountId, id, stored);
    await setActiveBrand(db, identity.accountId, brand.id);
    return brand;
  });
}

export async function getBrandProfile(
  pool: pg.Pool,
  files: BrandFiles,
  storage: MediaStorage,
  identity: Identity,
  brandId: string,
): Promise<BrandProfile> {
  const draft = await withIdentity(pool, identity, (db) => findBrandDraft(db, brandId));
  if (!draft) throw ApiError.notFound('Brand non trovato.');
  // I file di riferimento stanno nella cartella del brand, le altre immagini nello storage dell'account.
  const sign = (path: string) => (path.startsWith(`${REFERENCES_DIR}/`) ? Promise.resolve(files.url(brandId, path)) : storage.sign(path));
  return { id: brandId, draft: { ...draft, visual: await signedVisual(draft.visual, sign) } };
}

export async function saveBrand(
  pool: pg.Pool,
  identity: Identity,
  brandId: string,
  { referenceExamples: _examples, ...draft }: UpdateBrandRequest,
): Promise<{ brand: BrandSummary; referencesChanged: boolean }> {
  return withIdentity(pool, identity, async (db) => {
    const before = await findBrandDraft(db, brandId);
    if (!before) throw ApiError.notFound('Brand non trovato.');
    const stored: BrandDraft = { ...draft, channels: connectionsFrom(draft.channels, before.channels), visual: storableVisual(identity.accountId, draft.visual) };
    const brand = await updateBrand(db, brandId, stored);
    if (!brand) throw ApiError.notFound('Brand non trovato.');
    const paths = (visual: Visual) => (visual.references ?? []).map((file) => file.path).sort().join('\n');
    return { brand, referencesChanged: paths(before.visual) !== paths(stored.visual) };
  });
}

// Lo stile si rilegge dopo che i riferimenti sono al loro posto (vedi queueStyleJob).
export function restyleBrand(pool: pg.Pool, identity: Identity, brandId: string, free = false): Promise<string> {
  return withIdentity(pool, identity, (db) => queueStyleJob(db, identity.accountId, brandId, free));
}

// Il progetto video del brand nuovo si prepara subito, insieme a stile e prime idee: il primo messaggio in chat non lo aspetta.
export function queueVideoSetup(pool: pg.Pool, identity: Identity, brandId: string): Promise<string> {
  return withIdentity(pool, identity, (db) => insertJob(db, identity.accountId, 'video-setup', { brandId } satisfies VideoSetupJobInput, { free: true }));
}

export function chooseActiveBrand(pool: pg.Pool, identity: Identity, brandId: string): Promise<void> {
  return withIdentity(pool, identity, async (db) => {
    if (!(await brandExists(db, brandId))) throw ApiError.notFound('Brand non trovato.');
    await setActiveBrand(db, identity.accountId, brandId);
  });
}

// Dei canali il client sceglie solo quali usare: account e handle sono quelli collegati davvero (modulo social),
// quindi restano quelli salvati; un brand nuovo non ne ha ancora.
function connectionsFrom(channels: Channels, saved: Channels | null): Channels {
  const result = { ...channels };
  for (const id of Object.keys(result) as (keyof Channels)[]) {
    const connected = saved?.[id]?.accountId ? saved[id] : null;
    result[id] = {
      selected: channels[id].selected,
      handle: connected?.handle ?? null,
      accountId: connected?.accountId ?? null,
      board: connected?.board ?? null,
    };
  }
  return result;
}

function storableVisual(accountId: string, visual: Visual): Visual {
  const own = (file: MediaFile | null | undefined) =>
    !file?.path || file.path.startsWith(`${accountId}/`) || file.path.startsWith(`${REFERENCES_DIR}/`);
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

// Salvati, i link sono vuoti: si firmano a ogni lettura. Un file che non si firma resta senza link.
async function signedVisual(visual: Visual, sign: (path: string) => Promise<string>): Promise<Visual> {
  const signed = async (file: MediaFile): Promise<MediaFile> => (file.path ? { ...file, url: await sign(file.path).catch(() => '') } : file);
  return {
    ...visual,
    ...(visual.references && { references: await Promise.all(visual.references.map(signed)) }),
    ...(visual.examples && {
      examples: await Promise.all(
        visual.examples.map(async (example) => ({
          ...example,
          file: example.file && (await signed(example.file)),
          ...(example.photo && { photo: await signed(example.photo) }),
        })),
      ),
    }),
    ...(visual.music && { music: await Promise.all(visual.music.map(async (track) => ({ ...track, file: await signed(track.file) }))) }),
    ...(visual.line?.band?.photo && {
      line: { ...visual.line, band: { ...visual.line.band, photo: await signed(visual.line.band.photo) } },
    }),
  };
}
