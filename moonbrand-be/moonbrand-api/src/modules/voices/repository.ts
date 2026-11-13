import type { BrandVoiceKind } from '@moonbrand/shared/domain/voice';

import type { Queryable } from '../../db/pool';

export interface VoiceRow {
  id: string;
  kind: BrandVoiceKind;
  name: string;
  elevenlabs_voice_id: string;
  sample_path: string | null;
  preview_url: string | null;
  language: string | null;
  description: string | null;
  is_default: boolean;
  created_at: Date;
}

export interface NewVoice {
  accountId: string;
  brandId: string;
  kind: BrandVoiceKind;
  name: string;
  voiceId: string;
  samplePath?: string | null;
  previewUrl?: string | null;
  language?: string | null;
  description?: string | null;
  consent?: boolean;
}

export async function listVoices(db: Queryable, brandId: string): Promise<VoiceRow[]> {
  const { rows } = await db.query<VoiceRow>('select * from presenza.brand_voices where brand_id = $1 order by created_at', [brandId]);
  return rows;
}

export async function findVoice(db: Queryable, brandId: string, id: string): Promise<VoiceRow | null> {
  const { rows } = await db.query<VoiceRow>('select * from presenza.brand_voices where brand_id = $1 and id = $2', [brandId, id]);
  return rows[0] ?? null;
}

export async function countVoices(db: Queryable, brandId: string): Promise<number> {
  const { rows } = await db.query<{ count: string }>('select count(*) from presenza.brand_voices where brand_id = $1', [brandId]);
  return Number(rows[0]?.count ?? 0);
}

// La prima voce del brand diventa la predefinita.
export async function insertVoice(db: Queryable, voice: NewVoice): Promise<VoiceRow> {
  const { rows } = await db.query<VoiceRow>(
    `insert into presenza.brand_voices
       (account_id, brand_id, kind, name, elevenlabs_voice_id, sample_path, preview_url, language, description, consent_at, is_default)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, case when $10 then now() end,
       not exists (select 1 from presenza.brand_voices where brand_id = $2))
     returning *`,
    [
      voice.accountId,
      voice.brandId,
      voice.kind,
      voice.name,
      voice.voiceId,
      voice.samplePath ?? null,
      voice.previewUrl ?? null,
      voice.language ?? null,
      voice.description ?? null,
      voice.consent ?? false,
    ],
  );
  return rows[0]!;
}

export async function renameVoice(db: Queryable, brandId: string, id: string, name: string): Promise<void> {
  await db.query('update presenza.brand_voices set name = $3 where brand_id = $1 and id = $2', [brandId, id, name]);
}

// Una sola predefinita: prima si toglie alle altre, poi si dà a questa.
export async function setDefaultVoice(db: Queryable, brandId: string, id: string): Promise<void> {
  await db.query('update presenza.brand_voices set is_default = false where brand_id = $1 and is_default and id <> $2', [brandId, id]);
  await db.query('update presenza.brand_voices set is_default = true where brand_id = $1 and id = $2', [brandId, id]);
}

// Tolta la predefinita, lo diventa la più vecchia che resta.
export async function deleteVoice(db: Queryable, brandId: string, id: string): Promise<void> {
  await db.query('delete from presenza.brand_voices where brand_id = $1 and id = $2', [brandId, id]);
  await db.query(
    `update presenza.brand_voices set is_default = true
     where id = (select id from presenza.brand_voices where brand_id = $1 order by created_at limit 1)
       and not exists (select 1 from presenza.brand_voices where brand_id = $1 and is_default)`,
    [brandId],
  );
}
