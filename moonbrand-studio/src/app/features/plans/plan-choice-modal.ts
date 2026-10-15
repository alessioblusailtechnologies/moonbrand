import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { DEFAULT_SUBSCRIPTION_PLAN, SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { BillingService } from '../../core/billing/billing.service';
import { BrandsService } from '../../core/brands/brands.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ToastService } from '../../ui/toast';
import { PlanPicker } from './plan-picker';

// La scelta del piano di un brand appena creato, in una finestra che non si chiude: niente X, niente Esc, lo sfondo non
// risponde. Si esce solo attivando un piano, che porta alla pagina di pagamento di Dodo Payments. Il piano scelto resta
// sul brand anche se poi non si paga: il banner lo ripropone.
@Component({
  selector: 'mb-plan-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanPicker, TranslatePipe],
  template: `
    <div class="backdrop"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-choice-title">
      <div class="titles">
        <h2 id="plan-choice-title" class="dialog-title">{{ 'plans.stepTitle' | t }}</h2>
        <p class="body">{{ 'plans.stepSubtitle' | t }}</p>
      </div>
      <mb-plan-picker [selected]="plan()" [disabled]="busy()" (chosen)="plan.set($event)" />
      <p class="caption">{{ 'plans.checkoutNote' | t }}</p>
      <button class="btn btn-primary btn-lg btn-block" type="button" [class.busy]="busy()" [attr.aria-disabled]="busy()" (click)="activate()">
        @if (busy()) {
          <span class="spinner"></span>
        }
        {{ 'plans.activate' | t: { plan: name() } }}
      </button>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 95;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 96;
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: min(760px, calc(100vw - 32px));
      max-height: calc(100dvh - 48px);
      padding: 28px;
      overflow-y: auto;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .dialog-title {
      margin: 0;
      color: var(--text-title);
      font-size: 20px;
      font-weight: 600;
    }
    .body,
    .caption {
      margin: 0;
    }
  `,
})
export class PlanChoiceModal {
  private readonly billing = inject(BillingService);
  private readonly brands = inject(BrandsService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  readonly brandId = input.required<string>();
  protected readonly plan = signal<SubscriptionPlanId>(DEFAULT_SUBSCRIPTION_PLAN);
  protected readonly busy = signal(false);
  protected readonly name = computed(() => SUBSCRIPTION_PLANS[this.plan()].name);

  // Il piano scelto si salva sul brand, poi il browser va da Dodo. Se la pagina di pagamento non si apre si resta qui.
  protected async activate(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.brands.changePlan(this.brandId(), this.plan());
      if (await this.billing.activatePlan(this.brandId(), this.plan(), '/assistente')) return;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.checkoutFailed')));
    }
    this.busy.set(false);
  }
}
