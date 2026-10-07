import { isSimulated, type Channels, type ChannelId } from '@moonbrand/shared/domain/brand';

import { handle } from './routes';
import { zernio } from './zernio';

// I canali collegati nell'onboarding, prima che il brand esistesse: la bozza dice quali account, ma vale solo
// quello che c'è davvero nel profilo Zernio del brand (handle compreso). La bacheca di Pinterest resta quella scelta.
// simulate: negli ambienti di prova i collegamenti simulati passano così come sono.
export async function onboardingConnections(
  apiKey: string | undefined,
  brandId: string,
  channels: Channels,
  simulate = false,
): Promise<Partial<Channels>> {
  const ids = (Object.keys(channels) as ChannelId[]).filter((id) => channels[id].accountId);
  const simulated = simulate ? ids.filter((id) => isSimulated(channels[id])) : [];
  const fake = Object.fromEntries(simulated.map((id) => [id, { ...channels[id], selected: true, lost: false }]));
  const claimed = ids.filter((id) => !isSimulated(channels[id]));
  if (!apiKey || claimed.length === 0) return fake;
  const client = zernio(apiKey);
  const found = await Promise.all(
    claimed.map(async (id) => {
      const account = (await client.accounts(brandId, id)).find((item) => item._id === channels[id].accountId);
      return account ? ([id, { selected: true, handle: handle(id, account), accountId: account._id, board: channels[id].board ?? null }] as const) : null;
    }),
  );
  return { ...fake, ...Object.fromEntries(found.filter((entry) => entry !== null)) };
}
