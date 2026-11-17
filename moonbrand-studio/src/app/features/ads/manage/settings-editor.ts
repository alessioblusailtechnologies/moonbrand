import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import type { AdSettingsRequest } from '@moonbrand/shared/api/contract';
import { AD_BID_STRATEGIES, AD_LIMITS, maxSpend, type Ad, type AdBidStrategy } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { ToastService } from '../../../ui/toast';
import { day, money } from './format';

// Le offerte che chiedono una cifra, e quale.
const NEEDS_AMOUNT: Partial<Record<AdBidStrategy, MessageKey>> = {
  max_clicks: 'adsManage.bid.amountCpcCap',
  manual_cpc: 'adsManage.bid.amountCpc',
  target_cpa: 'adsManage.bid.amountCpa',
};

// Budget, data di fine, offerta, reti e tracciamento di una campagna già su Google.
@Component({
  selector: 'mb-ad-settings-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="pair">
      <div class="field">
        <label for="st-budget">{{ 'ads.form.budget' | t }}</label>
        <div class="field-row">
          <input id="st-budget" type="number" inputmode="numeric" step="1" [attr.min]="limits.dailyBudget.min" [attr.max]="limits.dailyBudget.max"
            [value]="budget()" (input)="budget.set($any($event.target).value)" />
          <span class="hint">{{ currency() }}</span>
        </div>
      </div>
      <div class="field">
        <label for="st-end">{{ 'ads.form.end' | t }}</label>
        <input id="st-end" type="date" [attr.min]="today" [disabled]="noEnd()" [value]="endsOn()" (input)="endsOn.set($any($event.target).value)" />
      </div>
    </div>
    <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="noEnd()" [class.selected]="noEnd()" (click)="noEnd.set(!noEnd())">
      <span class="grow"><span class="strong-sm">{{ 'ads.form.noEnd' | t }}</span></span>
      <span class="radio-mark" [class.on]="noEnd()"></span>
    </button>
    @if (spendLine()) {
      <p class="strong-sm">{{ spendLine() }}</p>
    }

    <section class="stack">
      <p class="label">{{ 'adsManage.bid.title' | t }}</p>
      @for (option of strategies(); track option) {
        <button class="option-card" type="button" role="radio" [attr.aria-checked]="strategy() === option" [class.selected]="strategy() === option" (click)="strategy.set(option)">
          <span class="grow">
            <span class="strong-sm">{{ strategyLabel(option) | t }}</span>
            <span class="caption">{{ strategyHint(option) | t }}</span>
          </span>
          <span class="radio-mark" [class.on]="strategy() === option"></span>
        </button>
      }
      @if (amountLabel(); as label) {
        <div class="field">
          <label for="st-amount">{{ label | t }}</label>
          <div class="field-row">
            <input id="st-amount" type="number" step="0.01" min="0.01" [value]="amount()" (input)="amount.set($any($event.target).value)" />
            <span class="hint">{{ currency() }}</span>
          </div>
        </div>
      }
      @if (strategy() === 'target_roas') {
        <div class="field">
          <label for="st-roas">{{ 'adsManage.bid.roas' | t }}</label>
          <div class="field-row">
            <input id="st-roas" type="number" step="10" min="1" [value]="roas()" (input)="roas.set($any($event.target).value)" />
            <span class="hint">%</span>
          </div>
          <span class="hint">{{ 'adsManage.bid.roasHint' | t }}</span>
        </div>
      }
      @if (strategy() !== 'auto' && strategy() !== 'max_clicks' && strategy() !== 'manual_cpc') {
        <p class="caption">{{ 'adsManage.bid.conversionsNeeded' | t }}</p>
      }
    </section>

    @if (ad().campaignType === 'search') {
      <section class="stack">
        <p class="label">{{ 'adsManage.network.title' | t }}</p>
        <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="searchPartners()" [class.selected]="searchPartners()" (click)="searchPartners.set(!searchPartners())">
          <span class="grow">
            <span class="strong-sm">{{ 'adsManage.network.partners' | t }}</span>
            <span class="caption">{{ 'adsManage.network.partnersHint' | t }}</span>
          </span>
          <span class="radio-mark" [class.on]="searchPartners()"></span>
        </button>
        <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="displayNetwork()" [class.selected]="displayNetwork()" (click)="displayNetwork.set(!displayNetwork())">
          <span class="grow">
            <span class="strong-sm">{{ 'adsManage.network.display' | t }}</span>
            <span class="caption">{{ 'adsManage.network.displayHint' | t }}</span>
          </span>
          <span class="radio-mark" [class.on]="displayNetwork()"></span>
        </button>
      </section>
    }

    <section class="stack">
      <p class="label">{{ 'adsManage.tracking.title' | t }}</p>
      <p class="caption">{{ 'adsManage.tracking.hint' | t }}</p>
      <div class="field">
        <label for="st-suffix">{{ 'adsManage.tracking.suffix' | t }}</label>
        <input id="st-suffix" type="text" placeholder="utm_source=google&utm_medium=cpc" [value]="suffix()" (input)="suffix.set($any($event.target).value)" />
      </div>
      <div class="field">
        <label for="st-template">{{ 'adsManage.tracking.template' | t }}</label>
        <input id="st-template" type="text" [placeholder]="lpurlPlaceholder" [value]="template()" (input)="template.set($any($event.target).value)" />
        <span class="hint">{{ 'adsManage.tracking.templateHint' | t }}</span>
      </div>
    </section>

    @if (error()) {
      <p class="caption danger">{{ error() }}</p>
    }
    <div class="row end">
      <button class="btn btn-primary btn-sm" type="button" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <span class="spinner"></span>
        }
        {{ 'adsManage.save' | t }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .danger {
      color: var(--danger);
    }
    .row.end {
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .pair {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdSettingsEditor implements OnInit {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();
  readonly saved = output<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly i18n = inject(I18nService);
  protected readonly limits = AD_LIMITS;
  protected readonly today = day(new Date());
  protected readonly lpurlPlaceholder = '{lpurl}?utm_campaign={campaignid}';

  protected readonly budget = signal('');
  protected readonly endsOn = signal('');
  protected readonly noEnd = signal(false);
  protected readonly strategy = signal<AdBidStrategy>('auto');
  protected readonly amount = signal('');
  protected readonly roas = signal('');
  protected readonly searchPartners = signal(true);
  protected readonly displayNetwork = signal(false);
  protected readonly suffix = signal('');
  protected readonly template = signal('');
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly currency = computed(() => this.ad().currency ?? 'EUR');
  protected readonly strategies = computed(() => AD_BID_STRATEGIES[this.ad().campaignType]);
  protected readonly amountLabel = computed(() => NEEDS_AMOUNT[this.strategy()] ?? null);
  protected readonly spendLine = computed(() => {
    const daily = Number(this.budget());
    if (!Number.isFinite(daily) || daily <= 0) return '';
    const from = this.ad().startsOn > this.today ? this.ad().startsOn : this.today;
    const total = maxSpend({ dailyBudget: daily, startsOn: from, endsOn: this.noEnd() ? null : this.endsOn() || null });
    return total === null
      ? this.i18n.t('ads.form.openSpend', { daily: money(this.i18n.locale(), daily, this.currency()) })
      : this.i18n.t('adsManage.settings.remainingSpend', { total: money(this.i18n.locale(), total, this.currency()) });
  });

  ngOnInit(): void {
    const ad = this.ad();
    this.budget.set(String(ad.dailyBudget));
    this.endsOn.set(ad.endsOn ?? '');
    this.noEnd.set(ad.endsOn === null);
    const bidding = ad.spec.bidding;
    const allowed = AD_BID_STRATEGIES[ad.campaignType];
    this.strategy.set(bidding && allowed.includes(bidding.strategy) ? bidding.strategy : allowed[0]!);
    this.amount.set(bidding?.amount ? String(bidding.amount) : '');
    this.roas.set(bidding?.roas ? String(Math.round(bidding.roas * 100)) : '');
    this.searchPartners.set(ad.spec.network?.searchPartners ?? true);
    this.displayNetwork.set(ad.spec.network?.displayNetwork ?? false);
    this.suffix.set(ad.spec.finalUrlSuffix ?? '');
    this.template.set(ad.spec.trackingUrlTemplate ?? '');
  }

  protected strategyLabel(strategy: AdBidStrategy): MessageKey {
    return `adsManage.bid.${strategy}` as MessageKey;
  }

  protected strategyHint(strategy: AdBidStrategy): MessageKey {
    return `adsManage.bid.${strategy}Hint` as MessageKey;
  }

  private request(): AdSettingsRequest | string {
    const ad = this.ad();
    const daily = Number(this.budget());
    if (!Number.isInteger(daily) || daily < AD_LIMITS.dailyBudget.min || daily > AD_LIMITS.dailyBudget.max) {
      return this.i18n.t('adsManage.settings.badBudget', { min: AD_LIMITS.dailyBudget.min, max: AD_LIMITS.dailyBudget.max });
    }
    const endsOn = this.noEnd() ? null : this.endsOn() || null;
    if (endsOn && endsOn < this.today) return this.i18n.t('adsManage.settings.pastEnd');
    const strategy = this.strategy();
    const amount = Number(this.amount());
    if (NEEDS_AMOUNT[strategy] && !(amount > 0)) return this.i18n.t('adsManage.bid.needAmount');
    const roas = Number(this.roas());
    if (strategy === 'target_roas' && !(roas > 0)) return this.i18n.t('adsManage.bid.needRoas');
    const template = this.template().trim();
    if (template && !template.includes('{lpurl}')) return this.i18n.t('adsManage.tracking.needLpurl');
    const request: AdSettingsRequest = {
      dailyBudget: daily,
      endsOn,
      bidding: {
        strategy,
        amount: NEEDS_AMOUNT[strategy] ? amount : null,
        roas: strategy === 'target_roas' ? roas / 100 : null,
      },
      finalUrlSuffix: this.suffix().trim().replace(/^\?/, ''),
      trackingUrlTemplate: template,
    };
    if (ad.campaignType === 'search') request.network = { searchPartners: this.searchPartners(), displayNetwork: this.displayNetwork() };
    return request;
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    const request = this.request();
    if (typeof request === 'string') {
      this.error.set(request);
      return;
    }
    this.error.set(null);
    const ad = this.ad();
    // Più budget o più giorni: la nuova spesa massima si conferma, come all'avvio.
    if (request.dailyBudget !== ad.dailyBudget || request.endsOn !== ad.endsOn) {
      const from = ad.startsOn > this.today ? ad.startsOn : this.today;
      const total = maxSpend({ dailyBudget: request.dailyBudget!, startsOn: from, endsOn: request.endsOn ?? null });
      const daily = money(this.i18n.locale(), request.dailyBudget!, this.currency());
      const confirmed = await this.confirm.ask({
        title: this.i18n.t('adsManage.settings.confirmTitle'),
        message:
          total === null
            ? this.i18n.t('ads.launchMessageOpen', { daily })
            : this.i18n.t('adsManage.settings.confirmMax', { total: money(this.i18n.locale(), total, this.currency()), daily }),
        confirmLabel: this.i18n.t('adsManage.save'),
      });
      if (!confirmed) return;
    }
    this.saving.set(true);
    try {
      const updated = await this.service.settings(this.brandId(), ad.id, request);
      this.toast.show(this.i18n.t('adsManage.settings.saved'));
      this.saved.emit(updated);
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.saving.set(false);
    }
  }
}
