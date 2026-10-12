import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import type { AdminCost, AdminCostPart, AdminJob, CreditCategory } from '@moonbrand/shared/api/contract';

import { lockPageScroll } from '../../ui/scroll-lock';

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

// Le voci dei crediti dette per l'admin, che sa quale servizio c'è dietro.
export const CATEGORY_LABELS: Record<CreditCategory, string> = {
  assistant: 'Claude (token)',
  image: 'Immagini',
  clip: 'Clip video',
  music: 'Musica',
  voice: 'Voce fuori campo',
  sound: 'Effetti sonori',
  subtitles: 'Sottotitoli e tempi delle parole',
  check: 'Controlli (Gemini)',
  export: 'Esportazione video (Lambda)',
  download: 'Download dei post (Zernio)',
  dictation: 'Dettatura',
  other: 'Altro',
};

export function monthName(month: string): string {
  const name = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`));
  return name.charAt(0).toUpperCase() + name.slice(1);
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
      <a routerLink="/admin/spese" routerLinkActive="on">Spese</a>
      <a routerLink="/admin/gratuiti" routerLinkActive="on">Gratuiti</a>
      <a routerLink="/admin/salute" routerLinkActive="on">Salute</a>
      <a routerLink="/admin/prompt" routerLinkActive="on">Prompt</a>
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

// Il dettaglio di un costo per voce, in una finestra: si apre cliccando un totale nelle liste.
export interface CostDetail {
  title: string;
  subtitle?: string;
  total: number;
  parts: AdminCostPart[];
}

@Component({
  selector: 'mb-admin-cost-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    @if (detail(); as d) {
      <div class="backdrop" (click)="closed.emit()"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cost-title">
        <header class="top">
          <div class="grow">
            <h2 id="cost-title" class="dialog-title">{{ d.title }}</h2>
            @if (d.subtitle) {
              <p class="caption">{{ d.subtitle }}</p>
            }
          </div>
          <span class="heading">{{ money(d.total) }}</span>
        </header>
        @if (d.parts.length === 0) {
          <p class="caption">Nessun costo.</p>
        } @else {
          <div class="bars">
            @for (part of d.parts; track part.category) {
              <div class="bar-row">
                <span class="caption">{{ labels[part.category] }}</span>
                <span class="bar"><span class="fill" [style.width.%]="d.total > 0 ? (part.usd / d.total) * 100 : 0"></span></span>
                <span class="strong-sm amount">{{ money(part.usd) }}</span>
                <span class="caption amount">{{ share(part.usd, d.total) }}</span>
              </div>
            }
          </div>
        }
        <div class="actions">
          <button class="btn btn-secondary btn-sm" type="button" (click)="closed.emit()">Chiudi</button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 91;
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: min(520px, calc(100vw - 32px));
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .top {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .dialog-title {
      margin: 0;
      color: var(--text-title);
      font-size: 17px;
      font-weight: 600;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(110px, 180px) 1fr auto 40px;
      align-items: center;
      gap: 10px;
    }
    .bar {
      height: 8px;
      border-radius: 999px;
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--primary-soft);
    }
    .amount {
      font-variant-numeric: tabular-nums;
      text-align: right;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    @media (max-width: 480px) {
      .bar-row {
        grid-template-columns: 1fr auto 40px;
      }
      .bar {
        grid-column: 1 / -1;
        grid-row: 2;
      }
    }
  `,
})
export class AdminCostDetail {
  readonly detail = input<CostDetail | null>(null);
  readonly closed = output();

  protected readonly money = money;
  protected readonly labels = CATEGORY_LABELS;

  constructor() {
    lockPageScroll(() => this.detail() !== null);
  }

  protected share(value: number, total: number): string {
    return total > 0 ? (value / total).toLocaleString('it-IT', { style: 'percent', maximumFractionDigits: 0 }) : '—';
  }
}
