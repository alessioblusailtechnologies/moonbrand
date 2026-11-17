import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';

import type { AdLocation } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';

// I luoghi di Google (paesi, regioni, province, città, CAP): si cercano per nome e si aggiungono come chip.
@Component({
  selector: 'mb-ad-location-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <div class="chips">
      @for (place of value(); track place.id) {
        <span class="chip static" [class.exclude]="exclude()">
          {{ place.name }}
          <span class="caption">· {{ typeLabel(place.type) | t }}</span>
          <button class="icon-btn mini" type="button" [attr.aria-label]="'adsManage.loc.remove' | t" (click)="remove(place)">
            <mb-icon name="x" [size]="12" />
          </button>
        </span>
      } @empty {
        <span class="caption">{{ (exclude() ? 'adsManage.loc.noExcluded' : 'adsManage.loc.none') | t }}</span>
      }
    </div>
    <div class="search">
      <mb-icon name="search" [size]="15" />
      <input class="grow" type="search" [value]="query()" [placeholder]="'adsManage.loc.placeholder' | t" (input)="type($any($event.target).value)" />
      @if (searching()) {
        <span class="spinner"></span>
      }
    </div>
    @if (results().length) {
      <div class="results" role="listbox">
        @for (place of results(); track place.id) {
          <button type="button" role="option" class="result" (click)="add(place)">
            <span class="strong-sm">{{ place.name }}</span>
            <span class="caption">{{ typeLabel(place.type) | t }}{{ place.path ? ' · ' + place.path : '' }}</span>
          </button>
        }
      </div>
    } @else if (message()) {
      <span class="caption">{{ message() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chip.static {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: default;
    }
    .chip.exclude {
      border-style: dashed;
    }
    .mini {
      width: 22px;
      height: 22px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      color: var(--text-body);
    }
    .search input {
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--text-title);
      font-size: 14px;
    }
    .results {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--white);
      box-shadow: var(--shadow-menu);
    }
    .result {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 14px;
      border: 0;
      border-top: 1px solid var(--grey-100);
      background: transparent;
      text-align: left;
      cursor: pointer;
    }
    .result:first-child {
      border-top: 0;
    }
    .result:hover {
      background: var(--grey-100);
    }
  `,
})
export class AdLocationSearch {
  readonly brandId = input.required<string>();
  readonly value = input<AdLocation[]>([]);
  readonly exclude = input(false);
  readonly changed = output<AdLocation[]>();

  private readonly service = inject(AdsManageService);
  private readonly i18n = inject(I18nService);
  protected readonly query = signal('');
  protected readonly results = signal<AdLocation[]>([]);
  protected readonly searching = signal(false);
  protected readonly message = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;

  protected typeLabel(type: AdLocation['type']): MessageKey {
    return `adsManage.loc.types.${type}` as MessageKey;
  }

  protected type(text: string): void {
    this.query.set(text);
    clearTimeout(this.timer);
    const q = text.trim();
    if (q.length < 2) {
      this.results.set([]);
      this.message.set('');
      return;
    }
    this.timer = setTimeout(() => void this.search(q), 300);
  }

  private async search(q: string): Promise<void> {
    const mine = ++this.seq;
    this.searching.set(true);
    try {
      const { locations } = await this.service.locations(this.brandId(), q);
      if (mine !== this.seq) return;
      const chosen = new Set(this.value().map((place) => place.id));
      const list = locations.filter((place) => !chosen.has(place.id));
      this.results.set(list);
      this.message.set(list.length ? '' : this.i18n.t('adsManage.loc.noResults'));
    } catch (error) {
      if (mine === this.seq) this.message.set(errorMessage(error, this.i18n.t('adsManage.loc.failed')));
    } finally {
      if (mine === this.seq) this.searching.set(false);
    }
  }

  protected add(place: AdLocation): void {
    this.changed.emit([...this.value(), place]);
    this.query.set('');
    this.results.set([]);
  }

  protected remove(place: AdLocation): void {
    this.changed.emit(this.value().filter((item) => item.id !== place.id));
  }
}
