import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import type { AdKeywordsResponse } from '@moonbrand/shared/api/contract';
import type { Ad, AdKeyword, AdKeywordRow, KeywordMatch } from '@moonbrand/shared/domain/ads';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { Icon } from '../../../ui/icon';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';
import { MATCH_KEYS, count, money, parseKeywords } from './format';

// Le parole chiave di una campagna sulla rete di ricerca: quelle su cui esce l'annuncio, con punteggio e numeri degli
// ultimi 30 giorni, e quelle escluse per tutta la campagna.
@Component({
  selector: 'mb-ad-keywords',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, TranslatePipe],
  template: `
    @if (!data() && loading()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <p class="caption danger">{{ failed() }}</p>
    } @else if (data(); as current) {
      <section class="stack">
        <div class="row">
          <p class="label grow">{{ 'adsManage.kw.title' | t: { n: positives().length } }}</p>
        </div>
        <p class="caption">{{ 'adsManage.kw.explain' | t }}</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{{ 'adsManage.kw.keyword' | t }}</th>
                <th>{{ 'adsManage.kw.quality' | t }}</th>
                <th>{{ 'ads.clicks' | t }}</th>
                <th>{{ 'ads.impressions' | t }}</th>
                <th>{{ 'adsManage.kw.cost' | t }}</th>
                <th>{{ 'adsManage.perf.conversions' | t }}</th>
                <th>{{ 'adsManage.kw.firstPage' | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of positives(); track row.id) {
                <tr [class.paused]="row.status === 'paused'">
                  <td class="kw">
                    <span class="strong-sm">{{ row.text }}</span>
                    <span class="caption">{{ matchLabel(row.match) }}{{ row.status === 'paused' ? ' · ' + ('adsManage.kw.paused' | t) : '' }}</span>
                  </td>
                  <td>{{ row.qualityScore === null ? '—' : row.qualityScore + '/10' }}</td>
                  <td>{{ fmt(row.clicks) }}</td>
                  <td>{{ fmt(row.impressions) }}</td>
                  <td>{{ cash(row.cost) }}</td>
                  <td>{{ fmt(row.conversions) }}</td>
                  <td>{{ cash(row.firstPageCpc) }}</td>
                  <td class="acts">
                    <button class="link-btn" type="button" [disabled]="busy()" (click)="toggle(row)">
                      {{ (row.status === 'paused' ? 'adsManage.kw.resume' : 'adsManage.kw.pause') | t }}
                    </button>
                    <button class="icon-btn" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.kw.remove' | t" (click)="remove(row)">
                      <mb-icon name="trash" [size]="14" />
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="caption">{{ 'adsManage.kw.none' | t }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="caption">{{ 'adsManage.kw.qualityExplain' | t }}</p>

        <div class="field">
          <label for="kw-add">{{ 'adsManage.kw.add' | t }}</label>
          <textarea id="kw-add" rows="3" [value]="draft()" (input)="draft.set($any($event.target).value)" [placeholder]="'adsManage.kw.addPlaceholder' | t"></textarea>
          <span class="hint">{{ 'adsManage.kw.addHint' | t }}</span>
        </div>
        <div class="row">
          <div class="segmented grow">
            @for (option of matches; track option) {
              <button type="button" [class.selected]="match() === option" (click)="match.set(option)">{{ matchLabel(option) }}</button>
            }
          </div>
          <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() || !draft().trim()" (click)="add(false)">{{ 'adsManage.kw.addButton' | t }}</button>
        </div>
      </section>

      <section class="stack">
        <p class="label">{{ 'adsManage.kw.negativesTitle' | t: { n: current.negatives.length } }}</p>
        <p class="caption">{{ 'adsManage.kw.negativesExplain' | t }}</p>
        <div class="chips">
          @for (negative of current.negatives; track negative.text + negative.match) {
            <span class="chip static">
              {{ negative.text }} <span class="caption">· {{ matchLabel(negative.match) }}</span>
              <button class="icon-btn mini" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.kw.remove' | t" (click)="removeNegative(negative)">
                <mb-icon name="x" [size]="12" />
              </button>
            </span>
          } @empty {
            <span class="caption">{{ 'adsManage.kw.noNegatives' | t }}</span>
          }
        </div>
        <div class="row">
          <input class="sunken grow" type="text" [value]="negativeDraft()" (input)="negativeDraft.set($any($event.target).value)"
            [placeholder]="'adsManage.kw.negativePlaceholder' | t" (keydown.enter)="addNegatives()" />
          <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy() || !negativeDraft().trim()" (click)="addNegatives()">{{ 'adsManage.kw.exclude' | t }}</button>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .empty {
      display: grid;
      place-items: center;
      padding: 40px 0;
    }
    .danger {
      color: var(--danger);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 10px;
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
    .kw {
      display: flex;
      flex-direction: column;
      white-space: normal;
      min-width: 160px;
    }
    tr.paused td {
      opacity: 0.6;
    }
    .acts {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 6px;
      opacity: 1 !important;
    }
    .chip.static {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: default;
    }
    .mini {
      width: 22px;
      height: 22px;
    }
  `,
})
export class AdKeywords {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly matches: KeywordMatch[] = ['phrase', 'exact', 'broad'];

