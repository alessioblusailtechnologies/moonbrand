import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import type { AdminCost, AdminJob } from '@moonbrand/shared/api/contract';

// La sezione admin è interna (due persone): i testi sono in italiano, senza i18n.

export const total = (cost: AdminCost) => cost.claude + cost.generations;

export function money(value: number): string {
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function when(at: string | null): string {
  if (!at) return '—';
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}

export function duration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${String(seconds % 60).padStart(2, '0')} s`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

export const STATUS_LABELS: Record<AdminJob['status'], string> = {
  queued: 'in coda',
  running: 'in corso',
  done: 'fatto',
  failed: 'fallito',
  stopped: 'fermato',
};

@Component({
  selector: 'mb-admin-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="tabs" aria-label="Sezioni admin">
      <a routerLink="/admin" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: true }">Panoramica</a>
      <a routerLink="/admin/utenze" routerLinkActive="on">Utenze</a>
      <a routerLink="/admin/contenuti" routerLinkActive="on">Contenuti</a>
      <a routerLink="/admin/lavori" routerLinkActive="on">Lavori</a>
      <a routerLink="/admin/consumi" routerLinkActive="on">Consumi</a>
      <a routerLink="/admin/salute" routerLinkActive="on">Salute</a>
    </nav>
  `,
  styles: `
    :host {
      align-self: flex-start;
      max-width: 100%;
    }
    .tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 4px;
      border-radius: 12px;
      background: var(--surface-sunken);
    }
    a {
      padding: 7px 14px;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-body);
      text-decoration: none;
      white-space: nowrap;
    }
    a.on {
      background: var(--white);
      color: var(--text-title);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    }
  `,
})
export class AdminTabs {}

// I lavori in una tabella: quando, chi, cosa, com'è andato, quanto è durato e costato, la richiesta o l'errore.
@Component({
  selector: 'mb-admin-jobs-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (jobs().length === 0) {
      <p class="caption none">{{ empty() }}</p>
    } @else {
      <div class="scroll">
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              @if (showAccount()) {
                <th>Utenza</th>
              }
              <th>Brand</th>
              <th>Lavoro</th>
              <th>Stato</th>
              <th class="num">Durata</th>
              <th class="num">Costo</th>
              <th>Richiesta / errore</th>
            </tr>
          </thead>
          <tbody>
            @for (job of jobs(); track job.id) {
              <tr>
                <td class="nowrap">{{ when(job.createdAt) }}</td>
                @if (showAccount()) {
                  <td class="nowrap"><a [routerLink]="['/admin/utenze', job.accountId]">{{ job.email }}</a></td>
                }
                <td class="nowrap">{{ job.brandName ?? '—' }}</td>
                <td class="nowrap"><a [routerLink]="['/admin/lavori', job.id]" title="Dove è andato il tempo">{{ job.kind }}</a></td>
                <td><span class="status" [class]="job.status">{{ statusLabels[job.status] }}</span></td>
                <td class="num nowrap">{{ duration(job.seconds) }}</td>
                <td class="num nowrap" [title]="'Claude ' + money(job.cost.claude) + ' · servizi ' + money(job.cost.generations)">
                  {{ money(total(job.cost)) }}
                </td>
                <td class="text">
                  @if (job.error) {
                    <span class="error">{{ job.error }}</span>
                  } @else {
                    {{ job.request ?? '' }}
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .scroll {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      padding: 8px 10px;
      border-bottom: 1px solid var(--grey-100);
      color: var(--text-body);
      font-weight: 500;
      text-align: left;
      white-space: nowrap;
    }
    td {
      padding: 9px 10px;
      border-bottom: 1px solid var(--grey-100);
      vertical-align: top;
    }
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .nowrap {
      white-space: nowrap;
    }
    .text {
      min-width: 240px;
      max-width: 520px;
      color: var(--text-body);
    }
    .error {
      color: var(--danger);
    }
    a {
      color: var(--primary);
      text-decoration: underline;
      text-decoration-color: var(--grey-300);
      text-underline-offset: 3px;
    }
    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--surface-sunken);
      font-size: 12px;
      white-space: nowrap;
    }
    .status.running,
    .status.queued {
      background: var(--primary-soft);
      color: var(--white);
    }
    .status.failed {
      background: var(--danger);
      color: var(--white);
    }
    .none {
      padding: 12px 0;
    }
  `,
})
export class AdminJobsTable {
  readonly jobs = input.required<AdminJob[]>();
  readonly showAccount = input(true);
  readonly empty = input('Nessun lavoro.');

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly when = when;
  protected readonly duration = duration;
  protected readonly money = money;
  protected readonly total = total;
}
