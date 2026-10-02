import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { Publication, PublicationStatus } from '@moonbrand/shared/domain/plan';

import type { Queryable } from '../../db/pool';

// Le pubblicazioni dei contenuti (presenza.publications): una per contenuto e canale. Le scrive il pubblicatore.

interface PublicationRow {
  content_id: string;
  channel: ChannelId;
  status: PublicationStatus;
  post_url: string | null;
  error: string | null;
  published_at: Date | null;
}

// Le pubblicazioni di questi contenuti, per contenuto.
export async function listPublications(db: Queryable, contentIds: readonly string[]): Promise<Map<string, Publication[]>> {
  const byContent = new Map<string, Publication[]>();
  if (contentIds.length === 0) return byContent;
  const { rows } = await db.query<PublicationRow>(
    `select content_id, channel, status, post_url, error, published_at from presenza.publications
     where content_id = any($1::uuid[]) order by created_at`,
    [contentIds],
  );
  for (const row of rows) {
    const list = byContent.get(row.content_id) ?? [];
    list.push({ channel: row.channel, status: row.status, url: row.post_url, error: row.error, publishedAt: row.published_at?.toISOString() ?? null });
    byContent.set(row.content_id, list);
  }
  return byContent;
}