  protected readonly data = signal<AdKeywordsResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly match = signal<KeywordMatch>('phrase');
  protected readonly negativeDraft = signal('');

  protected readonly positives = () => (this.data()?.keywords ?? []).filter((row) => !row.negative);

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      const adId = this.ad().id;
      untracked(() => void this.load(brandId, adId));
    });
  }

  private async load(brandId: string, adId: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      this.data.set(await this.service.keywords(brandId, adId));
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.kw.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  private async act(work: () => Promise<AdKeywordsResponse>, done?: string): Promise<boolean> {
    if (this.busy()) return false;
    this.busy.set(true);
    try {
      this.data.set(await work());
      if (done) this.toast.show(done);
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected matchLabel(match: KeywordMatch): string {
    return this.i18n.t(MATCH_KEYS[match]);
  }

  protected fmt(value: number | null): string {
    return count(this.i18n.locale(), value);
  }

  protected cash(value: number | null): string {
    return money(this.i18n.locale(), value, this.ad().currency);
  }

  protected async add(negative: boolean): Promise<void> {
    const keywords = parseKeywords(this.draft(), this.match());
    if (!keywords.length) return;
    const ok = await this.act(
      () => this.service.addKeywords(this.brandId(), this.ad().id, { keywords, negative }),
      this.i18n.t('adsManage.kw.added', { n: keywords.length }),
    );
    if (ok) this.draft.set('');
  }

  protected toggle(row: AdKeywordRow): void {
    void this.act(() => this.service.keywordStatus(this.brandId(), this.ad().id, row.id, row.status === 'paused' ? 'active' : 'paused'));
  }

  protected async remove(row: AdKeywordRow): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('adsManage.kw.removeConfirm', { keyword: row.text }),
      confirmLabel: this.i18n.t('adsManage.kw.remove'),
      tone: 'danger',
    });
    if (confirmed) void this.act(() => this.service.removeKeyword(this.brandId(), this.ad().id, row.id), this.i18n.t('adsManage.kw.removed'));
  }

  protected async addNegatives(): Promise<void> {
    const added = parseKeywords(this.negativeDraft(), 'phrase');
    if (!added.length) return;
    const current = this.data()?.negatives ?? [];
    const keys = new Set(current.map((k) => `${k.text.toLowerCase()}|${k.match}`));
    const next = [...current, ...added.filter((k) => !keys.has(`${k.text.toLowerCase()}|${k.match}`))];
    if (await this.act(() => this.service.negatives(this.brandId(), this.ad().id, next), this.i18n.t('adsManage.kw.excluded'))) {
      this.negativeDraft.set('');
    }
  }

  protected removeNegative(keyword: AdKeyword): void {
    const next = (this.data()?.negatives ?? []).filter((k) => !(k.text === keyword.text && k.match === keyword.match));
    void this.act(() => this.service.negatives(this.brandId(), this.ad().id, next));
  }
}
