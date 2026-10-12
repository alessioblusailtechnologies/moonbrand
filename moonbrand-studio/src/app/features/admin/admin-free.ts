import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminFreeJobs } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { AdminCostDetail, AdminTabs, CATEGORY_LABELS, duration, money, monthName, STATUS_LABELS, total, when, type CostDetail } from './admin-ui';

// I lavori gratuiti di un mese: l'onboarding (lettura del sito, stile, prime idee, progetto video, esempi grafici sul
// brand in bozza) e i saluti del mattino. Li paga moonbrand: ai clienti non scalano crediti, ma entrano nel costo di
// un'utenza, per questo i crediti di un'utenza sono meno del suo costo.
@Component({
  selector: 'mb-admin-free',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminCostDetail, AdminTabs, Loader, RouterLink, Select],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Lavori gratuiti</h1>
        @if (data(); as d) {
          <mb-select class="month" [options]="monthOptions(d.months)" [value]="d.month" (changed)="load($event)" />
        }
        <button class="btn btn-secondary btn-sm" type="button" (click)="load(data()?.month)">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="split">
          <div class="panel">
            <h2 class="strong">Per tipo di lavoro · {{ money(d.totalUsd) }}</h2>
            @if (d.byKind.length === 0) {
              <p class="caption">Nessun lavoro gratuito in questo mese.</p>
            } @else {
              <table>
                <thead><tr><th>Lavoro</th><th class="num">Quanti</th><th class="num">Medio</th><th class="num">Totale</th></tr></thead>
                <tbody>
                  @for (row of d.byKind; track row.kind) {
                    <tr><td>{{ row.kind }}</td><td class="num">{{ row.jobs }}</td><td class="num">{{ money(row.usd / row.jobs) }}</td><td class="num">{{ money(row.usd) }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
          <div class="panel">
            <h2 class="strong">Per voce</h2>
            @if (d.byCategory.length === 0) {
              <p class="caption">Nessun costo.</p>
            } @else {
              <table>
                <tbody>
                  @for (row of d.byCategory; track row.category) {
                    <tr><td>{{ labels[row.category] }}</td><td class="num">{{ money(row.usd) }}</td></tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>

        @if (d.jobs.length > 0) {
          <div class="panel">
            <h2 class="strong">I lavori</h2>
            <div class="scroll">
              <table>
                <thead>
                  <tr><th>Quando</th><th>Utenza</th><th>Brand</th><th>Lavoro</th><th>Stato</th><th class="num">Durata</th><th class="num">Costo</th></tr>
                </thead>
                <tbody>
                  @for (job of d.jobs; track job.id) {
                    <tr>
                      <td class="nowrap">{{ when(job.createdAt) }}</td>
                      <td class="nowrap"><a [routerLink]="['/admin/utenze', job.accountId]">{{ job.email }}</a></td>
                      <td class="nowrap">{{ job.brandName ?? '—' }}</td>
                      <td class="nowrap"><a [routerLink]="['/admin/lavori', job.id]">{{ job.kind }}</a></td>
                      <td class="nowrap">{{ statusLabels[job.status] }}</td>
                      <td class="num nowrap">{{ duration(job.seconds) }}</td>
                      <td class="num nowrap">
                        <button class="cost-link" type="button" title="Dettaglio per voce" (click)="showJob(job)">{{ money(total(job.cost)) }}</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      } @else if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Riprova</button>
        </div>
      }
      <mb-admin-cost-detail [detail]="detail()" (closed)="detail.set(null)" />
    </section>
  `,
  styles: `
    .month {
      min-width: 180px;
    }
    .split {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
    }
  `,
})
export class AdminFreePage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminFreeJobs | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly money = money;
  protected readonly when = when;
  protected readonly duration = duration;
  protected readonly total = total;
  protected readonly labels = CATEGORY_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly detail = signal<CostDetail | null>(null);

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Lavori gratuiti' }]);
    void this.load();
  }

  protected showJob(job: AdminFreeJobs['jobs'][number]): void {
    this.detail.set({ title: job.kind, subtitle: `${job.email} · ${job.brandName ?? 'Brand'} · ${when(job.createdAt)}`, total: total(job.cost), parts: job.parts });
  }

  protected monthOptions(months: string[]): SelectOption[] {
    return months.map((month) => ({ value: month, label: monthName(month) }));
  }

  protected async load(month?: string): Promise<void> {
    this.loading.set(true);
    try {
      const params: Record<string, string> = month ? { month } : {};
      this.data.set(await firstValueFrom(this.http.get<AdminFreeJobs>('/v1/admin/free-jobs', { params })));
    } catch (error) {
      this.data.set(null);
      this.failed.set(errorMessage(error, 'I lavori gratuiti non si sono caricati.'));
    } finally {
      this.loading.set(false);
    }
  }
}
