import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { CreditsResponse } from '@moonbrand/shared/api/contract';

import { AuthService } from '../auth/auth.service';

// I crediti dell'account: si rileggono all'accesso e ogni volta che un lavoro AI finisce (AiJobsService.follow).
@Injectable({ providedIn: 'root' })
export class CreditsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  readonly credits = signal<CreditsResponse | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.signedIn()) void this.refresh();
      else this.credits.set(null);
    });
  }

  async refresh(): Promise<void> {
    try {
      this.credits.set(await firstValueFrom(this.http.get<CreditsResponse>('/v1/credits')));
    } catch {
      // Resta il saldo di prima: si riprova al prossimo lavoro.
    }
  }
}
