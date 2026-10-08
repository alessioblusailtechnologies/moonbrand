import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { Publication, PublicationReason, PublicationStatus } from '@moonbrand/shared/domain/plan';

import type { Queryable } from '../../db/pool';

// Le pubblicazioni dei contenuti (presenza.publications): una per contenuto e canale. Le scrive il pubblicatore;
// chi usa moonbrand può solo dare l'ora della riprova a quelle non riuscite (retryFailedAt).

interface PublicationRow {
  content_id: string;
  channel: ChannelId;
  status: PublicationStatus;
  post_url: string | null;
  reason: PublicationReason | null;
  error: string | null;
  retry_at: Date | null;
  published_at: Date | null;
}

// Le pubblicazioni di questi contenuti, per contenuto.
export async function listPublications(db: Queryable, contentIds: readonly string[]): Promise<Map<string, Publication[]>> {
  const byContent = new Map<string, Publication[]>();
  if (contentIds.length === 0) return byContent;
  const { rows } = await db.query<PublicationRow>(
    `select content_id, channel, status, post_url, reason, error, retry_at, published_at from presenza.publications
     where content_id = any($1::uuid[]) order by created_at`,
    [contentIds],
  );
  for (const row of rows) {
    const list = byContent.get(row.content_id) ?? [];
    list.push({
      channel: row.channel,
      status: row.status,
      url: row.post_url,
      reason: row.reason,
      error: row.error,
      retryAt: row.retry_at?.toISOString() ?? null,
      publishedAt: row.published_at?.toISOString() ?? null,
    });
    byContent.set(row.content_id, list);
  }
  return byContent;
}

// Un'uscita spostata riprova all'ora nuova dove il contenuto non era uscito: i canali già usciti restano com'erano.
// Il pubblicatore riprende le pubblicazioni non riuscite quando retry_at arriva.
export async function retryFailedAt(db: Queryable, contentId: string, date: string, time: string): Promise<void> {
  await db.query(
    `update presenza.publications set retry_at = ($2::date + $3::time) at time zone 'Europe/Rome'
     where content_id = $1 and status = 'failed'`,
    [contentId, date, time],
  );
}
