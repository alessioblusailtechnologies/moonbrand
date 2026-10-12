import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminCost, AdminOverview } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminJobsTable, AdminTabs, money, total } from './admin-ui';

// La panoramica admin: utenze, contenuti, coda dei lavori e costi veri (Claude e servizi) degli ultimi 30 giorni.
@Component({
  selector: 'mb-admin-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, AdminJobsTable, Loader],
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Admin</h1>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="cards">
          <div class="panel card">
            <span class="caption">Utenze</span>
            <span class="heading">{{ d.accounts.total }}</span>
            <span class="caption">+{{ d.accounts.newToday }} oggi · +{{ d.accounts.new7d }} in 7 giorni</span>
          </div>
          <div class="panel card">
            <span class="caption">Attive in 7 giorni</span>
            <span class="heading">{{ d.accounts.active7d }}</span>
            <span class="caption">hanno fatto l'accesso</span>
          </div>
          <div class="panel card">
            <span class="caption">Brand</span>
            <span class="heading">{{ d.brands }}</span>
            <span class="caption">{{ d.contents.total }} contenuti · +{{ d.contents.new7d }} in 7 giorni</span>
          </div>
          <div class="panel card">
            <span class="caption">Pubblicati</span>
            <span class="heading">{{ d.published }}</span>
            <span class="caption">post usciti sui social</span>
          </div>
          <div class="panel card">
            <span class="caption">Lavori adesso</span>
            <span class="heading">{{ d.jobs.running }} <small>in corso</small> · {{ d.jobs.queued }} <small>in coda</small></span>
            <span class="caption">ultime 24 h: {{ d.jobs.done24h }} fatti · <span [class.bad]="d.jobs.failed24h > 0">{{ d.jobs.failed24h }} falliti</span></span>
          </div>
        </div>

        <div class="cards">
          @for (span of spans; track span.key) {
            <div class="panel card">
              <span class="caption">Costo {{ span.label }}</span>
              <span class="heading">{{ money(total(d.cost[span.key])) }}</span>
              <span class="caption">Claude {{ money(d.cost[span.key].claude) }} · servizi {{ money(d.cost[span.key].generations) }}</span>
            </div>
          }
        </div>

        <div class="panel">
          <div class="row">
            <h2 class="strong grow">Costo per giorno, ultimi 30 giorni</h2>
            <span class="legend caption"><i class="claude"></i> Claude <i class="gen"></i> servizi</span>
          </div>
          <div class="chart">
            @for (day of d.daily; track day.date) {
              <div class="day" [title]="day.date + ': ' + money(total(day)) + ' (Claude ' + money(day.claude) + ', servizi ' + money(day.generations) + ')'">
                <span class="bar gen" [style.height.%]="(day.generations / peak()) * 100"></span>
                <span class="bar claude" [style.height.%]="(day.claude / peak()) * 100"></span>
              </div>
            }
          </div>
          <div class="axis caption">
            <span>{{ d.daily[0]?.date }}</span>
            <span>massimo {{ money(peak()) }} al giorno</span>
            <span>{{ d.daily[d.daily.length - 1]?.date }}</span>
          </div>
        </div>

        <div class="panel">
          <h2 class="strong">Servizi, ultimi 30 giorni</h2>
          @if (d.byTask.length === 0) {
            <p class="caption">Nessun consumo.</p>
          } @else {
            <table>
              <thead><tr><th>Servizio</th><th>Modello</th><th class="num">Chiamate</th><th class="num">Costo</th></tr></thead>
              <tbody>
                @for (row of d.byTask; track row.task + row.model) {
                  <tr><td>{{ row.task }}</td><td class="caption">{{ row.model }}</td><td class="num">{{ row.count }}</td><td class="num">{{ money(row.usd) }}</td></tr>
                }
              </tbody>
            </table>
          }
        </div>

        <div class="panel">
          <h2 class="strong">Ultimi lavori falliti</h2>
          <mb-admin-jobs-table [jobs]="d.failures" empty="Nessun lavoro fallito." />
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
    .head,
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
    }
    .card {
      gap: 4px;
      padding: 16px 18px;
    }
    .card .heading {
      font-variant-numeric: tabular-nums;
    }
    small {
      font-size: 13px;
      font-weight: 400;
      color: var(--text-body);
    }
    .bad {
      color: var(--danger);
      font-weight: 600;
    }
    .chart {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 160px;
      padding-top: 8px;
    }
    .day {
      display: flex;
      flex: 1;
      flex-direction: column-reverse;
      height: 100%;
      min-width: 0;
    }
    .bar {
      display: block;
      width: 100%;
    }
    .bar.claude,
    .legend .claude {
      background: var(--primary);
    }
    .bar.gen,
    .legend .gen {
      background: var(--mint-400);
    }
    .day .bar:last-child {
      border-radius: 3px 3px 0 0;
    }
    .legend {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .legend i {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }
    .axis {
      display: flex;
      justify-content: space-between;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 8px 10px;
      border-bottom: 1px solid var(--grey-100);
      text-align: left;
    }
    th {
      color: var(--text-body);
      font-weight: 500;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
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
export class AdminOverviewPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminOverview | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');
  protected readonly peak = computed(() => Math.max(0.01, ...(this.data()?.daily ?? []).map((day) => total(day))));

  protected readonly spans: { key: 'today' | 'days7' | 'days30'; label: string }[] = [
    { key: 'today', label: 'oggi' },
    { key: 'days7', label: 'ultimi 7 giorni' },
    { key: 'days30', label: 'ultimi 30 giorni' },
  ];
  protected readonly money = money;
  protected readonly total = (cost: AdminCost) => total(cost);

  constructor() {
    pageHeader(() => [{ label: 'Admin' }]);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminOverview>('/v1/admin/overview')));
    } catch (error) {
      this.failed.set(errorMessage(error, 'La panoramica non si è caricata.'));
    } finally {
      this.loading.set(false);
    }
  }
}
