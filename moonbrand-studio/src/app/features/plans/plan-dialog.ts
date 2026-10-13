import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { BillingService } from '../../core/billing/billing.service';
import { BrandsService } from '../../core/brands/brands.service';
import { CreditsService } from '../../core/credits/credits.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { lockPageScroll } from '../../ui/scroll-lock';
import { ToastService } from '../../ui/toast';
import { PlanPicker } from './plan-picker';

// Il piano dalle Impostazioni brand. Senza abbonamento si attiva con il checkout di Paddle; con l'abbonamento si cambia
// su Paddle, che addebita o accredita la differenza, e il piano nuovo arriva con il webhook.
@Component({
  selector: 'mb-plan-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanPicker, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title">
      <div class="titles">
        <h2 id="plan-title" class="dialog-title">{{ (subscribed() ? 'plans.dialogTitle' : 'plans.activateTitle') | t }}</h2>
        <p class="caption">{{ (subscribed() ? 'plans.dialogHint' : 'plans.activateHint') | t }}</p>
      </div>
      <mb-plan-picker [selected]="picked()" [current]="subscribed() ? current() : null" [disabled]="busy()" (chosen)="picked.set($event)" />
      <p class="caption">{{ (subscribed() ? 'plans.changeNote' : 'plans.checkoutNote') | t }}</p>
      <div class="actions">
        <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="close()">{{ 'common.cancel' | t }}</button>
        <button class="btn btn-primary" type="button" [class.busy]="busy()" [attr.aria-disabled]="subscribed() && picked() === current()" (click)="activate()">
          @if (busy()) {
            <span class="spinner"></span>
          }
          {{ (subscribed() ? 'plans.change' : 'plans.activate') | t: { plan: pickedName() } }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 90;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 91;
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: min(760px, calc(100vw - 32px));
      max-height: calc(100dvh - 48px);
      overflow-y: auto;
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .titles {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .dialog-title {
      margin: 0;
      color: var(--text-title);
      font-size: 17px;
      font-weight: 600;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class PlanDialog {
  private readonly brands = inject(BrandsService);
  private readonly billing = inject(BillingService);
  private readonly credits = inject(CreditsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly brandId = input.required<string>();
  readonly current = input.required<SubscriptionPlanId>();
  // Il brand ha un abbonamento vivo su Paddle.
  readonly subscribed = input(false);
  readonly closed = output<void>();

  protected readonly picked = linkedSignal(() => this.current());
  protected readonly pickedName = computed(() => SUBSCRIPTION_PLANS[this.picked()].name);
  protected readonly busy = signal(false);

  constructor() {
    lockPageScroll();
  }

  protected close(): void {
    if (!this.busy()) this.closed.emit();
  }

  protected async activate(): Promise<void> {
    const plan = this.picked();
    const brandId = this.brandId();
    if (this.busy() || (this.subscribed() && plan === this.current())) return;
    this.busy.set(true);
    try {
      if (this.subscribed()) {
        await this.brands.changePlan(brandId, plan);
        void this.billing.waitForPlan(brandId, plan);
      } else {
        // Il piano scelto resta sul brand anche se il checkout si chiude senza pagare.
        if (plan !== this.current()) await this.brands.changePlan(brandId, plan);
        await this.credits.refresh();
        if (!(await this.billing.activatePlan(brandId, plan))) {
          this.busy.set(false);
          return;
        }
      }
      this.busy.set(false);
      this.closed.emit();
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.activateFailed')));
      this.busy.set(false);
    }
  }
}
