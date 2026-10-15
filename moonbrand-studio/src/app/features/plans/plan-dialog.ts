import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';

import type { PlanPreviewResponse } from '@moonbrand/shared/api/contract';
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

// Il piano dalle Impostazioni brand. Senza abbonamento si attiva sulla pagina di pagamento di Dodo Payments, che mostra
// lei gli importi. Con l'abbonamento il cambio passa da una conferma con quanto si paga oggi e al rinnovo (l'anteprima di
// Dodo); poi Dodo addebita la differenza e la modale dei pagamenti aspetta il piano nuovo.
@Component({
  selector: 'mb-plan-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanPicker, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="backdrop" (click)="close()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="plan-title">
      @if (review(); as summary) {
        <div class="titles">
          <h2 id="plan-title" class="dialog-title">{{ 'plans.confirm.title' | t }}</h2>
          <p class="caption">{{ summary.from }}</p>
        </div>
        <div class="bill">
          <div class="bill-row">
            <span class="strong-sm">{{ summary.todayLabel }}</span>
            @if (summary.today) {
              <span class="heading">{{ summary.today }}</span>
            }
          </div>
          <div class="bill-row">
            <span class="caption">{{ summary.nextLabel }}</span>
            <span class="strong-sm">{{ summary.next }}</span>
          </div>
          <p class="caption">{{ summary.credits }}</p>
        </div>
        <p class="caption">{{ 'plans.confirm.taxes' | t }}</p>
        <div class="actions">
          <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="preview.set(null)">{{ 'plans.confirm.back' | t }}</button>
          <button class="btn btn-primary" type="button" [class.busy]="busy()" (click)="confirm()">
            @if (busy()) {
              <span class="spinner"></span>
            }
            {{ summary.action }}
          </button>
        </div>
      } @else {
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
      }
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
    .dialog:has(.bill) {
      width: min(460px, calc(100vw - 32px));
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
    .bill {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 18px;
      border: 1.5px solid var(--border-card);
      border-radius: var(--radius-xl);
    }
    .bill-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
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
  // Il brand ha un abbonamento vivo su Dodo Payments.
  readonly subscribed = input(false);
  readonly closed = output<void>();

  protected readonly picked = linkedSignal(() => this.current());
  protected readonly pickedName = computed(() => SUBSCRIPTION_PLANS[this.picked()].name);
  protected readonly busy = signal(false);
  protected readonly preview = signal<PlanPreviewResponse | null>(null);

  // La conferma del cambio: gli importi di Dodo nella valuta dell'abbonamento, oggi con le tasse e al rinnovo senza.
  protected readonly review = computed(() => {
    const preview = this.preview();
    if (!preview) return null;
    const intl = this.i18n.intl();
    const money = (cents: number) => new Intl.NumberFormat(intl, { style: 'currency', currency: preview.currency }).format(cents / 100);
    const date = new Intl.DateTimeFormat(intl, { day: 'numeric', month: 'long' }).format(new Date(preview.nextAt));
    const today = preview.today > 0 ? money(preview.today) : null;
    const to = SUBSCRIPTION_PLANS[this.picked()];
    return {
      from: this.i18n.t('plans.confirm.from', { from: SUBSCRIPTION_PLANS[this.current()].name, to: to.name }),
      todayLabel: this.i18n.t(today ? 'plans.confirm.today' : 'plans.confirm.todayNone'),
      today,
      nextLabel: this.i18n.t('plans.confirm.next', { date }),
      next: this.i18n.t('plans.confirm.nextAmount', { amount: money(preview.next) }),
      credits: preview.upgrade
        ? this.i18n.t('plans.confirm.creditsUp', { credits: to.monthlyCredits.toLocaleString(intl) })
        : this.i18n.t('plans.confirm.creditsDown'),
      action: today ? this.i18n.t('plans.confirm.pay', { amount: today }) : this.i18n.t('plans.confirm.go'),
    };
  });

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
        // Prima la conferma, con gli importi.
        this.preview.set(await this.billing.previewPlan(brandId, plan));
        this.busy.set(false);
        return;
      }
      // Il piano scelto resta sul brand anche se dalla pagina di pagamento si torna senza pagare.
      if (plan !== this.current()) await this.brands.changePlan(brandId, plan);
      await this.credits.refresh();
      // Il browser va alla pagina di pagamento: la modale resta occupata finché la pagina non cambia.
      if (!(await this.billing.activatePlan(brandId, plan))) this.busy.set(false);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t(this.subscribed() ? 'plans.confirm.previewFailed' : 'plans.activateFailed')));
      this.busy.set(false);
    }
  }

  protected async confirm(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.billing.changePlan(this.brandId(), this.picked());
      this.busy.set(false);
      this.closed.emit();
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('plans.activateFailed')));
      this.busy.set(false);
    }
  }
}
