import type { ChannelId, ChannelState } from '@moonbrand/shared/domain/brand';

import type { Queryable } from '../../db/pool';

// Lo stato di un canale nel JSON dei canali del brand: null se il brand non c'è (o non è dell'account).
export async function findChannel(db: Queryable, brandId: string, channel: ChannelId): Promise<ChannelState | null> {
  const { rows } = await db.query<{ state: ChannelState | null }>('select channels -> $2 as state from presenza.brands where id = $1', [
    brandId,
    channel,
  ]);
  return rows[0] ? (rows[0].state ?? { selected: false, handle: null }) : null;
}

// Cambia un canale solo: gli altri restano come sono.
export async function storeChannel(db: Queryable, brandId: string, channel: ChannelId, state: ChannelState): Promise<void> {
  await db.query('update presenza.brands set channels = jsonb_set(channels, array[$2::text], $3::jsonb) where id = $1', [
    brandId,
    channel,
    JSON.stringify(state),
  ]);
}
