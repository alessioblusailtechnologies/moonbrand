import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  BrandProfile,
  BrandSummary,
  ChannelChoicesRequest,
  ChannelChoicesResponse,
  ChannelConnectionResponse,
  ConfirmChannelRequest,
  ConnectChannelRequest,
  ConnectChannelResponse,
  CreateBrandRequest,
  CreateBrandResponse,
  ReferenceUploadResponse,
  SelectChannelRequest,
  SocialSimulationResponse,
  UpdateBrandRequest,
} from '@moonbrand/shared/api/contract';
import type { BrandDraft, ChannelId } from '@moonbrand/shared/domain/brand';

import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class BrandsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private loading: Promise<void> | null = null;

  readonly brands = signal<BrandSummary[]>([]);
  readonly loaded = signal(false);
  readonly activeBrand = computed(() => {
    const list = this.brands();
    return list.find((brand) => brand.id === this.auth.activeBrandId()) ?? list[0] ?? null;
  });

  constructor() {
    effect(() => {
      if (!this.auth.signedIn()) {
        this.brands.set([]);
        this.loaded.set(false);
        this.loading = null;
      }
    });
  }

  ensureLoaded(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    this.loading ??= firstValueFrom(this.http.get<BrandSummary[]>('/v1/brands'))
      .then((brands) => {
        this.brands.set(brands);
        this.loaded.set(true);
      })
      .finally(() => (this.loading = null));
    return this.loading;
  }

  // Dopo un collegamento: l'elenco dice quali canali vanno ricollegati.
  async reload(): Promise<void> {
    this.brands.set(await firstValueFrom(this.http.get<BrandSummary[]>('/v1/brands')));
    this.loaded.set(true);
  }

  async setActive(brandId: string): Promise<void> {
    const previous = this.auth.activeBrandId();
    this.auth.activeBrandId.set(brandId);
    try {
      await firstValueFrom(this.http.put('/v1/me/active-brand', { brandId }));
    } catch (error) {
      this.auth.activeBrandId.set(previous);
      throw error;
    }
  }

  // setupJobs: i lavori che preparano il brand nuovo (lo stile, le prime idee), da seguire fino alla fine.
  async create(id: string, draft: BrandDraft, referenceExamples: string[]): Promise<CreateBrandResponse> {
    const body: CreateBrandRequest = { ...draft, id, referenceExamples };
    const created = await firstValueFrom(this.http.post<CreateBrandResponse>('/v1/brands', body));
    const { setupJobs: _jobs, ...brand } = created;
    this.brands.update((list) => [...list, brand]);
    this.auth.activeBrandId.set(brand.id);
    return created;
  }

  profile(brandId: string): Promise<BrandProfile> {
    return firstValueFrom(this.http.get<BrandProfile>(`/v1/brands/${brandId}`));
  }

  // Riscrive il brand; nome, logo e colore cambiano anche nell'elenco.
  async update(brandId: string, draft: BrandDraft, referenceExamples: string[] = []): Promise<BrandSummary> {
    const body: UpdateBrandRequest = { ...draft, ...(referenceExamples.length > 0 && { referenceExamples }) };
    const brand = await firstValueFrom(this.http.put<BrandSummary>(`/v1/brands/${brandId}`, body));
    this.brands.update((list) => list.map((item) => (item.id === brand.id ? brand : item)));
    return brand;
  }

  // Il collegamento dei canali, con Zernio: la pagina di accesso del social, dove mandare il browser. Ci si torna su redirectUrl.
  async connectChannel(brandId: string, channel: ChannelId, redirectUrl: string): Promise<string> {
    const body: ConnectChannelRequest = { redirectUrl };
    const { authUrl } = await firstValueFrom(this.http.post<ConnectChannelResponse>(`/v1/brands/${brandId}/channels/${channel}/connect`, body));
    return authUrl;
  }

  // Al ritorno dal social: l'account che Zernio ha messo nell'indirizzo, che il server verifica e salva.
  confirmChannel(brandId: string, channel: ChannelId, accountId: string): Promise<ChannelConnectionResponse> {
    const body: ConfirmChannelRequest = { accountId };
    return firstValueFrom(this.http.post<ChannelConnectionResponse>(`/v1/brands/${brandId}/channels/${channel}/confirm`, body));
  }

  // Facebook e LinkedIn: dove pubblicare (Pagina, profilo o pagina aziendale), con i dati del ritorno dal social.
  async channelChoices(brandId: string, channel: ChannelId, request: ChannelChoicesRequest): Promise<ChannelChoicesResponse['choices']> {
    const { choices } = await firstValueFrom(this.http.post<ChannelChoicesResponse>(`/v1/brands/${brandId}/channels/${channel}/choices`, request));
    return choices;
  }

  selectChannel(brandId: string, channel: ChannelId, request: SelectChannelRequest): Promise<ChannelConnectionResponse> {
    return firstValueFrom(this.http.post<ChannelConnectionResponse>(`/v1/brands/${brandId}/channels/${channel}/select`, request));
  }

  // Solo negli ambienti di prova (SIMULATE_SOCIAL nell'API): si chiede una volta.
  private simulation: Promise<boolean> | null = null;

  simulationEnabled(): Promise<boolean> {
    this.simulation ??= firstValueFrom(this.http.get<SocialSimulationResponse>('/v1/social/simulation')).then(
      ({ enabled }) => enabled,
      () => false,
    );
    return this.simulation;
  }

  simulateChannel(brandId: string, channel: ChannelId): Promise<ChannelConnectionResponse> {
    return firstValueFrom(this.http.post<ChannelConnectionResponse>(`/v1/brands/${brandId}/channels/${channel}/simulate`, {}));
  }

  disconnectChannel(brandId: string, channel: ChannelId): Promise<ChannelConnectionResponse> {
    return firstValueFrom(this.http.delete<ChannelConnectionResponse>(`/v1/brands/${brandId}/channels/${channel}`));
  }

  uploadReference(brandId: string, dataUri: string): Promise<ReferenceUploadResponse> {
    return firstValueFrom(this.http.post<ReferenceUploadResponse>(`/v1/brands/${brandId}/references`, { dataUri }));
  }

  async removeReference(brandId: string, path: string): Promise<void> {
    const name = path.split('/').pop() ?? '';
    await firstValueFrom(this.http.delete(`/v1/brands/${brandId}/references/${encodeURIComponent(name)}`));
  }
}
