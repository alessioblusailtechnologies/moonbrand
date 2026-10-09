import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, linkedSignal, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { CreditActivity, CreditUsageResponse } from '@moonbrand/shared/api/contract';
import { SUBSCRIPTION_PLANS } from '@moonbrand/shared/domain/subscription';

import { BrandsService } from '../../core/brands/brands.service';
import { CreditsService } from '../../core/credits/credits.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';

// Crediti e utilizzo del brand attivo: quanto si è consumato nel mese, per tipo di lavoro e attività per attività,
// con l'export in CSV. Chi usa moonbrand deve poter sapere come sono finiti i suoi crediti.
@Component({
  selector: 'mb-credits-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <section class="credits">
      <header class="head">
        <div class="grow texts">
          <h1 class="title">{{ 'credits.title' | t }}</h1>
          <p class="caption">{{ 'credits.intro' | t }}</p>
        </div>
        @if (usage(); as data) {
          <label class="month">
            <span class="label">{{ 'credits.month' | t }}</span>
            <select class="sunken" [value]="data.month" (change)="month.set($any($event.target).value)">
              @for (option of data.months; track option) {
                <option [value]="option">{{ monthName(option) }}</option>
              }
            </select>
          </label>
        }
      </header>

      @if (loading()) {
        <div class="empty"><span class="spinner"></span></div>
      } @else if (usage(); as data) {
        <div class="panel summary">
          <div class="grow texts">
            <span class="label">{{ 'credits.used' | t }}</span>
            <span class="display">{{ number(data.used) }}</span>
          </div>
          @if (plan(); as current) {
            <div class="texts right">
              <span class="strong-sm">{{ 'credits.plan' | t: { plan: current.name } }}</span>
              <span class="caption">{{ 'credits.left' | t: current.hint }}</span>
            </div>
          }
        </div>

        @if (data.activities.length === 0) {
          <div class="panel empty"><p class="caption">{{ 'credits.empty' | t }}</p></div>
        } @else {
          <div class="panel">
            <h2 class="strong">{{ 'credits.byCategory' | t }}</h2>
            <div class="bars">
              @for (item of data.categories; track item.category) {
                <div class="bar-row">
                  <span class="caption name">{{ categoryName(item.category) }}</span>
                  <span class="bar"><span class="fill" [style.width.%]="(item.credits / data.used) * 100"></span></span>
                  <span class="strong-sm amount">{{ number(item.credits) }}</span>
                </div>
              }
            </div>
          </div>

          <div class="panel list">
            <div class="list-head">
              <h2 class="strong grow">{{ 'credits.activities' | t }}</h2>
              <button class="btn btn-secondary btn-sm" type="button" (click)="download(data)">
                <mb-icon name="download" [size]="14" /> {{ 'credits.download' | t }}
              </button>
            </div>
            @for (activity of data.activities; track activity.id) {
              <details class="activity">
                <summary>
                  <span class="when caption">{{ when(activity.at) }}</span>
                  <span class="grow texts">
                    <span class="strong-sm">{{ kindName(activity) }}{{ activity.title ? ' · ' + activity.title : '' }}</span>
                    @if (activity.request) {
                      <span class="caption request">{{ activity.request }}</span>
                    }
                  </span>
                  <span class="strong-sm amount">{{ number(activity.credits) }}</span>
                  <mb-icon name="chevron-down" [size]="16" class="chevron" />
                </summary>
                <div class="parts">
                  @for (part of activity.parts; track part.category) {
                    <div class="part caption">
                      <span class="grow">{{ categoryName(part.category) }}</span>
                      <span class="detail">
                        {{ 'credits.count' | t: { n: part.count } }}{{ part.seconds !== undefined ? ' · ' + ('credits.seconds' | t: { n: number(part.seconds) }) : '' }}
                      </span>
                      <span class="amount">{{ number(part.credits) }}</span>
                    </div>
                  }
                </div>
              </details>
            }
          </div>
        }
      } @else {
        <div class="empty">
          <p class="caption">{{ 'credits.loadFailed' | t }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    .credits {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .head {
      display: flex;
      align-items: flex-end;
      gap: 18px;
      flex-wrap: wrap;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .right {
      align-items: flex-end;
      text-align: right;
    }
    .month {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 180px;
    }
    .summary {
      flex-direction: row;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 40px 16px;
      text-align: center;
    }
    .bars {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(120px, 220px) 1fr auto;
      align-items: center;
      gap: 12px;
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
    .list {
      gap: 0;
      padding: 8px 20px;
    }
    .list-head {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0 12px;
    }
    .activity {
      border-top: 1px solid var(--grey-100);
    }
    summary {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 14px 0;
      list-style: none;
      cursor: pointer;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    .when {
      flex: none;
      width: 112px;
      font-variant-numeric: tabular-nums;
    }
    .request {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chevron {
      flex: none;
      color: var(--grey-300);
      transition: transform 120ms var(--ease);
    }
    details[open] .chevron {
      transform: rotate(180deg);
    }
    .parts {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0 0 14px 126px;
      padding: 10px 14px;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
    }
    .part {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .detail {
      white-space: nowrap;
    }
    @media (max-width: 640px) {
      .bar-row {
        grid-template-columns: 1fr auto;
      }
      .bar {
        grid-column: 1 / -1;
        grid-row: 2;
      }
      .when {
        width: 72px;
      }
      .parts {
        margin-left: 0;
      }
      .detail {
        display: none;
      }
    }
  `,
})
export class CreditsPage {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly brands = inject(BrandsService);
  private readonly credits = inject(CreditsService);
  protected readonly i18n = inject(I18nService);

  protected readonly usage = signal<CreditUsageResponse | null>(null);
  protected readonly loading = signal(true);
  private readonly brandId = computed(() => this.brands.activeBrand()?.id ?? null);
  // Il mese scelto; null è il mese in corso, e cambiando brand si riparte da lì.
  protected readonly month = linkedSignal<string | null, string | null>({ source: this.brandId, computation: () => null });

  // Piano e crediti rimasti valgono per il mese in corso.
  protected readonly plan = computed(() => {
    const credits = this.credits.credits();
    const usage = this.usage();
    if (!credits || !usage || usage.month !== usage.months[0]) return null;
    const intl = this.i18n.intl();
    const date = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long' }).format(new Date(`${credits.renewsOn}T12:00:00`));
    return {
      name: SUBSCRIPTION_PLANS[credits.plan].name,
      hint: { left: Math.max(credits.remaining, 0).toLocaleString(intl), total: credits.monthlyCredits.toLocaleString(intl), date },
    };
  });

  constructor() {
    pageHeader(() => [{ label: this.i18n.t('profile.title'), link: '/impostazioni' }, { label: this.i18n.t('credits.title') }]);
    effect(() => {
      const brandId = this.brandId();
      const month = this.month();
      if (brandId) untracked(() => void this.load(brandId, month));
    });
  }

  protected reload(): void {
    const brandId = this.brandId();
    if (brandId) void this.load(brandId, this.month());
  }

  private async load(brandId: string, month: string | null): Promise<void> {
    this.loading.set(true);
    try {
      const params: Record<string, string> = { brandId, ...(month && { month }) };
      const usage = await firstValueFrom(this.http.get<CreditUsageResponse>('/v1/credits/usage', { params }));
      if (this.brandId() === brandId) this.usage.set(usage);
    } catch (error) {
      this.usage.set(null);
      this.toast.show(errorMessage(error, this.i18n.t('credits.loadFailed')));
    } finally {
      if (this.brandId() === brandId) this.loading.set(false);
    }
  }

  protected number(value: number): string {
    return value.toLocaleString(this.i18n.intl(), { maximumFractionDigits: 2 });
  }

  protected monthName(month: string): string {
    const name = new Intl.DateTimeFormat(this.i18n.intl(), { month: 'long', year: 'numeric' }).format(new Date(`${month}-15T12:00:00`));
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  protected when(at: string): string {
    return new Intl.DateTimeFormat(this.i18n.intl(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
  }

  protected categoryName(category: CreditUsageResponse['categories'][number]['category']): string {
    return this.i18n.t(`credits.category.${category}`);
  }

  protected kindName(activity: CreditActivity): string {
    return this.i18n.t(`credits.kind.${activity.kind}`);
  }

  // Una riga per voce di ogni attività: data, attività, titolo, richiesta, voce, quantità, secondi e crediti.
  protected download(data: CreditUsageResponse): void {
    const t = (key: Parameters<I18nService['t']>[0]) => this.i18n.t(key);
    const header = [t('credits.csv.date'), t('credits.csv.activity'), t('credits.csv.title'), t('credits.csv.request'), t('credits.csv.category'), t('credits.csv.count'), t('credits.csv.seconds'), t('credits.csv.credits')];
    const rows = data.activities.flatMap((activity) =>
      activity.parts.map((part) => [
        activity.at,
        this.kindName(activity),
        activity.title ?? '',
        activity.request ?? '',
        this.categoryName(part.category),
        String(part.count),
        part.seconds === undefined ? '' : String(part.seconds),
        part.credits.toFixed(2),
      ]),
    );
    const cell = (value: string) => (/[",;\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const csv = [header, ...rows].map((row) => row.map(cell).join(',')).join('\n');
    // Il BOM fa aprire a Excel il file in UTF-8, con gli accenti giusti.
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `moonbrand-crediti-${data.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
