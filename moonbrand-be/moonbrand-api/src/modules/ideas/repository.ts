import type { BrandContext } from '@moonbrand/shared/api/contract';
import {
  currentVoiceCard,
  type ChannelId,
  type Channels,
  type Identity,
  type Positioning,
  type Theme,
  type Voice,
} from '@moonbrand/shared/domain/brand';
import type { Idea, IdeaDraft, IdeaStatus } from '@moonbrand/shared/domain/idea';

import type { Queryable } from '../../db/pool';

interface IdeaRow {
  id: string;
  brand_id: string;
  title: string;
  angle_label: string;
  angle: string;
  rationale: string;
  theme_id: string | null;
  signal: Idea['signal'];
  formats: Idea['formats'];
  channels: ChannelId[];
  status: IdeaStatus;
  decided_at: Date | null;
  created_at: Date;
}

const COLUMNS = 'id, brand_id, title, angle_label, angle, rationale, theme_id, signal, formats, channels, status, decided_at, created_at';

const toIdea = (row: IdeaRow): Idea => ({
  id: row.id,
  brandId: row.brand_id,
  title: row.title,
  angleLabel: row.angle_label,
  angle: row.angle,
  rationale: row.rationale,
  themeId: row.theme_id,
  signal: row.signal,
  formats: row.formats,
  channels: row.channels,
  status: row.status,
  decidedAt: row.decided_at?.toISOString() ?? null,
  createdAt: row.created_at.toISOString(),
});

export async function listIdeas(db: Queryable, brandId: string): Promise<Idea[]> {
  const { rows } = await db.query<IdeaRow>(`select ${COLUMNS} from presenza.ideas where brand_id = $1 order by created_at desc`, [brandId]);
  return rows.map(toIdea);
}

export async function updateIdeaStatus(db: Queryable, ideaId: string, status: IdeaStatus): Promise<Idea | null> {
  const { rows } = await db.query<IdeaRow>(
    `update presenza.ideas set status = $2, decided_at = case when $2 = 'new' then null else now() end
     where id = $1 returning ${COLUMNS}`,
    [ideaId, status],
  );
  return rows[0] ? toIdea(rows[0]) : null;
}

export interface BrandForIdeas {
  context: BrandContext;
  themes: Theme[];
}

export async function findBrandForIdeas(db: Queryable, brandId: string): Promise<BrandForIdeas | null> {
  const { rows } = await db.query<{ identity: Identity; positioning: Positioning; channels: Channels; themes: Theme[]; voice: Voice }>(
    'select identity, positioning, channels, themes, voice from presenza.brands where id = $1',
    [brandId],
  );
  const row = rows[0];
  if (!row) return null;
  const channels = (Object.keys(row.channels) as ChannelId[]).filter((id) => row.channels[id]?.selected);
  return {
    themes: row.themes,
    context: {
      identity: row.identity,
      positioning: row.positioning,
      channels: channels.length > 0 ? channels : ['instagram'],
      themes: row.themes.map(({ id, name, weight }) => ({ id, name, weight })),
      voice: currentVoiceCard(row.voice),
    },
  };
}

export async function activeIdeasJob(db: Queryable, brandId: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>(
    `select id from presenza.ai_jobs
     where kind = 'ideas' and input->>'brandId' = $1 and status in ('queued', 'running')
     order by created_at desc limit 1`,
    [brandId],
  );
  return rows[0]?.id ?? null;
}

export async function insertIdea(db: Queryable, brandId: string, accountId: string, draft: IdeaDraft): Promise<Idea> {
  const { rows } = await db.query<IdeaRow>(
    `insert into presenza.ideas (brand_id, account_id, title, angle_label, angle, rationale, theme_id, signal, formats, channels)
     values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10) returning ${COLUMNS}`,
    [brandId, accountId, draft.title, draft.angleLabel, draft.angle, draft.rationale, draft.themeId, JSON.stringify(draft.signal), draft.formats, draft.channels],
  );
  return toIdea(rows[0]);
}

export async function findIdea(db: Queryable, ideaId: string): Promise<Idea | null> {
  const { rows } = await db.query<IdeaRow>(`select ${COLUMNS} from presenza.ideas where id = $1`, [ideaId]);
  return rows[0] ? toIdea(rows[0]) : null;
}
