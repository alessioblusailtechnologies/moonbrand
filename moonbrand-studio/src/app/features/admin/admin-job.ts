import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { AdminJobTimeline } from '@moonbrand/shared/api/contract';

import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { Loader } from '../../ui/loader';
import { AdminTabs, duration, money, STATUS_LABELS, total, when } from './admin-ui';

// Dove è andato il tempo di un lavoro: quanto ha pensato il modello e quanto ha aspettato ogni strumento, poi le
// chiamate una per una. Gli strumenti in parallelo si sovrappongono: la loro somma può superare la durata.
@Component({
  selector: 'mb-admin-job',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTabs, Loader, RouterLink],
  styleUrl: './admin.scss',
  template: `
    <section class="admin">
      <mb-admin-tabs />
      @if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else if (data(); as d) {
        <div class="panel">
          <h1 class="title">{{ d.job.kind }} · {{ statusLabels[d.job.status] }} · {{ duration(d.job.seconds) }}</h1>
          <p class="caption">
            <a class="link" [routerLink]="['/admin/utenze', d.job.accountId]">{{ d.job.email }}</a>
            · {{ d.job.brandName ?? 'senza brand' }} · partito {{ when(d.job.startedAt ?? d.job.createdAt) }}
            · costo {{ money(cost(d.job.cost)) }} (Claude {{ money(d.job.cost.claude) }}, servizi {{ money(d.job.cost.generations) }})
          </p>
          @if (d.job.request) {
            <p class="request">«{{ d.job.request }}»</p>
          }
          @if (d.job.error) {
            <p class="bad">{{ d.job.error }}</p>
          }
        </div>

        @if (!d.available) {
          <div class="panel"><p class="caption">La sessione di questo lavoro non c'è: non usa Claude Code, oppure non è ancora stata copiata.</p></div>
        } @else {
          <div class="panel">
            <h2 class="strong">Dove è andato il tempo</h2>
            <div class="bars">
              <div class="bar-row">
                <span class="name strong-sm">il modello pensa</span>
                <span class="bar"><span class="fill model" [style.width.%]="(d.modelSeconds / scale()) * 100"></span></span>
                <span class="num nowrap">{{ duration(d.modelSeconds) }}</span>
              </div>
              @for (tool of d.tools; track tool.name) {
                <div class="bar-row">
                  <span class="name">{{ tool.name }} <span class="caption">× {{ tool.calls }}</span></span>
                  <span class="bar"><span class="fill" [style.width.%]="(tool.seconds / scale()) * 100"></span></span>
                  <span class="num nowrap" [title]="'la più lunga: ' + duration(tool.maxSeconds)">{{ duration(tool.seconds) }}</span>
                </div>
              }
            </div>
            <p class="caption">Gli strumenti partiti insieme si sovrappongono: la somma può superare la durata del lavoro.</p>
          </div>

          <div class="panel">
            <h2 class="strong">Le chiamate ({{ d.steps.length }})</h2>
            <div class="scroll">
              <table>
                <thead><tr><th>Ora</th><th class="num">Durata</th><th>Strumento</th><th>Con</th></tr></thead>
                <tbody>
                  @for (step of d.steps; track $index) {
                    <tr [class.slow]="step.seconds >= 60">
                      <td class="nowrap">{{ time(step.at) }}</td>
                      <td class="num nowrap">{{ duration(step.seconds) }}</td>
                      <td class="nowrap">{{ step.tool }}</td>
                      <td class="detail">{{ step.detail }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      } @else {
        <div class="empty">
          <p class="caption">{{ failed() }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">Riprova</button>
        </div>
      }
    </section>
  `,
  styles: `
    .request {
      color: var(--text-body);
      font-style: italic;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(140px, 240px) 1fr 90px;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .bar {
      height: 10px;
      border-radius: 999px;
      background: var(--surface-sunken);
      overflow: hidden;
    }
    .fill {
      display: block;
      height: 100%;
      border-radius: inherit;
      background: var(--mint-400);
    }
    .fill.model {
      background: var(--primary);
    }
    .detail {
      max-width: 640px;
      color: var(--text-body);
      font-family: ui-monospace, monospace;
      font-size: 12px;
      word-break: break-all;
    }
    tr.slow td {
      background: color-mix(in srgb, var(--danger) 8%, transparent);
    }
  `,
})
export class AdminJobPage {
  private readonly http = inject(HttpClient);

  readonly jobId = input.required<string>();

  protected readonly data = signal<AdminJobTimeline | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal('');
  // La barra più lunga è il riferimento.
  protected readonly scale = computed(() => {
    const d = this.data();
    return Math.max(1, d?.modelSeconds ?? 0, ...(d?.tools ?? []).map((tool) => tool.seconds));
  });

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly duration = duration;
  protected readonly money = money;
  protected readonly cost = total;
  protected readonly when = when;

  constructor() {
    pageHeader(() => [{ label: 'Admin', link: '/admin' }, { label: 'Lavori', link: '/admin/lavori' }, { label: this.data()?.job.kind ?? '…' }]);
    effect(() => {
      const id = this.jobId();
      untracked(() => void this.load(id));
    });
  }

  protected reload(): void {
    void this.load(this.jobId());
  }

  protected time(at: string): string {
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(at));
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      this.data.set(await firstValueFrom(this.http.get<AdminJobTimeline>(`/v1/admin/jobs/${id}/timeline`)));
    } catch (error) {
      this.data.set(null);
      this.failed.set(errorMessage(error, 'Il lavoro non si è caricato.'));
    } finally {
      this.loading.set(false);
    }
  }
}
