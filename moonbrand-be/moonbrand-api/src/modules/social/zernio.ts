import type { ChannelChoice, ChannelChoicesRequest } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';

import { ApiError } from '../../errors';

// Zernio collega i social dei brand e pubblica al loro posto (docs.zernio.com). Ogni brand ha il suo profilo Zernio,
// che si chiama con l'id del brand: si ritrova per nome, senza salvarne l'id. Gli account collegati stanno nel profilo.
// Il collegamento è headless: dove il social chiede di scegliere (la Pagina di Facebook, il profilo o la pagina
// aziendale di LinkedIn, la bacheca di Pinterest) la scelta la mostra studio, non Zernio; gli altri social tornano
// già collegati.

const API = 'https://zernio.com/api/v1';
const TIMEOUT_MS = 20_000;
// Un video si carica e si pubblica in qualche decina di secondi: con publishNow Zernio risponde a pubblicazione fatta.
const UPLOAD_TIMEOUT_MS = 5 * 60_000;
const PUBLISH_TIMEOUT_MS = 5 * 60_000;

// I nomi delle piattaforme per Zernio: X si chiama ancora twitter.
const PLATFORMS: Record<ChannelId, string> = {
  linkedin: 'linkedin',
  instagram: 'instagram',
  facebook: 'facebook',
  tiktok: 'tiktok',
  x: 'twitter',
  pinterest: 'pinterest',
};

export interface ZernioAccount {
  _id: string;
  platform: string;
  username?: string;
  displayName?: string;
  isActive: boolean;
  // Pinterest: la bacheca scelta collegando, dove escono i pin.
  board?: { id: string; name: string };
}

// I canali dove si sceglie dove pubblicare, dopo l'accesso al social.
export const CHOOSING: Partial<Record<ChannelId, true>> = { facebook: true, linkedin: true, pinterest: true };

interface LinkedInOrganization {
  id: string;
  urn?: string;
  name?: string;
  vanityName?: string;
}

interface SelectedAccount {
  accountId: string;
  username?: string;
  displayName?: string;
  isActive: boolean;
}

// userProfile e organizations arrivano nell'indirizzo codificati due volte: il browser ne toglie una, qui l'altra.
function parsed<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  for (const text of [value, decodeURIComponent(value)]) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // la volta dopo, decodificato
    }
  }
  throw new ApiError(400, 'INVALID_DATA', 'Il ritorno dal social è incompleto: ricomincia il collegamento.');
}

// Un post da pubblicare subito su un canale (POST /v1/posts con publishNow).
export interface PostRequest {
  content: string;
  mediaItems: { type: 'image' | 'video' | 'document'; url: string; title?: string }[];
  platform: { platform: string; accountId: string; platformSpecificData?: Record<string, unknown> };
  tiktokSettings?: Record<string, unknown>;
}

// Com'è andato sul canale: pending o processing mentre il social elabora (soprattutto i video), poi published o failed.
export interface PostOutcome {
  postId: string;
  status: string;
  url: string | null;
  error: string | null;
}

interface PostPlatform {
  status?: string;
  platformPostUrl?: string | null;
  errorMessage?: string | null;
  error?: string | null;
}

const outcome = (postId: string, platform: PostPlatform | undefined, error?: string | null): PostOutcome => ({
  postId,
  status: platform?.status ?? 'pending',
  url: platform?.platformPostUrl ?? null,
  error: error ?? platform?.errorMessage ?? platform?.error ?? null,
});

export const platformOf = (channel: ChannelId): string => PLATFORMS[channel];

export interface Zernio {
  // Carica un file su Zernio e ne restituisce l'indirizzo pubblico, da usare nei post.
  upload(name: string, contentType: string, bytes: Buffer): Promise<string>;
  // idempotencyKey: lo stesso post ritentato non esce due volte.
  publish(post: PostRequest, idempotencyKey: string): Promise<PostOutcome>;
  outcome(postId: string): Promise<PostOutcome>;
  connectUrl(brandId: string, channel: ChannelId, redirectUrl: string): Promise<string>;
  choices(brandId: string, channel: ChannelId, request: ChannelChoicesRequest): Promise<ChannelChoice[]>;
  select(brandId: string, channel: ChannelId, request: ChannelChoicesRequest, choiceId: string): Promise<ZernioAccount>;
  account(brandId: string, channel: ChannelId, accountId: string): Promise<ZernioAccount | null>;
  // Gli account collegati nel profilo del brand per questo canale (anche prima che il brand sia creato).
  accounts(brandId: string, channel: ChannelId): Promise<ZernioAccount[]>;
  disconnect(accountId: string): Promise<void>;
}

