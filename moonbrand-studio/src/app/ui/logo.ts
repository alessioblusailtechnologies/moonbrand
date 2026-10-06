import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// Il marchio, Transito, e il nome; compact lascia solo il marchio (la sidebar compressa).
// L'anello prende il colore del testo, così va bene sulla sidebar blu e sulle pagine chiare; la falce è arancio.
// La falce è il disco (62, 50, r 26.5) meno il cerchio (38.5, 50, r 30), concentrico all'anello: lo stacco resta costante.
@Component({
  selector: 'mb-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="mark" viewBox="10 10 80 80" aria-hidden="true">
      <circle cx="38.5" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="6" />
      <path d="M54.46 75.4A26.5 26.5 0 1 0 54.46 24.6A30 30 0 0 1 54.46 75.4Z" fill="var(--accent)" />
    </svg>
    @if (!compact()) {
      <span class="word">Moonbrand <span class="studio">Studio</span></span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: -0.03em;
      white-space: nowrap;
    }
    .mark {
      flex: none;
      width: 30px;
      height: 30px;
    }
    .studio {
      font-weight: 500;
      opacity: 0.55;
    }
  `,
})
export class Logo {
  readonly compact = input(false);
}
