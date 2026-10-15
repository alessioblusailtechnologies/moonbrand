import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { BillingService } from '../../core/billing/billing.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';

// L'esito di un pagamento, al centro dello studio: il loader mentre Dodo Payments conferma (il webhook porta piano e crediti),
// poi il piano attivo o i crediti aggiunti, con quanti crediti ci sono e fino a quando. Mentre aspetta non si chiude.
@Component({
  selector: 'mb-payment-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (billing.payment(); as state) {
      <div class="backdrop" (click)="close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title" aria-live="polite">
        @if (state.phase === 'waiting') {
          <mb-loader />
          <h2 id="payment-title" class="dialog-title">{{ state.title }}</h2>
          <p class="caption">{{ 'plans.modal.waitingHint' | t }}</p>
        } @else {
          <span class="mark" [class.pending]="state.phase === 'pending'">
            <mb-icon [name]="state.phase === 'done' ? 'check' : 'clock'" [size]="26" [stroke]="2.2" />
          </span>
          <h2 id="payment-title" class="dialog-title">{{ state.title }}</h2>
          <p class="body">{{ state.body }}</p>
          <button class="btn btn-primary btn-block" type="button" (click)="close()">{{ 'plans.modal.ok' | t }}</button>
        }
      </div>
    }
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
      align-items: center;
      gap: 12px;
      width: min(400px, calc(100vw - 32px));
      padding: 32px 28px 28px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      text-align: center;
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .dialog-title {
      margin: 4px 0 0;
      color: var(--text-title);
      font-size: 18px;
      font-weight: 600;
    }
    .body {
      margin: 0 0 8px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--text-title);
    }
    .mark.pending {
      background: var(--grey-100);
    }
  `,
})
export class PaymentModal {
  protected readonly billing = inject(BillingService);

  protected close(): void {
    if (this.billing.payment()?.phase !== 'waiting') this.billing.payment.set(null);
  }
}
