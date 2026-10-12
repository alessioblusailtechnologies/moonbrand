import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminCosts } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminTabs, duration, money } from './admin-ui';

// Dove vanno i soldi: quanto costa in media ogni tipo di lavoro e ogni formato di contenuto, quanto consumano i brand
// rispetto ai crediti del loro piano, e i brand più cari del mese. 1 credito = 1 centesimo di costo vero.
@Component({
  selector: 'mb-admin-costs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader, RouterLink],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Consumi</h1>
        <button class="btn btn-secondary btn-sm" type="button" (click)="load()">Aggiorna</button>
      </header>
      <mb-admin-tabs />

      @if (data(); as d) {
        <div class="panel">
          <h2 class="strong">I piani questo mese</h2>
          <p class="caption">Quanto consuma in media un brand rispetto ai crediti del suo piano. Finché non ci sono i pagamenti ogni brand nuovo è Pro.</p>
          <div class="scroll">
            <table>
              <thead>
                <tr><th>Piano</th><th class="num">Crediti</th><th class="num">Brand</th><th class="num">Media usati</th><th class="num">Massimo</th><th class="num">Oltre il piano</th></tr>
              </thead>
              <tbody>
                @for (plan of d.plans; track plan.plan) {
                  <tr>
                    <td class="strong-sm">{{ plan.name }}</td>
                    <td class="num">{{ plan.monthlyCredits }} <span class="caption">({{ money(plan.monthlyCredits / 100) }})</span></td>
                    <td class="num">{{ plan.brands }}</td>
                    <td class="num">{{ plan.avgUsed }} <span class="caption">({{ share(plan.avgUsed, plan.monthlyCredits) }})</span></td>
                    <td class="num">{{ plan.maxUsed }}</td>
                    <td class="num" [class.bad]="plan.over > 0">{{ plan.over }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="panel">
          <h2 class="strong">Costo per contenuto, ultimi 30 giorni</h2>
          <p class="caption">I lavori sul contenuto più la conversazione da cui è nato: se una conversazione ne ha fatti più di uno, il suo costo conta per ciascuno.</p>
          <table>
            <thead><tr><th>Formato</th><th class="num">Contenuti</th><th class="num">Medio</th><th class="num">Massimo</th></tr></thead>
            <tbody>
              @for (row of d.byFormat; track row.format) {
                <tr><td>{{ row.format }}</td><td class="num">{{ row.contents }}</td><td class="num">{{ money(row.avgUsd) }}</td><td class="num">{{ money(row.maxUsd) }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2 class="strong">Costo per tipo di lavoro, ultimi 30 giorni</h2>
          <table>
            <thead><tr><th>Lavoro</th><th class="num">Quanti</th><th class="num">Costo medio</th><th class="num">Durata media</th><th class="num">Totale</th></tr></thead>
            <tbody>
              @for (row of d.byKind; track row.kind) {
                <tr>
                  <td>{{ row.kind }}</td>
                  <td class="num">{{ row.jobs }}</td>
                  <td class="num">{{ money(row.avgUsd) }}</td>
                  <td class="num nowrap">{{ duration(row.avgSeconds) }}</td>
                  <td class="num">{{ money(row.totalUsd) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="panel">
          <h2 class="strong">I brand più cari questo mese</h2>
          @if (d.topBrands.length === 0) {
            <p class="caption">Nessun consumo questo mese.</p>
          } @else {
            <div class="scroll">
              <table>
                <thead><tr><th>Brand</th><th>Utenza</th><th>Piano</th><th class="num">Crediti usati</th><th class="num">Costo</th></tr></thead>
                <tbody>
                  @for (brand of d.topBrands; track brand.brandId) {
                    <tr>
                      <td class="strong-sm">{{ brand.name }}</td>
                      <td><a [routerLink]="['/admin/utenze', brand.accountId]">{{ brand.email }}</a></td>
                      <td>{{ brand.plan }}</td>
                      <td class="num">{{ brand.used }}</td>
                      <td class="num">{{ money(brand.usd) }}</td>
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
export class AdminCostsPage {
  private readonly http = inject(HttpClient);

  protected readonly data = signal<AdminCosts | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');

  protected readonly money = money;
  protected readonly duration = duration;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Consumi' }]);
    void this.load();
  }

  protected share(used: number, total: number): string {
    return (used / total).toLocaleString('it-IT', { style: 'percent', maximumFractionDigits: 0 });
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminCosts>('/v1/admin/costs')));
    } catch (error) {
      this.failed.set(errorMessage(error, 'I consumi non si sono caricati.'));
    } finally {
      this.loading.set(false);
    }
  }
}
