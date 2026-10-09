import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { PlanPicker } from '../../plans/plan-picker';
import { OnboardingStore } from '../onboarding.store';

// Il piano del brand nuovo: parte da Pro, e si può cambiare dopo dalle Impostazioni brand. Il pagamento è simulato.
@Component({
  selector: 'mb-plan-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PlanPicker, TranslatePipe],
  template: `
    <mb-plan-picker [selected]="store.plan()" (chosen)="store.choosePlan($event)" />
    <p class="caption">{{ 'plans.mockNote' | t }}</p>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
  `,
})
export class PlanStep {
  protected readonly store = inject(OnboardingStore);
}
