import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { SUBSCRIPTION_PLAN_IDS, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

// I tre piani da scegliere, nell'onboarding e nelle Impostazioni brand: prezzo, crediti del mese e cosa ci sta.
// current: il piano che il brand ha già, se ne ha uno.
@Component({
  selector: 'mb-plan-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="plans" role="radiogroup" [attr.aria-label]="'plans.stepTitle' | t">
      @for (plan of plans(); track plan.id) {
        <button class="plan" type="button" role="radio" [attr.aria-checked]="selected() === plan.id" [class.on]="selected() === plan.id"
          [disabled]="disabled()" (click)="chosen.emit(plan.id)">
          <span class="top">
            <span class="name heading">{{ plan.name }}</span>
            @if (current() === plan.id) {
              <span class="badge">{{ 'plans.current' | t }}</span>
            } @else if (plan.id === 'pro') {
              <span class="badge accent">{{ 'plans.recommended' | t }}</span>
            }
          </span>
          <span class="strong price">{{ 'plans.perMonth' | t: { price: plan.price } }}</span>
          <span class="strong-sm">{{ 'plans.credits' | t: { n: plan.credits } }}</span>
          <span class="caption">{{ plan.examples }}</span>
          <span class="caption fit">{{ plan.fit }}</span>
          <span class="dot" aria-hidden="true"></span>
        </button>
      }
    </div>
  `,
  styles: `
    .plans {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .plan {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 18px 18px 20px;
      border: 1.5px solid var(--border-card);
      border-radius: var(--radius-xl);
      background: var(--white);
      text-align: left;
      cursor: pointer;
      transition:
        border-color 120ms var(--ease),
        box-shadow 120ms var(--ease);
    }
    .plan:hover:not(:disabled) {
      border-color: var(--border-strong);
    }
    .plan.on {
      border-color: var(--text-title);
      box-shadow: 0 0 0 1px var(--text-title);
    }
    .plan:disabled {
      cursor: default;
    }
    .top {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 24px;
      padding-right: 24px;
    }
    .badge.accent {
      background: var(--accent-soft);
      color: var(--text-title);
    }
    .price {
      margin-top: 2px;
    }
    .fit {
      margin-top: auto;
      padding-top: 6px;
    }
    .dot {
      position: absolute;
      top: 20px;
      right: 18px;
      width: 16px;
      height: 16px;
      border: 1.5px solid var(--grey-300);
      border-radius: 50%;
    }
    .plan.on .dot {
      border: 5px solid var(--text-title);
    }
    @media (max-width: 720px) {
      .plans {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class PlanPicker {
  private readonly i18n = inject(I18nService);
  readonly selected = input<SubscriptionPlanId | null>(null);
  readonly current = input<SubscriptionPlanId | null>(null);
  readonly disabled = input(false);
  readonly chosen = output<SubscriptionPlanId>();

  protected readonly plans = computed(() => {
    const intl = this.i18n.intl();
    return SUBSCRIPTION_PLAN_IDS.map((id) => {
      const plan = SUBSCRIPTION_PLANS[id];
      return {
        id,
        name: plan.name,
        price: plan.priceEur.toLocaleString(intl),
        credits: plan.monthlyCredits.toLocaleString(intl),
        examples: this.i18n.t(`plans.examples.${id}`),
        fit: this.i18n.t(`plans.fit.${id}`),
      };
    });
  });
}
