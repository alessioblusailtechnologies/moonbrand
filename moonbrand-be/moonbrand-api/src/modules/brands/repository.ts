import type { BrandSummary } from '@moonbrand/shared/api/contract';
import type { BrandDraft, BrandKind, ChannelId } from '@moonbrand/shared/domain/brand';
import { DEFAULT_SUBSCRIPTION_PLAN, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import type { Queryable } from '../../db/pool';

interface SummaryRow {
  id: string;
  kind: BrandKind;
  name: string;
  logo_uri: string | null;
  color: string | null;
  lost_channels: ChannelId[];
}

const SUMMARY = `id, identity->>'kind' as kind, identity->>'name' as name, visual->>'logoUri' as logo_uri,
  visual->'palette'->'colors'->>0 as color,
  array(select key from jsonb_each(channels) where value->>'accountId' is not null and value->>'lost' = 'true') as lost_channels`;

const toSummary = (row: SummaryRow): BrandSummary => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  logoUri: row.logo_uri,
  color: row.color ?? '#2F3452',
  lostChannels: row.lost_channels ?? [],
});

export async function listBrandSummaries(db: Queryable, accountId: string): Promise<BrandSummary[]> {
  const { rows } = await db.query<SummaryRow>(`select ${SUMMARY} from presenza.brands where account_id = $1 order by created_at`, [
    accountId,
  ]);
  return rows.map(toSummary);
}

export async function brandExists(db: Queryable, brandId: string): Promise<boolean> {
  const { rowCount } = await db.query('select 1 from presenza.brands where id = $1', [brandId]);
  return (rowCount ?? 0) > 0;
}

// plan: quello scelto nell'onboarding; senza, vale quello di base della tabella.
export async function insertBrand(
  db: Queryable,
  accountId: string,
  brandId: string,
  draft: BrandDraft,
  plan?: SubscriptionPlanId,
): Promise<BrandSummary> {
  const { rows } = await db.query<SummaryRow>(
    `insert into presenza.brands (id, account_id, identity, positioning, channels, themes, voice, visual, refs, plan)
     values ($9, $1, $2::jsonb, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, coalesce($10, $11))
     returning ${SUMMARY}`,
    [
      accountId,
      JSON.stringify(draft.identity),
      JSON.stringify(draft.positioning),
      JSON.stringify(draft.channels),
      JSON.stringify(draft.themes),
      JSON.stringify(draft.voice),
      JSON.stringify(draft.visual),
      JSON.stringify(draft.references),
      brandId,
      plan ?? null,
      DEFAULT_SUBSCRIPTION_PLAN,
    ],
  );
  return toSummary(rows[0]);
}

export async function updateBrandPlan(db: Queryable, brandId: string, plan: SubscriptionPlanId): Promise<boolean> {
  const { rowCount } = await db.query('update presenza.brands set plan = $2 where id = $1', [brandId, plan]);
  return (rowCount ?? 0) > 0;
}

export async function findBrandDraft(db: Queryable, brandId: string): Promise<BrandDraft | null> {
  const { rows } = await db.query<BrandDraft>(
    'select identity, positioning, channels, themes, voice, visual, refs as "references" from presenza.brands where id = $1',
    [brandId],
  );
  return rows[0] ?? null;
}

export async function updateBrand(db: Queryable, brandId: string, draft: BrandDraft): Promise<BrandSummary | null> {
  const { rows } = await db.query<SummaryRow>(
    `update presenza.brands set identity = $2::jsonb, positioning = $3::jsonb, channels = $4::jsonb, themes = $5::jsonb,
       voice = $6::jsonb, visual = $7::jsonb, refs = $8::jsonb
     where id = $1
     returning ${SUMMARY}`,
    [
      brandId,
      JSON.stringify(draft.identity),
      JSON.stringify(draft.positioning),
      JSON.stringify(draft.channels),
      JSON.stringify(draft.themes),
      JSON.stringify(draft.voice),
      JSON.stringify(draft.visual),
      JSON.stringify(draft.references),
    ],
  );
  return rows[0] ? toSummary(rows[0]) : null;
}
