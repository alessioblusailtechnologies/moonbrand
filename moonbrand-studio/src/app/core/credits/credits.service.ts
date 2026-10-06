import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { CreditsResponse } from '@moonbrand/shared/api/contract';

import { AuthService } from '../auth/auth.service';
import { BrandsService } from '../brands/brands.service';

// I crediti del brand attivo: piani e crediti sono per brand. Si rileggono all'accesso, cambiando brand e ogni volta
// che un lavoro AI finisce (AiJobsService.follow).
@Injectable({ providedIn: 'root' })
export class CreditsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly brandId = computed(() => this.brands.activeBrand()?.id ?? null);

  readonly credits = signal<CreditsResponse | null>(null);

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      this.credits.set(null);
      if (this.auth.signedIn() && brandId) untracked(() => void this.refresh());
    });
  }

  async refresh(): Promise<void> {
    const brandId = this.brandId();
    if (!brandId) return;
    try {
      const credits = await firstValueFrom(this.http.get<CreditsResponse>('/v1/credits', { params: { brandId } }));
      // Un brand lasciato nel frattempo non mostra i suoi crediti su quello nuovo.
      if (this.brandId() === brandId) this.credits.set(credits);
    } catch {
      // Resta il saldo di prima: si riprova al prossimo lavoro.
    }
  }
}
