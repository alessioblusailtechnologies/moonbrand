import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import type { BrandDraft } from '@moonbrand/shared/domain/brand';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { DraftStore } from '../draft-store';

// Le istruzioni personalizzate: testo libero che l'AI segue in ogni lavoro del brand.
@Component({
  selector: 'mb-instructions-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="panel">
      <label class="label" for="instructions">{{ 'onboarding.instructions.label' | t }}</label>
      <textarea id="instructions" class="sunken" rows="10" [placeholder]="'onboarding.instructions.placeholder' | t"
        [attr.aria-label]="'onboarding.instructions.aria' | t" [value]="draft().instructions"
        (input)="store.patch({ key: 'instructions', value: $any($event.target).value })"></textarea>
      <p class="caption">{{ 'onboarding.instructions.hint' | t }}</p>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
    }
    textarea {
      resize: vertical;
      min-height: 180px;
    }
  `,
})
export class InstructionsStep {
  protected readonly store = inject(DraftStore);
  readonly draft = input.required<BrandDraft>();
}
