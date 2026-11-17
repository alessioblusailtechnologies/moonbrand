import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type {
  AdAccountInfoResponse,
  AdAudienceCreateRequest,
  AdAudiencesResponse,
  AdAudienceUsersResponse,
  AdConversionCreateRequest,
  AdConversionGoalRequest,
  AdConversionsResponse,
  AdCreativeRequest,
  AdExtensionsAddRequest,
  AdExtensionsResponse,
  AdImagesResponse,
  AdInsightsResponse,
  AdInvitationRequest,
  AdKeywordsAddRequest,
  AdKeywordsResponse,
  AdLocationsResponse,
  AdRecommendationsActionResponse,
  AdRecommendationsResponse,
  AdSearchTermsResponse,
  AdSettingsRequest,
  AdTargetingRequest,
} from '@moonbrand/shared/api/contract';
import type { Ad, AdAudience, AdConversionAction, AdImageOption, AdInvitation, AdKeyword } from '@moonbrand/shared/domain/ads';

// Le campagne Google dopo l'avvio (andamento, modifiche, parole chiave, estensioni) e gli strumenti dell'account
// (pubblici, conversioni, consigli, fatturazione e inviti).
@Injectable({ providedIn: 'root' })
export class AdsManageService {
  private readonly http = inject(HttpClient);

  private base(brandId: string): string {
    return `/v1/brands/${brandId}/ads`;
  }

  private ad(brandId: string, adId: string): string {
    return `${this.base(brandId)}/${adId}`;
  }

  // Una campagna.

  insights(brandId: string, adId: string, from: string, to: string): Promise<AdInsightsResponse> {
    return firstValueFrom(this.http.get<AdInsightsResponse>(`${this.ad(brandId, adId)}/insights`, { params: { from, to } }));
  }

  settings(brandId: string, adId: string, request: AdSettingsRequest): Promise<Ad> {
    return firstValueFrom(this.http.put<Ad>(`${this.ad(brandId, adId)}/settings`, request));
  }

  creative(brandId: string, adId: string, request: AdCreativeRequest): Promise<Ad> {
    return firstValueFrom(this.http.put<Ad>(`${this.ad(brandId, adId)}/creative`, request));
  }

  targeting(brandId: string, adId: string, request: AdTargetingRequest): Promise<Ad> {
    return firstValueFrom(this.http.put<Ad>(`${this.ad(brandId, adId)}/targeting`, request));
  }

  keywords(brandId: string, adId: string): Promise<AdKeywordsResponse> {
    return firstValueFrom(this.http.get<AdKeywordsResponse>(`${this.ad(brandId, adId)}/keywords`));
  }

  addKeywords(brandId: string, adId: string, request: AdKeywordsAddRequest): Promise<AdKeywordsResponse> {
    return firstValueFrom(this.http.post<AdKeywordsResponse>(`${this.ad(brandId, adId)}/keywords`, request));
  }

  keywordStatus(brandId: string, adId: string, keywordId: string, status: 'active' | 'paused'): Promise<AdKeywordsResponse> {
    return firstValueFrom(
      this.http.patch<AdKeywordsResponse>(`${this.ad(brandId, adId)}/keywords/${encodeURIComponent(keywordId)}`, { status }),
    );
  }

  removeKeyword(brandId: string, adId: string, keywordId: string): Promise<AdKeywordsResponse> {
    return firstValueFrom(this.http.delete<AdKeywordsResponse>(`${this.ad(brandId, adId)}/keywords/${encodeURIComponent(keywordId)}`));
  }

  negatives(brandId: string, adId: string, negatives: AdKeyword[]): Promise<AdKeywordsResponse> {
    return firstValueFrom(this.http.put<AdKeywordsResponse>(`${this.ad(brandId, adId)}/negatives`, { negatives }));
  }

  searchTerms(brandId: string, adId: string, from: string, to: string): Promise<AdSearchTermsResponse> {
    return firstValueFrom(this.http.get<AdSearchTermsResponse>(`${this.ad(brandId, adId)}/search-terms`, { params: { from, to } }));
  }

