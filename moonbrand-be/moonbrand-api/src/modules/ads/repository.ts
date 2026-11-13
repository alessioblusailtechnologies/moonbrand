import type { Ad, AdConnection, AdDraft, AdMetrics, AdPlatform, AdStatus, SearchSpec } from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { Queryable } from '../../db/pool';

export interface ConnectionRow {
  id: string;
  account_id: string;
  brand_id: string;
  platform: AdPlatform;
  zernio_account_id: string;
  name: string | null;
  ad_account_id: string | null;
  ad_account_name: string | null;
  currency: string | null;
  lost: boolean;
}

export interface AdRow {
  id: string;
  account_id: string;
  brand_id: string;
  platform: AdPlatform;
  campaign_type: 'search';
  source: 'studio' | 'chat';
  name: string;
  goal: string;
  spec: SearchSpec;
  daily_budget: string;
  currency: string | null;
  starts_on: string;
  ends_on: string | null;
  status: AdStatus;
  ad_account_id: string | null;
  zernio_ad_id: string | null;
  platform_campaign_id: string | null;
  platform_ad_group_id: string | null;
  platform_ad_id: string | null;
  review_status: string | null;
  rejection_reason: string | null;
  metrics: AdMetrics | null;
  synced_at: Date | null;
  launched_at: Date | null;
  error: string | null;
  idempotency_key: string;
  created_at: Date;
  updated_at: Date;
}

// Le date come giorni, senza fuso: AAAA-MM-GG.
const AD_COLUMNS = `*, starts_on::text as starts_on, ends_on::text as ends_on`;

export const isSimulatedConnection = (row: Pick<ConnectionRow, 'zernio_account_id'>) => row.zernio_account_id.startsWith(SIMULATED_ACCOUNT);
export const isSimulatedAd = (row: Pick<AdRow, 'zernio_ad_id'>) => row.zernio_ad_id?.startsWith(SIMULATED_ACCOUNT) ?? false;

export function toConnection(row: ConnectionRow): AdConnection {
  return {
    platform: row.platform,
    name: row.name,
    adAccountId: row.ad_account_id,
    adAccountName: row.ad_account_name,
    currency: row.currency,
    lost: row.lost,
    simulated: isSimulatedConnection(row),
  };
}

