import type { FastifyInstance, FastifyRequest } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { ChannelChoicesResponse, ChannelConnectionResponse, ConnectChannelResponse } from '@moonbrand/shared/api/contract';
import type { ChannelId, ChannelState } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';

import type { Config } from '../../config';
import { withIdentity } from '../../db/identity';
import { ApiError } from '../../errors';
import { findChannel, storeChannel } from './repository';
import { zernio, type ZernioAccount } from './zernio';

const channelParams = z.object({
  brandId: z.uuid('Brand non trovato.'),
  channel: z.enum(['linkedin', 'instagram', 'facebook', 'tiktok', 'x'], 'Canale non valido.'),
});
const connectSchema = z.object({ redirectUrl: z.url({ protocol: /^https?$/, error: 'Indirizzo di ritorno non valido.' }) });
const confirmSchema = z.object({ accountId: z.string().trim().min(1).max(100) });
const choicesSchema = z.object({
  tempToken: z.string().min(1).max(4000),
  connectToken: z.string().min(1).max(500),
  userProfile: z.string().max(20_000),
  organizations: z.string().max(100_000).optional(),
});
const selectSchema = choicesSchema.extend({ choiceId: z.string().trim().min(1).max(100) });

// Pagine e organizzazioni si mostrano con il loro nome, gli altri account con @.
function handle(channel: ChannelId, account: ZernioAccount): string | null {
  const name = channel === 'facebook' || channel === 'linkedin' ? (account.displayName ?? account.username) : account.username;
  if (!name) return account.displayName ?? null;
  return channel === 'facebook' || channel === 'linkedin' || name.startsWith('@') ? name : `@${name}`;
}

// Il collegamento dei canali del brand con Zernio. Collega dà la pagina di accesso del social; al ritorno studio passa
// l'account che Zernio ha messo nella redirezione e qui si verifica che sia davvero nel profilo del brand prima di salvarlo.
// Handle e account li scrive solo questo modulo: il salvataggio del brand li lascia come sono.
export function registerSocialRoutes(app: FastifyInstance, pool: pg.Pool, settings: Pick<Config, 'ZERNIO_API_KEY' | 'STUDIO_ORIGINS'>): void {
  const client = () => {
    if (!settings.ZERNIO_API_KEY) throw new ApiError(503, 'SOCIAL_NOT_CONFIGURED', 'Il collegamento dei social non è configurato: manca ZERNIO_API_KEY.');
    return zernio(settings.ZERNIO_API_KEY);
  };
  // Si torna solo alle pagine di studio: Zernio non deve diventare un modo per mandare il browser altrove.
  const origins = (settings.STUDIO_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const channelOf = (identity: { accountId: string }, brandId: string, channel: ChannelId) =>
    withIdentity(pool, identity, async (db) => {
      const state = await findChannel(db, brandId, channel);
      if (!state) throw ApiError.notFound('Brand non trovato.');
      return state;
    });
  const save = (identity: { accountId: string }, brandId: string, channel: ChannelId, state: ChannelState) =>
    withIdentity(pool, identity, (db) => storeChannel(db, brandId, channel, state));

  app.post('/v1/brands/:brandId/channels/:channel/connect', async (request): Promise<ConnectChannelResponse> => {
    const { brandId, channel } = channelParams.parse(request.params);
    const { redirectUrl } = connectSchema.parse(request.body);
    if (origins.length > 0 && !origins.includes(new URL(redirectUrl).origin)) throw ApiError.invalid('Indirizzo di ritorno non valido.');
    await channelOf(request.identity, brandId, channel);
    return { authUrl: await client().connectUrl(brandId, channel, redirectUrl) };
  });

  // Salva l'account collegato sul canale. Un altro account sullo stesso canale prende il posto di quello di prima,
  // che su Zernio si paga: si scollega.
  const connect = async (request: FastifyRequest, brandId: string, channel: ChannelId, before: ChannelState, account: ZernioAccount | null) => {
    if (!account?.isActive) throw ApiError.invalid(`Il collegamento di ${channelName(channel)} non è andato a buon fine: riprova.`);
    if (before.accountId && before.accountId !== account._id) {
      await client()
        .disconnect(before.accountId)
        .catch((error: unknown) => request.log.warn({ err: error }, 'account di prima non scollegato'));
    }
    const state: ChannelState = { selected: true, handle: handle(channel, account), accountId: account._id };
    await save(request.identity, brandId, channel, state);
    return { channel, state };
  };

  // I social senza scelte tornano già collegati: qui si verifica l'account e si salva.
  app.post('/v1/brands/:brandId/channels/:channel/confirm', async (request): Promise<ChannelConnectionResponse> => {
    const { brandId, channel } = channelParams.parse(request.params);
    const { accountId } = confirmSchema.parse(request.body);
    const before = await channelOf(request.identity, brandId, channel);
    return connect(request, brandId, channel, before, await client().account(brandId, channel, accountId));
  });

  // Facebook e LinkedIn: le Pagine, il profilo e le pagine aziendali tra cui scegliere dove pubblicare.
  app.post('/v1/brands/:brandId/channels/:channel/choices', async (request): Promise<ChannelChoicesResponse> => {
    const { brandId, channel } = channelParams.parse(request.params);
    const body = choicesSchema.parse(request.body);
    await channelOf(request.identity, brandId, channel);
    const choices = await client().choices(brandId, channel, body);
    if (choices.length === 0) throw ApiError.invalid(`Su ${channelName(channel)} non hai pagine da collegare.`);
    return { choices };
  });

  // La scelta fatta in studio completa il collegamento: Zernio crea l'account, qui si salva.
  app.post('/v1/brands/:brandId/channels/:channel/select', async (request): Promise<ChannelConnectionResponse> => {
    const { brandId, channel } = channelParams.parse(request.params);
    const { choiceId, ...body } = selectSchema.parse(request.body);
    const before = await channelOf(request.identity, brandId, channel);
    return connect(request, brandId, channel, before, await client().select(brandId, channel, body, choiceId));
  });

  app.delete('/v1/brands/:brandId/channels/:channel', async (request): Promise<ChannelConnectionResponse> => {
    const { brandId, channel } = channelParams.parse(request.params);
    const before = await channelOf(request.identity, brandId, channel);
    if (before.accountId) await client().disconnect(before.accountId);
    const state: ChannelState = { selected: before.selected, handle: null, accountId: null };
    await save(request.identity, brandId, channel, state);
    return { channel, state };
  });
}
