import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdAccountsResponse, AdConnectResponse, AdsResponse } from '@moonbrand/shared/api/contract';
import type { Ad, AdDraft } from '@moonbrand/shared/domain/ads';

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
}
