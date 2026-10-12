import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AdminSpending } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { AdminTabs, CATEGORY_LABELS, money, monthName } from './admin-ui';

// Quanto si è speso in un mese per voce, come nella pagina dei crediti ma in dollari veri e per tutto il servizio:
// la parte addebitata ai clienti e quella dei lavori gratuiti, con i task da cui viene ogni voce.
@Component({
  selector: 'mb-admin-spending',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader, Select],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Spese</h1>
        @if (data(); as d) {
          <mb-select class="month" [options]="monthOptions(d.months)" [value]="d.month" (changed)="load($event)" />
        }
        <button class="btn btn-secondary btn-sm" type="button" (click)="load(data()?.month)">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="totals">
          <div class="panel stat"><span class="caption">Totale</span><span class="heading">{{ money(d.paidUsd + d.freeUsd) }}</span></div>
          <div class="panel stat"><span class="caption">Addebitato ai clienti</span><span class="heading">{{ money(d.paidUsd) }}</span></div>
          <div class="panel stat"><span class="caption">Lavori gratuiti</span><span class="heading">{{ money(d.freeUsd) }}</span></div>
        </div>

        <div class="panel">
          <h2 class="strong">Per voce</h2>
          @if (d.categories.length === 0) {
            <p class="caption">Nessun costo in questo mese.</p>
          } @else {
            <div class="bars">
              @for (item of d.categories; track item.category) {
                <div class="bar-row">
                  <span class="caption">{{ labels[item.category] }}</span>
                  <span class="bar" [title]="'Addebitato ' + money(item.paidUsd) + ' · gratuito ' + money(item.freeUsd)">
                    <span class="paid" [style.width.%]="(item.paidUsd / max(d)) * 100"></span>
                    <span class="free" [style.width.%]="(item.freeUsd / max(d)) * 100"></span>
                  </span>
                  <span class="strong-sm amount">{{ money(item.paidUsd + item.freeUsd) }}</span>
                </div>
              }
            </div>
            <p class="caption legend"><span class="dot paid"></span> addebitato <span class="dot free"></span> gratuito</p>
          }
        </div>

        @if (d.categories.length > 0) {
          <div class="panel">
            <h2 class="strong">Dettaglio</h2>
            <p class="caption">Per Claude «job» è la parte dei lavori, gli altri task sono le sue chiamate dirette (stile, letture dei passaggi...).</p>
            <div class="scroll">
              <table>
                <thead>
                  <tr>
                    <th>Voce</th><th class="num">Quanti</th><th class="num">Secondi</th><th class="num">Addebitato</th><th class="num">Gratuito</th>
                    <th class="num">Totale</th><th class="num">Quota</th><th>Task</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of d.categories; track item.category) {
                    <tr>
                      <td class="strong-sm nowrap">{{ labels[item.category] }}</td>
                      <td class="num">{{ item.count }}</td>
                      <td class="num">{{ item.seconds ?? '—' }}</td>
                      <td class="num">{{ money(item.paidUsd) }}</td>
                      <td class="num">{{ money(item.freeUsd) }}</td>
                      <td class="num">{{ money(item.paidUsd + item.freeUsd) }}</td>
                      <td class="num">{{ share(item.paidUsd + item.freeUsd, d.paidUsd + d.freeUsd) }}</td>
                      <td class="caption">
                        @for (task of item.tasks; track task.task; let last = $last) {
                          {{ task.task }} {{ money(task.usd) }}{{ last ? '' : ' · ' }}
                        }
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
    </section>
  `,
  styles: `
    .month {
      min-width: 180px;
    }
    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .stat {
      gap: 4px;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(120px, 240px) 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .bar {
      display: flex;
      height: 8px;
      border-radius: 999px;
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .paid {
      background: var(--primary-soft);
    }
    .free {
      background: var(--mint-400);
    }
    .amount {
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;
    }
    .legend {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dot.free {
      margin-left: 10px;
    }
    @media (max-width: 640px) {
      .bar-row {
        grid-template-columns: 1fr auto;
      }
      .bar {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
  `,
})
export class AdminSpendingPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminSpending | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly money = money;
  protected readonly labels = CATEGORY_LABELS;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Spese' }]);
    void this.load();
  }

  protected max(data: AdminSpending): number {
    return Math.max(...data.categories.map((item) => item.paidUsd + item.freeUsd), 0.01);
  }

  protected share(value: number, total: number): string {
    return total > 0 ? (value / total).toLocaleString('it-IT', { style: 'percent', maximumFractionDigits: 0 }) : '—';
  }

  protected monthOptions(months: string[]): SelectOption[] {
    return months.map((month) => ({ value: month, label: monthName(month) }));
  }

  protected async load(month?: string): Promise<void> {
    this.loading.set(true);
    try {
      const params: Record<string, string> = month ? { month } : {};
      this.data.set(await firstValueFrom(this.http.get<AdminSpending>('/v1/admin/spending', { params })));
    } catch (error) {
      this.data.set(null);
      this.failed.set(errorMessage(error, 'Le spese non si sono caricate.'));
    } finally {
      this.loading.set(false);
    }
  }
}
