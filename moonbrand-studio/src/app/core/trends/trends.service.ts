import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { TrendSearchRequest, TrendSearchResponse, TrendsResponse } from '@moonbrand/shared/api/contract';

@Injectable({ providedIn: 'root' })
export class TrendsService {
  private readonly http = inject(HttpClient);

  list(brandId: string): Promise<TrendsResponse> {
    return firstValueFrom(this.http.get<TrendsResponse>(`/v1/brands/${brandId}/trends`));
  }

  search(brandId: string, query: string): Promise<TrendSearchResponse> {
    const body: TrendSearchRequest = { query };
    return firstValueFrom(this.http.post<TrendSearchResponse>(`/v1/brands/${brandId}/trends/search`, body));
  }
}
