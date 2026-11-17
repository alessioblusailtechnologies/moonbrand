import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import type { Ad, AdSearchTerm } from '@moonbrand/shared/domain/ads';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';
import { count, day, daysAgo, money } from './format';

const RANGES = [7, 30, 90] as const;

// Cosa hanno cercato davvero le persone prima di vedere l'annuncio: da qui un termine diventa parola chiave o si esclude.
@Component({
  selector: 'mb-ad-search-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Loader, TranslatePipe],
  template: `
    <div class="segmented range">
      @for (days of ranges; track days) {
        <button type="button" [class.selected]="range() === days" (click)="range.set(days)">{{ 'adsManage.perf.days' | t: { n: days } }}</button>
      }
    </div>
    <p class="caption">{{ 'adsManage.terms.explain' | t }}</p>
    @if (loading() && !terms()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <p class="caption danger">{{ failed() }}</p>
    } @else if (terms(); as list) {
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ 'adsManage.terms.term' | t }}</th>
              <th>{{ 'ads.clicks' | t }}</th>
              <th>{{ 'ads.impressions' | t }}</th>
              <th>{{ 'adsManage.kw.cost' | t }}</th>
              <th>{{ 'adsManage.perf.conversions' | t }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (term of list; track term.term) {
              <tr>
                <td class="term">
                  <span class="strong-sm">{{ term.term }}</span>
                  @if (statusLabel(term.status); as label) {
                    <span class="caption">{{ label }}</span>
                  }
                </td>
                <td>{{ fmt(term.clicks) }}</td>
                <td>{{ fmt(term.impressions) }}</td>
                <td>{{ cash(term.cost) }}</td>
                <td>{{ fmt(term.conversions) }}</td>
                <td class="acts">
                  @if (!done().has(term.term) && term.status !== 'ADDED' && term.status !== 'EXCLUDED' && term.status !== 'ADDED_EXCLUDED') {
                    <button class="link-btn" type="button" [disabled]="busy()" (click)="keep(term)">{{ 'adsManage.terms.add' | t }}</button>
                    <button class="link-btn" type="button" [disabled]="busy()" (click)="exclude(term)">{{ 'adsManage.terms.exclude' | t }}</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="caption">{{ 'adsManage.terms.none' | t }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
    .table-wrap {
      overflow-x: auto;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th,
    td {
      padding: 8px 10px;
      border-top: 1px solid var(--grey-100);
      text-align: right;
      white-space: nowrap;
    }
    thead th {
      border-top: 0;
      color: var(--text-body);
      font-weight: 500;
    }
    th:first-child,
    td:first-child {
      text-align: left;
    }
    .term {
      display: flex;
      flex-direction: column;
      white-space: normal;
      min-width: 160px;
    }
    .acts {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
  `,
})
export class AdSearchTerms {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);
  protected readonly ranges = RANGES;

  protected readonly range = signal<(typeof RANGES)[number]>(30);
  protected readonly terms = signal<AdSearchTerm[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  // I termini già aggiunti o esclusi da qui, finché Google non li rilegge.
  protected readonly done = signal<Set<string>>(new Set());

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
      this.terms.set((await this.service.searchTerms(brandId, adId, daysAgo(days - 1), day(new Date()))).terms);
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.terms.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected statusLabel(status: string): string {
    if (status === 'ADDED') return this.i18n.t('adsManage.terms.statusAdded');
    if (status === 'EXCLUDED' || status === 'ADDED_EXCLUDED') return this.i18n.t('adsManage.terms.statusExcluded');
    return '';
  }

  protected fmt(value: number): string {
    return count(this.i18n.locale(), value);
  }

  protected cash(value: number): string {
    return money(this.i18n.locale(), value, this.ad().currency);
  }

  private async act(term: AdSearchTerm, work: () => Promise<unknown>, done: string): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await work();
      this.done.update((set) => new Set(set).add(term.term));
      this.toast.show(done);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected keep(term: AdSearchTerm): void {
    void this.act(
      term,
      () => this.service.addKeywords(this.brandId(), this.ad().id, { keywords: [{ text: term.term.slice(0, 80), match: 'phrase' }], negative: false }),
      this.i18n.t('adsManage.terms.added', { term: term.term }),
    );
  }

  protected exclude(term: AdSearchTerm): void {
    void this.act(
      term,
      async () => {
        const { negatives } = await this.service.keywords(this.brandId(), this.ad().id);
        if (negatives.some((k) => k.text.toLowerCase() === term.term.toLowerCase() && k.match === 'exact')) return;
        await this.service.negatives(this.brandId(), this.ad().id, [...negatives, { text: term.term.slice(0, 80), match: 'exact' }]);
      },
      this.i18n.t('adsManage.terms.excluded', { term: term.term }),
    );
  }
}
