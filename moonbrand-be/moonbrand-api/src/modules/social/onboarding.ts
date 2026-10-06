import type { Channels, ChannelId } from '@moonbrand/shared/domain/brand';

import { handle } from './routes';
import { zernio } from './zernio';

// I canali collegati nell'onboarding, prima che il brand esistesse: la bozza dice quali account, ma vale solo
// quello che c'è davvero nel profilo Zernio del brand (handle compreso). La bacheca di Pinterest resta quella scelta.
export async function onboardingConnections(apiKey: string | undefined, brandId: string, channels: Channels): Promise<Partial<Channels>> {
  const claimed = (Object.keys(channels) as ChannelId[]).filter((id) => channels[id].accountId);
  if (!apiKey || claimed.length === 0) return {};
  const client = zernio(apiKey);
  const found = await Promise.all(
    claimed.map(async (id) => {
      const account = (await client.accounts(brandId, id)).find((item) => item._id === channels[id].accountId);
      return account ? ([id, { selected: true, handle: handle(id, account), accountId: account._id, board: channels[id].board ?? null }] as const) : null;
    }),
  );
  return Object.fromEntries(found.filter((entry) => entry !== null));
}