  extensions(brandId: string, adId: string): Promise<AdExtensionsResponse> {
    return firstValueFrom(this.http.get<AdExtensionsResponse>(`${this.ad(brandId, adId)}/extensions`));
  }

  addExtensions(brandId: string, adId: string, request: AdExtensionsAddRequest): Promise<AdExtensionsResponse> {
    return firstValueFrom(this.http.post<AdExtensionsResponse>(`${this.ad(brandId, adId)}/extensions`, request));
  }

  removeExtensions(brandId: string, adId: string, resources: string[]): Promise<AdExtensionsResponse> {
    return firstValueFrom(this.http.delete<AdExtensionsResponse>(`${this.ad(brandId, adId)}/extensions`, { body: { resources } }));
  }

  // Strumenti per le modifiche.

  images(brandId: string): Promise<AdImagesResponse> {
    return firstValueFrom(this.http.get<AdImagesResponse>(`${this.base(brandId)}/images`));
  }

  uploadImage(brandId: string, dataUri: string): Promise<AdImageOption> {
    return firstValueFrom(this.http.post<AdImageOption>(`${this.base(brandId)}/images`, { dataUri }));
  }

  locations(brandId: string, q: string): Promise<AdLocationsResponse> {
    return firstValueFrom(this.http.get<AdLocationsResponse>(`${this.base(brandId)}/google/locations`, { params: { q } }));
  }

  // L'account.

  recommendations(brandId: string): Promise<AdRecommendationsResponse> {
    return firstValueFrom(this.http.get<AdRecommendationsResponse>(`${this.base(brandId)}/google/recommendations`));
  }

  applyRecommendations(brandId: string, resources: string[]): Promise<AdRecommendationsActionResponse> {
    return firstValueFrom(this.http.post<AdRecommendationsActionResponse>(`${this.base(brandId)}/google/recommendations/apply`, { resources }));
  }

  dismissRecommendations(brandId: string, resources: string[]): Promise<AdRecommendationsActionResponse> {
    return firstValueFrom(this.http.post<AdRecommendationsActionResponse>(`${this.base(brandId)}/google/recommendations/dismiss`, { resources }));
  }

  audiences(brandId: string): Promise<AdAudiencesResponse> {
    return firstValueFrom(this.http.get<AdAudiencesResponse>(`${this.base(brandId)}/google/audiences`));
  }

  createAudience(brandId: string, request: AdAudienceCreateRequest): Promise<AdAudience> {
    return firstValueFrom(this.http.post<AdAudience>(`${this.base(brandId)}/google/audiences`, request));
  }

  addAudienceUsers(brandId: string, audienceId: string, emails: string[]): Promise<AdAudienceUsersResponse> {
    return firstValueFrom(
      this.http.post<AdAudienceUsersResponse>(`${this.base(brandId)}/google/audiences/${encodeURIComponent(audienceId)}/users`, { emails }),
    );
  }

  async removeAudience(brandId: string, audienceId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base(brandId)}/google/audiences/${encodeURIComponent(audienceId)}`));
  }

  conversions(brandId: string): Promise<AdConversionsResponse> {
    return firstValueFrom(this.http.get<AdConversionsResponse>(`${this.base(brandId)}/google/conversions`));
  }

  createConversion(brandId: string, request: AdConversionCreateRequest): Promise<AdConversionAction> {
    return firstValueFrom(this.http.post<AdConversionAction>(`${this.base(brandId)}/google/conversions`, request));
  }

  conversionGoal(brandId: string, request: AdConversionGoalRequest): Promise<AdConversionsResponse> {
    return firstValueFrom(this.http.patch<AdConversionsResponse>(`${this.base(brandId)}/google/conversions/goals`, request));
  }

  account(brandId: string): Promise<AdAccountInfoResponse> {
    return firstValueFrom(this.http.get<AdAccountInfoResponse>(`${this.base(brandId)}/google/account`));
  }

  invite(brandId: string, request: AdInvitationRequest): Promise<AdInvitation> {
    return firstValueFrom(this.http.post<AdInvitation>(`${this.base(brandId)}/google/invitations`, request));
  }

  async removeInvitation(brandId: string, invitationId: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.base(brandId)}/google/invitations/${encodeURIComponent(invitationId)}`));
  }
}
