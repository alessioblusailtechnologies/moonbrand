import type { LibraryVoice } from '@moonbrand/shared/domain/voice';

import { ApiError } from '../../errors';

// ElevenLabs per le voci del brand: clonare una voce da un audio, cancellarla, cercare nella libreria pubblica. Il
// parlato lo genera il worker (tool genera_voce), con la stessa chiave.
const API = 'https://api.elevenlabs.io';
// Se l'account può clonare lo si chiede di rado: cambia solo cambiando piano su ElevenLabs.
const CAPABILITY_TTL_MS = 10 * 60_000;

export interface ElevenLabs {
  canClone(): Promise<boolean>;
  clone(name: string, audio: Uint8Array): Promise<string>;
  remove(voiceId: string): Promise<void>;
  search(filters: { query?: string; language?: string; gender?: string }): Promise<LibraryVoice[]>;
}

interface SharedVoice {
  voice_id: string;
  name: string;
  language?: string;
  gender?: string;
  accent?: string;
  description?: string;
  preview_url?: string;
}

export function elevenLabs(apiKey: string): ElevenLabs {
  let capability: { value: boolean; at: number } | null = null;

  const request = async (route: string, init: RequestInit = {}) => {
    const response = await fetch(`${API}${route}`, {
      ...init,
      headers: { 'xi-api-key': apiKey, ...init.headers },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { detail?: { status?: string; message?: string } | string } | null;
      const detail = typeof body?.detail === 'object' ? body.detail : { message: body?.detail };
      throw Object.assign(new Error(`ElevenLabs ${response.status}: ${detail?.message ?? ''}`), { status: response.status, code: detail?.status ?? '' });
    }
    return response;
  };

  return {
    async canClone() {
      if (capability && Date.now() - capability.at < CAPABILITY_TTL_MS) return capability.value;
      const value = await request('/v1/user/subscription')
        .then((response) => response.json() as Promise<{ can_use_instant_voice_cloning?: boolean }>)
        .then((subscription) => Boolean(subscription.can_use_instant_voice_cloning))
        .catch(() => false);
      capability = { value, at: Date.now() };
      return value;
    },

    async clone(name, audio) {
      const form = new FormData();
      form.append('name', name);
      form.append('remove_background_noise', 'true');
      form.append('files', new Blob([new Uint8Array(audio)], { type: 'audio/mpeg' }), 'voce.mp3');
      try {
        const response = await request('/v1/voices/add', { method: 'POST', body: form });
        return ((await response.json()) as { voice_id: string }).voice_id;
      } catch (error) {
        const { status, code = '' } = error as { status?: number; code?: string };
        if (code === 'voice_limit_reached') throw new ApiError(503, 'VOICE_SLOTS_FULL', 'Al momento non si possono aggiungere altre voci clonate: scrivici.');
        if (status === 401 || status === 403 || code.includes('subscription') || code.includes('cloning')) {
          capability = { value: false, at: Date.now() };
          throw new ApiError(503, 'VOICE_CLONING_OFF', 'La clonazione delle voci al momento non è disponibile.');
        }
        if (status === 400 || status === 422) throw ApiError.invalid('ElevenLabs non riesce a usare questo audio: prova con un parlato più pulito, senza musica sotto.');
        throw new ApiError(502, 'VOICE_FAILED', 'Non sono riuscito a creare la voce: riprova tra poco.');
      }
    },

    async remove(voiceId) {
      await request(`/v1/voices/${encodeURIComponent(voiceId)}`, { method: 'DELETE' }).catch((error: { status?: number }) => {
        if (error.status !== 404) throw error;
      });
    },

    async search({ query, language, gender }) {
      const params = new URLSearchParams({ page_size: '30', ...(query && { search: query }), ...(language && { language }), ...(gender && { gender }) });
      const response = await request(`/v1/shared-voices?${params}`).catch(() => {
        throw new ApiError(502, 'VOICE_LIBRARY_FAILED', 'La libreria delle voci non risponde: riprova tra poco.');
      });
      const { voices = [] } = (await response.json()) as { voices?: SharedVoice[] };
      return voices.map((voice) => ({
        voiceId: voice.voice_id,
        name: voice.name,
        language: voice.language ?? null,
        gender: voice.gender ?? null,
        accent: voice.accent ?? null,
        description: voice.description?.slice(0, 300) ?? null,
        previewUrl: voice.preview_url ?? null,
      }));
    },
  };
}
