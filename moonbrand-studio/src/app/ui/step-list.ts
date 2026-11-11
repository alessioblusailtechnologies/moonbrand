import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';

import { I18nService } from '../core/i18n/i18n.service';
import { Icon } from './icon';
import { Loader } from './loader';

// I passaggi di un lavoro dell'AI, come in Claude: una riga sola, senza riquadro, che dice cosa sta facendo (con il
// marchio che si muove e il testo che luccica) o, finito, quanti passaggi ha fatto. La freccia apre l'elenco.
@Component({
  selector: 'mb-step-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader],
  template: `
    <button class="head" type="button" [disabled]="steps().length === 0" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      @if (active()) {
        <mb-loader class="glyph" [size]="15" aria-hidden="true" />
      }
      <span class="step-title" [class.shine]="active()">{{ title() }}</span>
      @if (steps().length > 0) {
        <mb-icon class="chevron" name="chevron-right" [size]="13" />
      }
    </button>
    @if (open()) {
      <ol class="steps">
        @for (step of steps(); track step.id) {
          <li class="step" [class]="step.status">
            <span class="step-label" [class.shine]="step.status === 'running'" [attr.title]="step.label">{{ step.label }}</span>
            @if (step.detail) {
              <span class="detail" [attr.title]="step.detail">{{ step.detail }}</span>
            }
          </li>
        }
      </ol>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .head {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      align-self: flex-start;
      max-width: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: var(--text-body);
      font: inherit;
      font-size: 13px;
      line-height: 1.4;
      text-align: left;
      cursor: pointer;
      transition: color 120ms var(--ease);
    }
    .head:disabled {
      cursor: default;
    }
    .head:not(:disabled):hover {
      color: var(--text-title);
    }
    .step-title {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chevron {
      flex: none;
      transition: transform 160ms var(--ease);
    }
    .head[aria-expanded='true'] .chevron {
      transform: rotate(90deg);
    }
    // Il segno del lavoro in corso: il marchio di Moonbrand, con la falce che fa il giro dell'anello.
    .glyph {
      flex: none;
    }
    // Il testo di quello che sta facendo: un riflesso di luce che lo attraversa.
    .shine {
      background: linear-gradient(90deg, var(--text-body) 0%, var(--text-body) 40%, var(--text-title) 50%, var(--text-body) 60%, var(--text-body) 100%);
      background-size: 250% 100%;
      background-clip: text;
      -webkit-background-clip: text;
      color: transparent;
      animation: shine 2s linear infinite;
    }
    // L'elenco aperto: una tabella leggera, una riga per passaggio separata da un filo, l'etichetta a sinistra e il
    // dettaglio a destra.
    .steps {
      display: flex;
      flex-direction: column;
      width: min(560px, 100%);
      margin: 0;
      padding: 0;
      overflow: hidden;
      border: 1px solid color-mix(in srgb, var(--border-card) 70%, transparent);
      border-radius: 10px;
      background: color-mix(in srgb, var(--surface-sunken) 45%, transparent);
      list-style: none;
      animation: fade-in 160ms var(--ease);
    }
    .step {
      display: flex;
      align-items: baseline;
      gap: 12px;
      min-width: 0;
      padding: 7px 12px;
      font-size: 12.5px;
      line-height: 1.45;
      color: var(--text-body);
    }
    .step + .step {
      border-top: 1px solid color-mix(in srgb, var(--border-card) 60%, transparent);
    }
    .step-label,
    .detail {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .step-label {
      flex: 1;
      min-width: 0;
    }
    .detail {
      flex: 0 1 45%;
      font-size: 11.5px;
      text-align: right;
      opacity: 0.75;
    }
    .failed .step-label {
      opacity: 0.6;
    }
    @keyframes shine {
      from {
        background-position: 100% 0;
      }
      to {
        background-position: -150% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .shine {
        animation: none;
      }
    }
  `,
})
export class StepList {
  readonly steps = input.required<AiStep[]>();
  private readonly i18n = inject(I18nService);
  // Cosa dire prima del primo passaggio; senza, «Ci penso» nella lingua dell'interfaccia.
  readonly waiting = input<string>();
  // Se il lavoro è ancora in corso; senza, lo è finché la lista si vede (come mentre si preparano le idee).
  readonly live = input<boolean>();

  protected readonly open = signal(false);
  protected readonly active = computed(() => this.live() ?? true);
  // In corso, l'ultimo passaggio partito; finito, quanti passaggi ha fatto.
  protected readonly title = computed(() => {
    const steps = this.steps();
    if (!this.active()) return this.i18n.t('ui.steps.count', { n: steps.length });
    const running = steps.filter((step) => step.status === 'running').at(-1);
    if (running) return running.label;
    return steps.length === 0 ? (this.waiting() ?? this.i18n.t('ui.steps.thinking')) : this.i18n.t('ui.steps.thinking');
  });
}
