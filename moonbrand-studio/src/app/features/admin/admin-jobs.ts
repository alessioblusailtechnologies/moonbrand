import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminJobsResponse } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminJobsTable, AdminTabs } from './admin-ui';

// Ogni 10 secondi, finché la pagina è aperta e visibile: la coda cambia in fretta.
const REFRESH_MS = 10_000;

// I lavori di tutti: quelli in coda e in corso adesso, i falliti e i più lenti degli ultimi 7 giorni.
@Component({
  selector: 'mb-admin-jobs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, AdminJobsTable, Loader],
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Lavori</h1>
        <span class="caption">si aggiorna ogni 10 secondi</span>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="panel">
          <h2 class="strong">Adesso ({{ d.active.length }})</h2>
          <mb-admin-jobs-table [jobs]="d.active" empty="Nessun lavoro in coda o in corso." />
        </div>
        <div class="panel">
          <h2 class="strong">Falliti, ultimi 7 giorni ({{ d.failed.length }})</h2>
          <mb-admin-jobs-table [jobs]="d.failed" empty="Nessun lavoro fallito." />
        </div>
        <div class="panel">
          <h2 class="strong">I più lenti, ultimi 7 giorni</h2>
          <mb-admin-jobs-table [jobs]="d.slowest" />
        </div>
      } @else if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Riprova</button>
        </div>
      }
    </section>
  `,
  styles: `
    .admin {
      display: flex;
      flex-direction: column;
      gap: 18px;
      animation: fade-up 240ms var(--ease);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 40px 16px;
    }
  `,
})
export class AdminJobsPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminJobsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Lavori' }]);
    void this.load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void this.load();
    }, REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async load(): Promise<void> {
    if (!this.data()) this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminJobsResponse>('/v1/admin/jobs')));
    } catch (error) {
      // Durante l'aggiornamento automatico resta la lista di prima.
      if (!this.data()) this.failed.set(errorMessage(error, 'I lavori non si sono caricati.'));
    } finally {
      this.loading.set(false);
    }
  }
}
