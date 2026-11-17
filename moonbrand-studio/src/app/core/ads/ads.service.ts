import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  AdAccountsResponse,
  AdAudiencesResponse,
  AdConnectResponse,
  AdImagesResponse,
  AdInterestsResponse,
  AdKeywordIdeasRequest,
  AdKeywordIdeasResponse,
  AdLocationsResponse,
  AdsResponse,
} from '@moonbrand/shared/api/contract';
import type { Ad, AdAudience, AdAudienceRef, AdDraft, AdImageOption, AdKeywordIdea, AdLocation } from '@moonbrand/shared/domain/ads';

// La sezione Campagne: il collegamento Google Ads del brand e le sue campagne.
@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly http = inject(HttpClient);

  list(brandId: string): Promise<AdsResponse> {
    return firstValueFrom(this.http.get<AdsResponse>(`/v1/brands/${brandId}/ads`));
  }

  connect(brandId: string, redirectUrl: string): Promise<AdConnectResponse> {
    return firstValueFrom(this.http.post<AdConnectResponse>(`/v1/brands/${brandId}/ads/google/connect`, { redirectUrl }));
  }

  confirm(brandId: string, accountId: string): Promise<AdAccountsResponse> {
    return firstValueFrom(this.http.post<AdAccountsResponse>(`/v1/brands/${brandId}/ads/google/confirm`, { accountId }));
  }

  simulate(brandId: string): Promise<AdAccountsResponse> {
    return firstValueFrom(this.http.post<AdAccountsResponse>(`/v1/brands/${brandId}/ads/google/simulate`, {}));
  }

  accounts(brandId: string): Promise<AdAccountsResponse> {
    return firstValueFrom(this.http.get<AdAccountsResponse>(`/v1/brands/${brandId}/ads/google/accounts`));
  }

  chooseAccount(brandId: string, adAccountId: string): Promise<AdAccountsResponse> {
    return firstValueFrom(this.http.post<AdAccountsResponse>(`/v1/brands/${brandId}/ads/google/account`, { adAccountId }));
  }

  async disconnect(brandId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/v1/brands/${brandId}/ads/google`));
  }

  create(brandId: string, draft: AdDraft): Promise<Ad> {
    return firstValueFrom(this.http.post<Ad>(`/v1/brands/${brandId}/ads`, draft));
  }

  update(brandId: string, adId: string, draft: AdDraft): Promise<Ad> {
    return firstValueFrom(this.http.put<Ad>(`/v1/brands/${brandId}/ads/${adId}`, draft));
  }

  launch(brandId: string, adId: string): Promise<Ad> {
    return firstValueFrom(this.http.post<Ad>(`/v1/brands/${brandId}/ads/${adId}/launch`, {}));
  }

  pause(brandId: string, adId: string): Promise<Ad> {
    return firstValueFrom(this.http.post<Ad>(`/v1/brands/${brandId}/ads/${adId}/pause`, {}));
  }

  resume(brandId: string, adId: string): Promise<Ad> {
    return firstValueFrom(this.http.post<Ad>(`/v1/brands/${brandId}/ads/${adId}/resume`, {}));
  }

  async remove(brandId: string, adId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`/v1/brands/${brandId}/ads/${adId}`));
  }

  // Gli strumenti della bozza: immagini, luoghi, interessi, pubblici e idee per le parole chiave.

  async images(brandId: string): Promise<AdImageOption[]> {
    return (await firstValueFrom(this.http.get<AdImagesResponse>(`/v1/brands/${brandId}/ads/images`))).images;
  }

  uploadImage(brandId: string, dataUri: string): Promise<AdImageOption> {
    return firstValueFrom(this.http.post<AdImageOption>(`/v1/brands/${brandId}/ads/images`, { dataUri }));
  }

  async locations(brandId: string, query: string): Promise<AdLocation[]> {
    const params = { q: query };
    return (await firstValueFrom(this.http.get<AdLocationsResponse>(`/v1/brands/${brandId}/ads/google/locations`, { params }))).locations;
  }

  async interests(brandId: string, query: string): Promise<AdAudienceRef[]> {
    const params = { q: query };
    return (await firstValueFrom(this.http.get<AdInterestsResponse>(`/v1/brands/${brandId}/ads/google/interests`, { params }))).interests;
  }

  async audiences(brandId: string): Promise<AdAudience[]> {
    return (await firstValueFrom(this.http.get<AdAudiencesResponse>(`/v1/brands/${brandId}/ads/google/audiences`))).audiences;
  }

  async keywordIdeas(brandId: string, request: AdKeywordIdeasRequest): Promise<AdKeywordIdea[]> {
    return (await firstValueFrom(this.http.post<AdKeywordIdeasResponse>(`/v1/brands/${brandId}/ads/google/keyword-ideas`, request))).ideas;
  }
}
