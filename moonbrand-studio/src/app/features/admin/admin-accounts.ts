import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminAccount } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminTabs, money, total, when } from './admin-ui';

// Tutte le utenze, dalla più attiva di recente: accessi, brand, contenuti, lavori, crediti del mese e costo vero.
@Component({
  selector: 'mb-admin-accounts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader, RouterLink],
  template: `
    <section class="admin">
      <header class="head">
        <h1 class="title grow">Utenze</h1>
        <div class="field search">
          <input type="search" placeholder="Cerca email o nome" aria-label="Cerca" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
      </header>
      <mb-admin-tabs />

      @if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else if (accounts(); as list) {
        <div class="panel">
          <p class="caption">{{ shown().length }} di {{ list.length }} utenze · costo totale {{ money(sum()) }}</p>
          <div class="scroll">
            <table>
              <thead>
                <tr>
                  <th>Utenza</th>
                  <th>Creata</th>
                  <th>Ultimo accesso</th>
                  <th>Ultimo lavoro</th>
                  <th class="num">Brand</th>
                  <th class="num">Contenuti</th>
                  <th class="num">Lavori</th>
                  <th class="num">Crediti mese</th>
                  <th class="num">Costo</th>
                </tr>
              </thead>
              <tbody>
                @for (account of shown(); track account.id) {
                  <tr>
                    <td>
                      <a class="who" [routerLink]="['/admin/utenze', account.id]">
                        <span class="strong-sm">{{ account.email }}</span>
                        <span class="caption">{{ account.name }}{{ account.emailConfirmed ? '' : ' · email non confermata' }}</span>
                      </a>
                    </td>
                    <td class="nowrap">{{ when(account.createdAt) }}</td>
                    <td class="nowrap">{{ when(account.lastSignInAt) }}</td>
                    <td class="nowrap">{{ when(account.lastActivityAt) }}</td>
                    <td class="num">{{ account.brands }}</td>
                    <td class="num">{{ account.contents }}</td>
                    <td class="num">{{ account.jobs }}</td>
                    <td class="num">{{ account.creditsMonth }}</td>
                    <td class="num nowrap" [title]="'Claude ' + money(account.cost.claude) + ' · servizi ' + money(account.cost.generations)">
                      {{ money(total(account.cost)) }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
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
      flex-wrap: wrap;
    }
    .search {
      width: 280px;
      max-width: 100%;
      padding: 10px 14px;
    }
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 9px 10px;
      border-bottom: 1px solid var(--grey-100);
      text-align: left;
    }
    th {
      color: var(--text-body);
      font-weight: 500;
      white-space: nowrap;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .nowrap {
      white-space: nowrap;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      color: inherit;
      text-decoration: none;
    }
    .who:hover .strong-sm {
      color: var(--primary);
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
export class AdminAccountsPage {
  private readonly http = inject(HttpClient);

  protected readonly accounts = signal<AdminAccount[] | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');
  protected readonly query = signal('');
  protected readonly shown = computed(() => {
    const query = this.query().trim().toLowerCase();
    const list = this.accounts() ?? [];
    return query ? list.filter((account) => `${account.email} ${account.name}`.toLowerCase().includes(query)) : list;
  });
  protected readonly sum = computed(() => this.shown().reduce((value, account) => value + total(account.cost), 0));

  protected readonly money = money;
  protected readonly total = total;
  protected readonly when = when;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Utenze' }]);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.accounts.set(await firstValueFrom(this.http.get<AdminAccount[]>('/v1/admin/accounts')));
    } catch (error) {
      this.failed.set(errorMessage(error, 'Le utenze non si sono caricate.'));
    } finally {
      this.loading.set(false);
    }
  }
}
