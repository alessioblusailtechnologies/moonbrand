import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { BrandSummary, CreateBrandRequest, ReferenceUploadResponse } from '@moonbrand/shared/api/contract';
import type { BrandDraft } from '@moonbrand/shared/domain/brand';

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

  async create(id: string, draft: BrandDraft, referenceExamples: string[]): Promise<BrandSummary> {
    const body: CreateBrandRequest = { ...draft, id, referenceExamples };
    const brand = await firstValueFrom(this.http.post<BrandSummary>('/v1/brands', body));
    this.brands.update((list) => [...list, brand]);
    this.auth.activeBrandId.set(brand.id);
    return brand;
  }

  uploadReference(brandId: string, dataUri: string): Promise<ReferenceUploadResponse> {
    return firstValueFrom(this.http.post<ReferenceUploadResponse>(`/v1/brands/${brandId}/references`, { dataUri }));
  }

  async removeReference(brandId: string, path: string): Promise<void> {
    const name = path.split('/').pop() ?? '';
    await firstValueFrom(this.http.delete(`/v1/brands/${brandId}/references/${encodeURIComponent(name)}`));
  }
}
