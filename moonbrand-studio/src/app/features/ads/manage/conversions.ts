import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import type { AdConversionsResponse } from '@moonbrand/shared/api/contract';
import { CONVERSION_TYPES, type AdConversionGoal } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';

// Le conversioni dell'account Google Ads: le azioni che contano (acquisti, contatti, prenotazioni) e quali obiettivi usano
// le offerte automatiche.
@Component({
  selector: 'mb-ad-conversions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Loader, TranslatePipe],
  template: `
    <p class="caption">{{ 'adsManage.conv.explain' | t }}</p>
    @if (loading() && !data()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <div class="panel empty small">
        <p class="caption danger">{{ failed() }}</p>
        <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
      </div>
    } @else if (data(); as current) {
      <section class="stack">
        <p class="label">{{ 'adsManage.conv.actions' | t }}</p>
        @for (action of current.actions; track action.id) {
          <div class="panel item">
            <div class="grow texts">
              <span class="strong-sm">{{ action.name }}</span>
              <span class="caption">{{ typeName(action.type) }}{{ action.status ? ' · ' + statusName(action.status) : '' }}</span>
            </div>
          </div>
        } @empty {
          <span class="caption">{{ 'adsManage.conv.noActions' | t }}</span>
        }
      </section>

      <section class="panel adder">
        <p class="label">{{ 'adsManage.conv.new' | t }}</p>
        <div class="field">
          <label for="conv-name">{{ 'adsManage.conv.name' | t }}</label>
          <input id="conv-name" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)" [placeholder]="'adsManage.conv.namePlaceholder' | t" />
        </div>
        <div class="chips">
          @for (option of types; track option) {
            <button class="chip" type="button" [class.selected]="type() === option" [attr.aria-pressed]="type() === option" (click)="type.set(option)">
              {{ typeName(option) }}
            </button>
          }
        </div>
        <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="primary()" [class.selected]="primary()" (click)="primary.set(!primary())">
          <span class="grow">
            <span class="strong-sm">{{ 'adsManage.conv.primary' | t }}</span>
            <span class="caption">{{ 'adsManage.conv.primaryHint' | t }}</span>
          </span>
          <span class="radio-mark" [class.on]="primary()"></span>
        </button>
        <p class="caption">{{ 'adsManage.conv.uploadNote' | t }}</p>
        <button class="btn btn-primary btn-sm add" type="button" [disabled]="busy() || !name().trim()" (click)="create()">{{ 'adsManage.conv.create' | t }}</button>
      </section>

      @if (current.goals.length) {
        <section class="stack">
          <p class="label">{{ 'adsManage.conv.goals' | t }}</p>
          <p class="caption">{{ 'adsManage.conv.goalsHint' | t }}</p>
          @for (goal of current.goals; track goal.category + goal.origin) {
            <button class="option-card" type="button" role="switch" [attr.aria-checked]="goal.biddable" [class.selected]="goal.biddable" [disabled]="busy()" (click)="toggle(goal)">
              <span class="grow">
                <span class="strong-sm">{{ typeName(goal.category) }} · {{ readable(goal.origin) }}</span>
                <span class="caption">{{ actionsLine(goal) }}</span>
              </span>
              <span class="caption">{{ (goal.biddable ? 'adsManage.conv.bidOn' : 'adsManage.conv.bidOff') | t }}</span>
              <span class="radio-mark" [class.on]="goal.biddable"></span>
            </button>
          }
        </section>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 40px 16px;
      text-align: center;
    }
    .empty.small {
      padding: 24px 12px;
    }
    .danger {
      color: var(--danger);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      flex-direction: row;
      align-items: center;
      padding: 12px 16px;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .adder .field {
      background: var(--surface-sunken);
    }
    .add {
      align-self: flex-start;
    }
  `,
})
export class AdConversions {
  readonly brandId = input.required<string>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  protected readonly i18n = inject(I18nService);
  protected readonly types = CONVERSION_TYPES;

  protected readonly data = signal<AdConversionsResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly type = signal<string>('IMPORTED_LEAD');
  protected readonly primary = signal(true);

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      untracked(() => void this.load(brandId));
    });
  }

  protected reload(): void {
    void this.load(this.brandId());
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      this.data.set(await this.service.conversions(brandId));
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.conv.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected readable(value: string): string {
    const text = value.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected typeName(type: string | null): string {
    if (!type) return '—';
    return (CONVERSION_TYPES as readonly string[]).includes(type) ? this.i18n.t(`adsManage.conv.types.${type}` as MessageKey) : this.readable(type);
  }

  protected statusName(status: string): string {
    return status.toLowerCase() === 'active' ? this.i18n.t('adsManage.conv.active') : this.i18n.t('adsManage.conv.inactive');
  }

  protected actionsLine(goal: AdConversionGoal): string {
    if (!goal.actions.length) return this.i18n.t('adsManage.conv.noGoalActions');
    return goal.actions.map((action) => (action.primary ? action.name : `${action.name} (${this.i18n.t('adsManage.conv.secondary')})`)).join(', ');
  }

  protected async create(): Promise<void> {
    const name = this.name().trim();
    if (!name || this.busy()) return;
    this.busy.set(true);
    try {
      const action = await this.service.createConversion(this.brandId(), { name, type: this.type(), primary: this.primary() });
      this.data.update((data) => (data ? { ...data, actions: [action, ...data.actions.filter((item) => item.id !== action.id)] } : data));
      this.name.set('');
      this.toast.show(this.i18n.t('adsManage.conv.created'));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async toggle(goal: AdConversionGoal): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      this.data.set(await this.service.conversionGoal(this.brandId(), { category: goal.category, origin: goal.origin, biddable: !goal.biddable }));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
