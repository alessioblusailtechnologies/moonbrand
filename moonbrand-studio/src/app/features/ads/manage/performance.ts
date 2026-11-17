import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import type { Ad, AdDailyMetrics, AdInsights } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Loader } from '../../../ui/loader';
import { count, day, daysAgo, money, percent, shortDate } from './format';

type Metric = 'spend' | 'clicks' | 'impressions' | 'conversions';
const RANGES = [7, 30, 90] as const;

// Il grafico: una barra al giorno, un'unica serie (la misura scelta), alta 160 px su una griglia di 3 linee.
const H = 160;
const PAD_TOP = 8;
const PAD_BOTTOM = 22;
const PAD_LEFT = 44;

// Andamento della campagna: totali del periodo, una barra al giorno e, per la ricerca, la quota di impressioni.
@Component({
  selector: 'mb-ad-performance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Loader, TranslatePipe],
  template: `
    <div class="row">
      <div class="segmented range" role="radiogroup" [attr.aria-label]="'adsManage.perf.range' | t">
        @for (days of ranges; track days) {
          <button type="button" role="radio" [attr.aria-checked]="range() === days" [class.selected]="range() === days" (click)="range.set(days)">
            {{ 'adsManage.perf.days' | t: { n: days } }}
          </button>
        }
      </div>
    </div>

    @if (loading() && !insights()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <p class="caption danger">{{ failed() }}</p>
    } @else if (insights(); as data) {
      <div class="totals">
        @for (tile of totals(); track tile.metric) {
          <button type="button" class="tile" [class.on]="metric() === tile.metric" [attr.aria-pressed]="metric() === tile.metric" (click)="metric.set(tile.metric)">
            <span class="caption">{{ tile.label }}</span>
            <span class="value">{{ tile.value }}</span>
          </button>
        }
        <div class="tile static">
          <span class="caption">{{ 'adsManage.perf.ctr' | t }}</span>
          <span class="value">{{ ctr() }}</span>
        </div>
        <div class="tile static">
          <span class="caption">{{ 'adsManage.perf.cpc' | t }}</span>
          <span class="value">{{ cpc() }}</span>
        </div>
      </div>
      <p class="caption">{{ 'adsManage.perf.explain' | t }}</p>

      @if (data.daily.length) {
        <figure class="chart">
          <figcaption class="strong-sm">{{ metricLabel(metric()) }} · {{ 'adsManage.perf.perDay' | t }}</figcaption>
          <div class="plot" (mouseleave)="hover.set(null)">
            <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" role="img" [attr.aria-label]="metricLabel(metric())">
              @for (line of grid(); track line.y) {
                <line class="grid" [attr.x1]="padLeft" [attr.x2]="width" [attr.y1]="line.y" [attr.y2]="line.y" />
                <text class="axis" [attr.x]="padLeft - 6" [attr.y]="line.y + 4" text-anchor="end">{{ line.label }}</text>
              }
              @for (bar of bars(); track bar.date) {
                <path class="bar" [class.dim]="hover() !== null && hover() !== $index" [attr.d]="bar.path" />
                <rect class="hit" [attr.x]="bar.slotX" [attr.y]="0" [attr.width]="bar.slotW" [attr.height]="height - padBottom"
                  (mouseenter)="hover.set($index)" (focus)="hover.set($index)" tabindex="0" [attr.aria-label]="bar.tip" />
              }
              @for (tick of ticks(); track tick.x) {
                <text class="axis" [attr.x]="tick.x" [attr.y]="height - 6" text-anchor="middle">{{ tick.label }}</text>
              }
            </svg>
            @if (hovered(); as tip) {
              <div class="tooltip" [style.left.%]="tip.left">
                <span class="caption">{{ tip.date }}</span>
                <span class="strong-sm">{{ tip.value }}</span>
              </div>
            }
          </div>
          <button class="link-btn" type="button" (click)="table.set(!table())">{{ (table() ? 'adsManage.perf.hideTable' : 'adsManage.perf.showTable') | t }}</button>
          @if (table()) {
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{{ 'adsManage.perf.date' | t }}</th>
                    <th>{{ 'ads.spend' | t }}</th>
                    <th>{{ 'ads.clicks' | t }}</th>
                    <th>{{ 'ads.impressions' | t }}</th>
                    <th>{{ 'adsManage.perf.conversions' | t }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of data.daily; track row.date) {
                    <tr>
                      <td>{{ date(row.date) }}</td>
                      <td>{{ fmtMoney(row.spend) }}</td>
                      <td>{{ fmtCount(row.clicks) }}</td>
                      <td>{{ fmtCount(row.impressions) }}</td>
                      <td>{{ fmtCount(row.conversions) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </figure>
      } @else {
        <p class="caption">{{ 'adsManage.perf.noData' | t }}</p>
      }

      @if (data.impressionShare; as share) {
        <section class="stack-sm">
          <p class="label">{{ 'adsManage.perf.shareTitle' | t }}</p>
          <p class="caption">{{ 'adsManage.perf.shareExplain' | t }}</p>
          <div class="totals">
            <div class="tile static"><span class="caption">{{ 'adsManage.perf.share' | t }}</span><span class="value">{{ pct(share.share) }}</span></div>
            <div class="tile static"><span class="caption">{{ 'adsManage.perf.lostBudget' | t }}</span><span class="value">{{ pct(share.lostToBudget) }}</span></div>
            <div class="tile static"><span class="caption">{{ 'adsManage.perf.lostRank' | t }}</span><span class="value">{{ pct(share.lostToRank) }}</span></div>
            <div class="tile static"><span class="caption">{{ 'adsManage.perf.top' | t }}</span><span class="value">{{ pct(share.top) }}</span></div>
            <div class="tile static"><span class="caption">{{ 'adsManage.perf.absoluteTop' | t }}</span><span class="value">{{ pct(share.absoluteTop) }}</span></div>
          </div>
          @if ((share.lostToBudget ?? 0) > 0.2) {
            <p class="caption warn-text">{{ 'adsManage.perf.budgetTip' | t }}</p>
          }
        </section>
      }

      @if (data.adStrength; as strength) {
        <section class="stack-sm">
          <p class="label">{{ 'adsManage.perf.strength' | t }}</p>
          <span class="badge" [class.mint]="strength === 'GOOD' || strength === 'EXCELLENT'" [class.warn]="strength === 'POOR'">{{ strengthLabel(strength) }}</span>
          <p class="caption">{{ 'adsManage.perf.strengthExplain' | t }}</p>
        </section>
      }

      @if (data.policy; as policy) {
        @if (policy.approval || policy.topics.length) {
          <section class="panel sunken-panel">
            <p class="label">{{ 'adsManage.perf.policy' | t }}</p>
            @if (policy.approval) {
              <span class="strong-sm">{{ policy.approval }}</span>
            }
            @for (topic of policy.topics; track topic) {
              <span class="caption">{{ topic }}</span>
            }
          </section>
        }
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .range {
      max-width: 320px;
    }
    .empty {
      display: grid;
      place-items: center;
      padding: 40px 0;
    }
    .danger {
      color: var(--danger);
    }
    .warn-text {
      color: var(--accent-strong);
    }
    .stack-sm {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .totals {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 8px;
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 14px;
      border: 1.5px solid transparent;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      text-align: left;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .tile.static {
      cursor: default;
    }
    .tile.on {
      border-color: var(--primary);
    }
    .value {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-title);
    }
    .chart {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      padding: 16px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
    }
    .plot {
      position: relative;
    }
    svg {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .grid {
      stroke: var(--grey-100);
      stroke-width: 1;
    }
    .axis {
      fill: var(--text-body);
      font-size: 10px;
    }
    .bar {
      fill: var(--primary);
      transition: opacity 120ms var(--ease);
    }
    .bar.dim {
      opacity: 0.35;
    }
    .hit {
      fill: transparent;
      outline: none;
    }
    .tooltip {
      position: absolute;
      top: -6px;
      display: flex;
      flex-direction: column;
      padding: 6px 10px;
      border-radius: var(--radius-md);
      background: var(--white);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -100%);
      pointer-events: none;
      white-space: nowrap;
    }
    .link-btn {
      align-self: flex-start;
    }
    .table-wrap {
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 6px 8px;
      border-top: 1px solid var(--grey-100);
      text-align: right;
      white-space: nowrap;
    }
    th:first-child,
    td:first-child {
      text-align: left;
    }
    th {
      color: var(--text-body);
      font-weight: 500;
    }
    .sunken-panel {
      background: var(--surface-sunken);
    }
  `,
})
export class AdPerformance {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();

