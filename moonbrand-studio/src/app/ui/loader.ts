import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../core/i18n/i18n.service';

// L'attesa di una pagina, col marchio: la falce fa il giro dell'anello, come un transito, e l'anello respira al suo passaggio.
// La falce è tagliata da un cerchio concentrico all'anello, quindi girando attorno al suo centro (38.5, 50) lo stacco resta costante.
// Il viewBox è centrato sull'anello e largo quanto il giro della falce (raggio 50), così non esce mai dal riquadro.
@Component({
  selector: 'mb-loader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status', '[attr.aria-label]': 'ariaLabel()', '[style.--size]': "size() + 'px'" },
  template: `
    <svg viewBox="-12 0 101 100" aria-hidden="true">
      <circle class="ring" cx="38.5" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="6" />
      <path class="crescent" d="M54.46 75.4A26.5 26.5 0 1 0 54.46 24.6A30 30 0 0 1 54.46 75.4Z" fill="var(--accent)" />
    </svg>
  `,
  styles: `
    // Compare dopo 200 ms, sfumando: un'attesa breve non mostra niente, invece di un lampo del marchio.
    :host {
      display: inline-grid;
      place-items: center;
      color: var(--primary);
      animation: appear 240ms ease-out 200ms both;
    }
    @keyframes appear {
      from {
        opacity: 0;
      }
    }
    svg {
      width: var(--size);
      height: var(--size);
      overflow: visible;
    }
    .ring {
      transform-origin: 38.5px 50px;
      animation: ring 1.8s ease-in-out infinite;
    }
    .crescent {
      transform-origin: 38.5px 50px;
      animation: orbit 1.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
    }
    @keyframes orbit {
      to {
        transform: rotate(360deg);
      }
    }
    // A metà giro la falce corre più veloce: l'anello si stringe un poco e si schiarisce, poi torna pieno quando lei rallenta.
    @keyframes ring {
      50% {
        opacity: 0.45;
        transform: scale(0.9);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .crescent {
        animation: none;
      }
      .ring {
        animation-duration: 2.4s;
      }
    }
  `,
})
export class Loader {
  private readonly i18n = inject(I18nService);
  readonly size = input(48);
  readonly label = input<string | null>(null);
  protected readonly ariaLabel = computed(() => this.label() ?? this.i18n.t('ui.loader.label'));
}
