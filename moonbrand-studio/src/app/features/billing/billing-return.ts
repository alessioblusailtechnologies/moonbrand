import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { BillingService } from '../../core/billing/billing.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Loader } from '../../ui/loader';

// Il ritorno dalla pagina di pagamento di Dodo Payments (/abbonamento, con status e payment_id o subscription_id
// nell'indirizzo): si riprende il pagamento lasciato in sospeso, la modale dei pagamenti aspetta il webhook e si torna
// dove si era.
@Component({
  selector: 'mb-billing-return',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Loader, TranslatePipe],
  template: `
    <div class="returning" aria-live="polite">
      <mb-loader />
      <p class="caption">{{ 'plans.returning' | t }}</p>
    </div>
  `,
  styles: `
    .returning {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 64px 16px;
    }
  `,
})
export class BillingReturn {
  constructor() {
    const route = inject(ActivatedRoute);
    const router = inject(Router);
    const target = inject(BillingService).resume(route.snapshot.queryParamMap.get('status'));
    void router.navigateByUrl(target, { replaceUrl: true });
  }
}
