import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'mb-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="moon" [class.light]="light()"></span>
    <span class="word">Moonbrand <span class="studio">Studio</span></span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .moon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--orange-500);
      box-shadow: inset 7px -3px 0 0 var(--navy-700);
    }
    .moon.light {
      box-shadow: inset 7px -3px 0 0 var(--indigo-900);
    }
    .studio {
      font-weight: 500;
      opacity: 0.6;
    }
  `,
})
export class Logo {
  readonly light = input(false);
}