  private readonly service = inject(AdsManageService);
  protected readonly i18n = inject(I18nService);
  protected readonly ranges = RANGES;
  protected readonly width = 640;
  protected readonly height = H;
  protected readonly padLeft = PAD_LEFT;
  protected readonly padBottom = PAD_BOTTOM;

  protected readonly range = signal<(typeof RANGES)[number]>(30);
  protected readonly metric = signal<Metric>('spend');
  protected readonly insights = signal<AdInsights | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly hover = signal<number | null>(null);
  protected readonly table = signal(false);

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      const adId = this.ad().id;
      const days = this.range();
      untracked(() => void this.load(brandId, adId, days));
    });
  }

  private async load(brandId: string, adId: string, days: number): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      const { insights } = await this.service.insights(brandId, adId, daysAgo(days - 1), day(new Date()));
      this.insights.set(insights);
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.perf.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  private sum(key: keyof Omit<AdDailyMetrics, 'date'>): number | null {
    const rows = this.insights()?.daily ?? [];
    const values = rows.map((row) => row[key]).filter((value): value is number => typeof value === 'number');
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  }

  protected metricLabel(metric: Metric): string {
    const keys: Record<Metric, MessageKey> = {
      spend: 'ads.spend',
      clicks: 'ads.clicks',
      impressions: 'ads.impressions',
      conversions: 'adsManage.perf.conversions',
    };
    return this.i18n.t(keys[metric]);
  }

  private format(metric: Metric, value: number | null): string {
    return metric === 'spend' ? money(this.i18n.locale(), value, this.ad().currency) : count(this.i18n.locale(), value);
  }

  protected readonly totals = computed(() =>
    (['spend', 'clicks', 'impressions', 'conversions'] as Metric[]).map((metric) => ({
      metric,
      label: this.metricLabel(metric),
      value: this.format(metric, this.sum(metric)),
    })),
  );

  protected readonly ctr = computed(() => {
    const clicks = this.sum('clicks');
    const impressions = this.sum('impressions');
    return percent(this.i18n.locale(), clicks !== null && impressions ? (clicks / impressions) * 100 : null);
  });

  protected readonly cpc = computed(() => {
    const clicks = this.sum('clicks');
    const spend = this.sum('spend');
    return money(this.i18n.locale(), clicks && spend !== null ? spend / clicks : null, this.ad().currency);
  });

  private readonly values = computed(() => (this.insights()?.daily ?? []).map((row) => row[this.metric()] ?? 0));
  private readonly top = computed(() => {
    const max = Math.max(0, ...this.values());
    if (max <= 0) return 1;
    // Una cima tonda: 1, 2, 5 × 10^n.
    const step = 10 ** Math.floor(Math.log10(max));
    return [1, 2, 5, 10].map((m) => m * step).find((value) => value >= max) ?? max;
  });

  protected readonly grid = computed(() => {
    const top = this.top();
    const plot = H - PAD_TOP - PAD_BOTTOM;
    return [0, 0.5, 1].map((share) => ({
      y: PAD_TOP + plot * (1 - share),
      label: this.metric() === 'spend' ? money(this.i18n.locale(), top * share, this.ad().currency) : count(this.i18n.locale(), top * share),
    }));
  });

  protected readonly bars = computed(() => {
    const rows = this.insights()?.daily ?? [];
    const values = this.values();
    const top = this.top();
    const plot = H - PAD_TOP - PAD_BOTTOM;
    const slot = (this.width - PAD_LEFT) / Math.max(1, rows.length);
    const gap = Math.min(4, slot * 0.25);
    const base = PAD_TOP + plot;
    return rows.map((row, i) => {
      const w = Math.max(1, slot - gap);
      const x = PAD_LEFT + i * slot + gap / 2;
      const h = values[i]! > 0 ? Math.max(2, (values[i]! / top) * plot) : 0;
      const r = Math.min(4, w / 2, h);
      const y = base - h;
      // Angoli tondi solo in cima, la base resta piatta sulla linea dello zero.
      const path = h
        ? `M${x},${base} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${base} Z`
        : '';
      return {
        date: row.date,
        path,
        slotX: PAD_LEFT + i * slot,
        slotW: slot,
        center: PAD_LEFT + i * slot + slot / 2,
        tip: `${this.date(row.date)}: ${this.format(this.metric(), row[this.metric()] ?? null)}`,
      };
    });
  });

  protected readonly ticks = computed(() => {
    const bars = this.bars();
    if (!bars.length) return [];
    const every = Math.max(1, Math.ceil(bars.length / 6));
    return bars.filter((_, i) => i % every === 0).map((bar) => ({ x: bar.center, label: this.date(bar.date) }));
  });

  protected readonly hovered = computed(() => {
    const index = this.hover();
    const row = index === null ? null : this.insights()?.daily[index];
    const bar = index === null ? null : this.bars()[index];
    if (!row || !bar) return null;
    return { left: (bar.center / this.width) * 100, date: this.date(row.date), value: this.format(this.metric(), row[this.metric()] ?? null) };
  });

  protected date(value: string): string {
    return shortDate(this.i18n.locale(), value);
  }

  protected fmtMoney(value: number | null | undefined): string {
    return money(this.i18n.locale(), value, this.ad().currency);
  }

  protected fmtCount(value: number | null | undefined): string {
    return count(this.i18n.locale(), value);
  }

  protected pct(value: number | null): string {
    return percent(this.i18n.locale(), value, true);
  }

  protected strengthLabel(value: string): string {
    const keys: Record<string, MessageKey> = {
      POOR: 'adsManage.perf.strengthPoor',
      AVERAGE: 'adsManage.perf.strengthAverage',
      GOOD: 'adsManage.perf.strengthGood',
      EXCELLENT: 'adsManage.perf.strengthExcellent',
    };
    return keys[value] ? this.i18n.t(keys[value]) : value;
  }
}
