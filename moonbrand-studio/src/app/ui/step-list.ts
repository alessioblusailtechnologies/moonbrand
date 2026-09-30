import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';

import { Icon } from './icon';

@Component({
  selector: 'mb-step-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <ol class="steps">
      @for (step of steps(); track step.id) {
        <li class="step" [class]="step.status">
          <span class="mark">
            @switch (step.status) {
              @case ('done') { <mb-icon name="check" [size]="12" [stroke]="3" /> }
              @case ('failed') { <mb-icon name="x" [size]="12" [stroke]="3" /> }
              @default { <span class="spinner"></span> }
            }
          </span>
          <span class="texts">
            <span class="strong-sm">{{ step.label }}</span>
            @if (step.detail) {
              <span class="caption">{{ step.detail }}</span>
            }
          </span>
        </li>
      } @empty {
        <li class="step running">
          <span class="mark"><span class="spinner"></span></span>
          <span class="strong-sm">{{ waiting() }}</span>
        </li>
      }
    </ol>
  `,
  styles: `
    .steps {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .step {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      animation: fade-up 200ms var(--ease);
    }
    .mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      color: var(--primary);
    }
    .done .mark {
      background: var(--mint-400);
      color: var(--white);
    }
    .failed .mark {
      background: var(--danger);
      color: var(--white);
    }
    .running .spinner {
      width: 14px;
      height: 14px;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }
    .done .strong-sm {
      color: var(--text-body);
    }
  `,
})
export class StepList {
  readonly steps = input.required<AiStep[]>();
  readonly waiting = input('Ci penso');
}
