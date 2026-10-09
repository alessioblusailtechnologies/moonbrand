import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { BrandsService } from '../../core/brands/brands.service';
import { CreditsService } from '../../core/credits/credits.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { lockPageScroll } from '../../ui/scroll-lock';
import { ToastService } from '../../ui/toast';
import { PlanPicker } from './plan-picker';

// Il cambio di piano dalle Impostazioni brand. Per ora senza pagamento: il piano scelto vale subito.
@Component({
  selector: 'mb-plan-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanPicker, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title">
      <div class="titles">
        <h2 id="plan-title" class="dialog-title">{{ 'plans.dialogTitle' | t }}</h2>
        <p class="caption">{{ 'plans.dialogHint' | t }}</p>
      </div>
      <mb-plan-picker [selected]="picked()" [current]="current()" [disabled]="busy()" (chosen)="picked.set($event)" />
      <p class="caption">{{ 'plans.mockNote' | t }}</p>
      <div class="actions">
        <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="close()">{{ 'common.cancel' | t }}</button>
        <button class="btn btn-primary" type="button" [class.busy]="busy()" [attr.aria-disabled]="picked() === current()" (click)="activate()">
          @if (busy()) {
            <span class="spinner"></span>
          }
          {{ 'plans.activate' | t: { plan: pickedName() } }}
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
  private readonly credits = inject(CreditsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly brandId = input.required<string>();
  readonly current = input.required<SubscriptionPlanId>();
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
    if (this.busy() || plan === this.current()) return;
    this.busy.set(true);
    try {
      await this.brands.changePlan(this.brandId(), plan);
      await this.credits.refresh();
      this.toast.show(this.i18n.t('plans.activated', { plan: SUBSCRIPTION_PLANS[plan].name }));
      this.busy.set(false);
      this.closed.emit();
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.activateFailed')));
      this.busy.set(false);
    }
  }
}
