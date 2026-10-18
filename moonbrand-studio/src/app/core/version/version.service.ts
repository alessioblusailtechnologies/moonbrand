import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { VersionResponse } from '@moonbrand/shared/api/contract';

import { version } from '../../../../package.json';

// Le versioni per la riga in fondo alle impostazioni: quella dello studio è nel bundle (dal package.json, alla build),
// quelle di API e motore AI le dice l'API, che le legge all'avvio. Si chiedono una volta sola.
@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly http = inject(HttpClient);
  readonly studio = version;
  readonly server = signal<VersionResponse | null>(null);
  private asked = false;

  load(): void {
    if (this.asked) return;
    this.asked = true;
    firstValueFrom(this.http.get<VersionResponse>('/v1/version')).then(
      (response) => this.server.set(response),
      () => (this.asked = false),
    );
  }
}
