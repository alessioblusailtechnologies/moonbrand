import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminHealth } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminJobsTable, AdminTabs, duration, when } from './admin-ui';

// Oltre questo tempo in coda, il worker probabilmente è fermo.
const QUEUE_ALARM_SECONDS = 120;

// Cosa non va: worker fermo o lavori bloccati, canali social che hanno chiuso l'accesso, pubblicazioni fallite,
// generazioni (clip, immagini) finite in errore. Le email non hanno ancora un registro: qui non ci sono.
@Component({
  selector: 'mb-admin-health',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, AdminJobsTable, Loader, RouterLink],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Salute</h1>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="panel">
          <h2 class="strong">Worker</h2>
          <p [class.bad]="queueAlarm(d)">
            @if (d.oldestQueuedSeconds === null) {
              Nessun lavoro in coda.
            } @else {
              Il lavoro in coda da più tempo aspetta da {{ duration(d.oldestQueuedSeconds) }}{{ queueAlarm(d) ? ': il worker potrebbe essere fermo.' : '.' }}
            }
          </p>
          <p class="caption">Ultimo lavoro partito {{ when(d.lastStartedAt) }} · ultimo finito {{ when(d.lastFinishedAt) }}</p>
        </div>

        <div class="panel">
          <h2 class="strong">Lavori bloccati ({{ d.stuck.length }})</h2>
          <p class="caption">In corso da più di 30 minuti, o il worker non li sta più seguendo.</p>
          <mb-admin-jobs-table [jobs]="d.stuck" empty="Nessun lavoro bloccato." />
        </div>

        <div class="panel">
          <h2 class="strong">Canali scollegati ({{ d.lostChannels.length }})</h2>
          @if (d.lostChannels.length === 0) {
            <p class="caption">Tutti i canali collegati funzionano.</p>
          } @else {
            <table>
              <thead><tr><th>Brand</th><th>Canale</th><th>Utenza</th></tr></thead>
              <tbody>
                @for (row of d.lostChannels; track row.brandId + row.channel) {
                  <tr><td>{{ row.brandName }}</td><td>{{ row.channel }}</td><td><a [routerLink]="['/admin/utenze', row.accountId]">{{ row.email }}</a></td></tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Pubblicazioni fallite, ultimi 7 giorni ({{ d.failedPublications.length }})</h2>
          @if (d.failedPublications.length === 0) {
            <p class="caption">Nessuna.</p>
          } @else {
            <div class="scroll">
              <table>
                <thead><tr><th>Quando</th><th>Brand</th><th>Canale</th><th>Utenza</th><th>Errore</th></tr></thead>
                <tbody>
                  @for (row of d.failedPublications; track row.id) {
                    <tr>
                      <td class="nowrap">{{ when(row.at) }}</td><td>{{ row.brandName }}</td><td>{{ row.channel }}</td><td>{{ row.email }}</td>
                      <td class="bad">{{ row.error }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Generazioni in errore, ultimi 7 giorni ({{ d.failedGenerations.length }})</h2>
          <p class="caption">Clip, immagini, musica: quelle bloccate dai filtri dei servizi e quelle andate in timeout.</p>
          @if (d.failedGenerations.length === 0) {
            <p class="caption">Nessuna.</p>
          } @else {
            <div class="scroll">
              <table>
                <thead><tr><th>Quando</th><th>Servizio</th><th>Modello</th><th class="num">Durata</th><th>Utenza</th><th>Errore</th></tr></thead>
                <tbody>
                  @for (row of d.failedGenerations; track $index) {
                    <tr>
                      <td class="nowrap">{{ when(row.at) }}</td><td>{{ row.task }}</td><td class="caption">{{ row.model }}</td>
                      <td class="num nowrap">{{ duration(row.seconds) }}</td><td>{{ row.email ?? '—' }}</td><td class="bad">{{ row.error }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
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
})
export class AdminHealthPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminHealth | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly when = when;
  protected readonly duration = duration;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Salute' }]);
    void this.load();
  }

  protected queueAlarm(health: AdminHealth): boolean {
    return (health.oldestQueuedSeconds ?? 0) > QUEUE_ALARM_SECONDS;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminHealth>('/v1/admin/health')));
    } catch (error) {
      this.failed.set(errorMessage(error, 'La salute del servizio non si è caricata.'));
    } finally {
      this.loading.set(false);
    }
  }
}