export function zernio(apiKey: string): Zernio {
  const call = async <T>(path: string, init: RequestInit = {}, timeout = TIMEOUT_MS): Promise<T> => {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeout),
    }).catch(() => {
      throw new ApiError(502, 'SOCIAL_FAILED', 'Il servizio di collegamento dei social non risponde: riprova.');
    });
    if (response.status === 404) throw new ApiError(404, 'SOCIAL_NOT_FOUND', 'Su Zernio non c’è.');
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const message =
        response.status === 401 || response.status === 403
          ? 'La chiave del servizio di collegamento dei social non è valida.'
          : `Il collegamento dei social non è riuscito${body?.error ? `: ${body.error}` : ''}.`;
      throw new ApiError(502, 'SOCIAL_FAILED', message);
    }
    return (await response.json()) as T;
  };

  // Il profilo del brand: si cerca per nome e, la prima volta, si crea.
  const profileId = async (brandId: string, create: boolean): Promise<string | null> => {
    const { profiles } = await call<{ profiles: { _id: string }[] }>(`/profiles?name=${encodeURIComponent(brandId)}`);
    if (profiles[0] || !create) return profiles[0]?._id ?? null;
    const created = await call<{ profile?: { _id: string }; _id?: string }>('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: brandId, description: 'Brand di moonbrand', timezone: 'Europe/Rome' }),
    });
    const id = created.profile?._id ?? created._id;
    if (!id) throw new ApiError(502, 'SOCIAL_FAILED', 'Il collegamento dei social non è riuscito: profilo non creato.');
    return id;
  };

  // Le bacheche di Pinterest dove l'account può pubblicare, durante il collegamento.
  const boards = async (profile: string, request: ChannelChoicesRequest) => {
    const query = new URLSearchParams({ profileId: profile, tempToken: request.tempToken });
    const { boards: list } = await call<{ boards: { id: string; name: string; privacy?: string }[] }>(`/connect/pinterest/select-board?${query}`, {
      headers: { 'x-connect-token': request.connectToken },
    });
    return list.map((board) => ({ id: board.id, name: board.name, detail: board.privacy === 'PRIVATE' ? 'Bacheca segreta' : 'Bacheca' }));
  };

  return {
    async upload(name, contentType, bytes) {
      const { uploadUrl, publicUrl } = await call<{ uploadUrl: string; publicUrl: string }>('/media/presign', {
        method: 'POST',
        body: JSON.stringify({ filename: name, contentType, size: bytes.length }),
      });
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': contentType },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      }).catch(() => null);
      if (!put?.ok) throw new ApiError(502, 'SOCIAL_FAILED', `Il caricamento di ${name} non è riuscito.`);
      return publicUrl;
    },

    async publish(post, idempotencyKey) {
      const response = await call<{ post: { _id: string; platforms?: PostPlatform[] }; platformResults?: { status: string; error: string | null }[] }>(
        '/posts',
        {
          method: 'POST',
          headers: { 'idempotency-key': idempotencyKey },
          body: JSON.stringify({
            content: post.content,
            mediaItems: post.mediaItems,
            platforms: [post.platform],
            publishNow: true,
            ...(post.tiktokSettings && { tiktokSettings: post.tiktokSettings }),
          }),
        },
        PUBLISH_TIMEOUT_MS,
      );
      const result = response.platformResults?.[0];
      const platform = response.post.platforms?.[0];
      return outcome(response.post._id, { ...platform, status: result?.status ?? platform?.status }, result?.error);
    },

    async outcome(postId) {
      const { post } = await call<{ post: { _id: string; platforms?: PostPlatform[] } }>(`/posts/${encodeURIComponent(postId)}`);
      return outcome(post._id, post.platforms?.[0]);
    },

    async connectUrl(brandId, channel, redirectUrl) {
      const profile = await profileId(brandId, true);
      const query = new URLSearchParams({ profileId: profile!, redirect_url: redirectUrl, headless: 'true' });
      const { authUrl } = await call<{ authUrl: string }>(`/connect/${PLATFORMS[channel]}?${query}`);
      return authUrl;
    },

    async choices(brandId, channel, request) {
      const profile = await profileId(brandId, false);
      if (!profile || !CHOOSING[channel]) throw ApiError.invalid('Su questo canale non c’è niente da scegliere.');
      const headers = { 'x-connect-token': request.connectToken };
      if (channel === 'facebook') {
        const query = new URLSearchParams({ profileId: profile, tempToken: request.tempToken });
        const { pages } = await call<{ pages: { id: string; name: string; category?: string }[] }>(`/connect/facebook/select-page?${query}`, { headers });
        return pages.map((page) => ({ id: page.id, name: page.name, detail: page.category ?? 'Pagina Facebook', picture: null }));
      }
      if (channel === 'pinterest') return (await boards(profile, request)).map((board) => ({ ...board, picture: null }));
      const user = parsed<{ displayName?: string; username?: string; profilePicture?: string }>(request.userProfile, {});
      const organizations = parsed<LinkedInOrganization[]>(request.organizations, []);
      // I loghi delle pagine aziendali: se non arrivano, le pagine si mostrano senza.
      const logos = new Map<string, string>();
      if (organizations.length > 0) {
        const query = new URLSearchParams({ tempToken: request.tempToken, orgIds: organizations.map((org) => org.id).join(',') });
        await call<{ organizations: { id: string; logoUrl?: string }[] }>(`/connect/linkedin/organizations?${query}`, { headers })
          .then(({ organizations: details }) => details.forEach((org) => org.logoUrl && logos.set(org.id, org.logoUrl)))
          .catch(() => undefined);
      }
      return [
        { id: 'personal', name: user.displayName ?? user.username ?? 'Il tuo profilo', detail: 'Profilo personale', picture: user.profilePicture ?? null },
        ...organizations.map((org) => ({ id: org.id, name: org.name ?? org.vanityName ?? org.id, detail: 'Pagina aziendale', picture: logos.get(org.id) ?? null })),
      ];
    },

    async select(brandId, channel, request, choiceId) {
      const profile = await profileId(brandId, false);
      if (!profile || !CHOOSING[channel]) throw ApiError.invalid('Su questo canale non c’è niente da scegliere.');
      const headers = { 'x-connect-token': request.connectToken };
      const userProfile = parsed<Record<string, unknown>>(request.userProfile, {});
      let account: SelectedAccount | undefined;
      let board: { id: string; name: string } | undefined;
      if (channel === 'pinterest') {
        const chosen = (await boards(profile, request)).find((item) => item.id === choiceId);
        if (!chosen) throw ApiError.invalid('Bacheca non trovata: ricomincia il collegamento.');
        board = { id: chosen.id, name: chosen.name };
        ({ account } = await call<{ account?: SelectedAccount }>('/connect/pinterest/select-board', {
          method: 'POST',
          headers,
          body: JSON.stringify({ profileId: profile, boardId: chosen.id, boardName: chosen.name, tempToken: request.tempToken, userProfile }),
        }));
      } else if (channel === 'facebook') {
        ({ account } = await call<{ account?: SelectedAccount }>('/connect/facebook/select-page', {
          method: 'POST',
          headers,
          body: JSON.stringify({ profileId: profile, pageId: choiceId, tempToken: request.tempToken, userProfile }),
        }));
      } else {
        const organization = parsed<LinkedInOrganization[]>(request.organizations, []).find((org) => org.id === choiceId);
        if (choiceId !== 'personal' && !organization) throw ApiError.invalid('Pagina aziendale non trovata: ricomincia il collegamento.');
        ({ account } = await call<{ account?: SelectedAccount }>('/connect/linkedin/select-organization', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            profileId: profile,
            tempToken: request.tempToken,
            userProfile,
            accountType: organization ? 'organization' : 'personal',
            ...(organization && { selectedOrganization: organization }),
          }),
        }));
      }
      if (!account) throw new ApiError(502, 'SOCIAL_FAILED', 'Il collegamento dei social non è riuscito: riprova.');
      return {
        _id: account.accountId,
        platform: PLATFORMS[channel],
        username: account.username,
        displayName: account.displayName,
        isActive: account.isActive,
        ...(board && { board }),
      };
    },

    // L'account tornato dalla redirezione, solo se è davvero nel profilo del brand e della piattaforma giusta.
    async account(brandId, channel, accountId) {
      const profile = await profileId(brandId, false);
      if (!profile) return null;
      const query = new URLSearchParams({ profileId: profile, platform: PLATFORMS[channel] });
      const { accounts } = await call<{ accounts: ZernioAccount[] }>(`/accounts?${query}`);
      return accounts.find((account) => account._id === accountId) ?? null;
    },

    async accounts(brandId, channel) {
      const profile = await profileId(brandId, false);
      if (!profile) return [];
      const query = new URLSearchParams({ profileId: profile, platform: PLATFORMS[channel] });
      const { accounts } = await call<{ accounts: ZernioAccount[] }>(`/accounts?${query}`);
      return accounts.filter((account) => account.isActive);
    },

    // Un account già tolto da Zernio va bene lo stesso: il canale si scollega comunque.
    async disconnect(accountId) {
      await call(`/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' }).catch((error: unknown) => {
        if (!(error instanceof ApiError && error.status === 404)) throw error;
      });
    },
  };
}