export function toAd(row: AdRow): Ad {
  return {
    id: row.id,
    platform: row.platform,
    campaignType: row.campaign_type,
    source: row.source,
    name: row.name,
    spec: row.spec,
    dailyBudget: Number(row.daily_budget),
    currency: row.currency,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    reviewStatus: row.review_status,
    rejectionReason: row.rejection_reason,
    metrics: row.metrics,
    syncedAt: row.synced_at?.toISOString() ?? null,
    launchedAt: row.launched_at?.toISOString() ?? null,
    error: row.error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findConnection(db: Queryable, brandId: string, platform: AdPlatform): Promise<ConnectionRow | null> {
  const { rows } = await db.query<ConnectionRow>('select * from presenza.ad_connections where brand_id = $1 and platform = $2', [brandId, platform]);
  return rows[0] ?? null;
}

// Un collegamento nuovo (o un altro account al posto di quello di prima) riparte senza account pubblicitario scelto.
export async function saveConnection(
  db: Queryable,
  connection: { accountId: string; brandId: string; platform: AdPlatform; zernioAccountId: string; name: string | null },
): Promise<ConnectionRow> {
  const { rows } = await db.query<ConnectionRow>(
    `insert into presenza.ad_connections (account_id, brand_id, platform, zernio_account_id, name)
     values ($1, $2, $3, $4, $5)
     on conflict (brand_id, platform) do update set
       zernio_account_id = excluded.zernio_account_id, name = excluded.name, lost = false, updated_at = now(),
       ad_account_id = case when presenza.ad_connections.zernio_account_id = excluded.zernio_account_id then presenza.ad_connections.ad_account_id end,
       ad_account_name = case when presenza.ad_connections.zernio_account_id = excluded.zernio_account_id then presenza.ad_connections.ad_account_name end,
       currency = case when presenza.ad_connections.zernio_account_id = excluded.zernio_account_id then presenza.ad_connections.currency end
     returning *`,
    [connection.accountId, connection.brandId, connection.platform, connection.zernioAccountId, connection.name],
  );
  return rows[0]!;
}

export async function chooseAdAccount(
  db: Queryable,
  id: string,
  adAccount: { id: string; name: string; currency: string | null },
): Promise<ConnectionRow> {
  const { rows } = await db.query<ConnectionRow>(
    `update presenza.ad_connections set ad_account_id = $2, ad_account_name = $3, currency = $4, updated_at = now() where id = $1 returning *`,
    [id, adAccount.id, adAccount.name, adAccount.currency],
  );
  return rows[0]!;
}

export async function deleteConnection(db: Queryable, id: string): Promise<void> {
  await db.query('delete from presenza.ad_connections where id = $1', [id]);
}

export async function listAds(db: Queryable, brandId: string): Promise<AdRow[]> {
  const { rows } = await db.query<AdRow>(`select ${AD_COLUMNS} from presenza.ads where brand_id = $1 order by created_at desc`, [brandId]);
  return rows;
}

export async function findAd(db: Queryable, brandId: string, id: string): Promise<AdRow | null> {
  const { rows } = await db.query<AdRow>(`select ${AD_COLUMNS} from presenza.ads where brand_id = $1 and id = $2`, [brandId, id]);
  return rows[0] ?? null;
}

export async function insertDraft(
  db: Queryable,
  owner: { accountId: string; brandId: string },
  draft: AdDraft,
  source: 'studio' | 'chat',
): Promise<AdRow> {
  const { rows } = await db.query<AdRow>(
    `insert into presenza.ads (account_id, brand_id, platform, campaign_type, source, name, spec, daily_budget, starts_on, ends_on)
     values ($1, $2, 'google', 'search', $3, $4, $5, $6, $7, $8)
     returning ${AD_COLUMNS}`,
    [owner.accountId, owner.brandId, source, draft.name, JSON.stringify(draft.spec), draft.dailyBudget, draft.startsOn, draft.endsOn],
  );
  return rows[0]!;
}

// Si cambia solo una bozza (o una creazione fallita, che torna bozza): quello che è su Google non si tocca da qui.
export async function updateDraft(db: Queryable, id: string, draft: AdDraft): Promise<AdRow> {
  const { rows } = await db.query<AdRow>(
    `update presenza.ads set name = $2, spec = $3, daily_budget = $4, starts_on = $5, ends_on = $6, status = 'draft', error = null, detail = null,
       idempotency_key = gen_random_uuid(), updated_at = now()
     where id = $1 returning ${AD_COLUMNS}`,
    [id, draft.name, JSON.stringify(draft.spec), draft.dailyBudget, draft.startsOn, draft.endsOn],
  );
  return rows[0]!;
}

export async function deleteAdRow(db: Queryable, id: string): Promise<void> {
  await db.query('delete from presenza.ads where id = $1', [id]);
}

export interface AdPatch {
  status?: AdStatus;
  currency?: string | null;
  adAccountId?: string | null;
  zernioAdId?: string | null;
  platformCampaignId?: string | null;
  platformAdGroupId?: string | null;
  platformAdId?: string | null;
  reviewStatus?: string | null;
  rejectionReason?: string | null;
  metrics?: AdMetrics | null;
  synced?: boolean;
  launched?: boolean;
  error?: string | null;
  detail?: unknown;
}

const PATCH_COLUMNS: Record<Exclude<keyof AdPatch, 'synced' | 'launched'>, string> = {
  status: 'status',
  currency: 'currency',
  adAccountId: 'ad_account_id',
  zernioAdId: 'zernio_ad_id',
  platformCampaignId: 'platform_campaign_id',
  platformAdGroupId: 'platform_ad_group_id',
  platformAdId: 'platform_ad_id',
  reviewStatus: 'review_status',
  rejectionReason: 'rejection_reason',
  metrics: 'metrics',
  error: 'error',
  detail: 'detail',
};

export async function patchAd(db: Queryable, id: string, patch: AdPatch): Promise<AdRow> {
  const sets = ['updated_at = now()'];
  const values: unknown[] = [id];
  for (const [key, column] of Object.entries(PATCH_COLUMNS) as [keyof typeof PATCH_COLUMNS, string][]) {
    if (!(key in patch)) continue;
    const value = patch[key];
    values.push(key === 'metrics' || key === 'detail' ? (value == null ? null : JSON.stringify(value)) : value);
    sets.push(`${column} = $${values.length}`);
  }
  if (patch.synced) sets.push('synced_at = now()');
  if (patch.launched) sets.push('launched_at = now()');
  const { rows } = await db.query<AdRow>(`update presenza.ads set ${sets.join(', ')} where id = $1 returning ${AD_COLUMNS}`, values);
  return rows[0]!;
}

// Le campagne da rileggere: quelle su Google ancora vive. Lo scheduler gira con il pool, senza identità.
export async function liveAds(db: Queryable, olderThanMinutes: number, brandId?: string): Promise<AdRow[]> {
  const { rows } = await db.query<AdRow>(
    `select ${AD_COLUMNS} from presenza.ads
     where status in ('in_review', 'active', 'paused') and zernio_ad_id is not null
       and (synced_at is null or synced_at < now() - make_interval(mins => $1))
       and ($2::uuid is null or brand_id = $2::uuid)
     order by synced_at nulls first limit 200`,
    [olderThanMinutes, brandId ?? null],
  );
  return rows;
}
