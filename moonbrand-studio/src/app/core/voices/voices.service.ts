import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { VoiceLibraryAddRequest, VoiceLibraryResponse, VoicesResponse, VoiceUpdateRequest } from '@moonbrand/shared/api/contract';
import type { BrandVoice } from '@moonbrand/shared/domain/voice';

// Le voci del brand (Impostazioni → Voci) e la libreria di ElevenLabs.
@Injectable({ providedIn: 'root' })
export class VoicesService {
  private readonly http = inject(HttpClient);

  list(brandId: string): Promise<VoicesResponse> {
    return firstValueFrom(this.http.get<VoicesResponse>(`/v1/brands/${brandId}/voices`));
  }

  search(filters: { q?: string; language?: string; gender?: string }): Promise<VoiceLibraryResponse> {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    return firstValueFrom(this.http.get<VoiceLibraryResponse>('/v1/voices/library', { params }));
  }

  addLibrary(brandId: string, voice: VoiceLibraryAddRequest): Promise<BrandVoice> {
    return firstValueFrom(this.http.post<BrandVoice>(`/v1/brands/${brandId}/voices/library`, voice));
  }

  // L'audio va così com'è: lo converte l'API. Il consenso è la casella spuntata.
  clone(brandId: string, name: string, audio: Blob): Promise<BrandVoice> {
    return firstValueFrom(
      this.http.post<BrandVoice>(`/v1/brands/${brandId}/voices/clone`, audio, {
        params: { name, consent: '1' },
        headers: { 'Content-Type': audio.type || 'application/octet-stream' },
      }),
    );
  }

  update(brandId: string, voiceId: string, patch: VoiceUpdateRequest): Promise<BrandVoice> {
    return firstValueFrom(this.http.patch<BrandVoice>(`/v1/brands/${brandId}/voices/${voiceId}`, patch));
  }

  async remove(brandId: string, voiceId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/v1/brands/${brandId}/voices/${voiceId}`));
  }
}
