import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { ChannelChoice } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { ChannelMark } from '../../ui/channel-mark';
import { lockPageScroll } from '../../ui/scroll-lock';

// Dopo l'accesso a Facebook o LinkedIn: dove pubblica moonbrand (una Pagina, il profilo o una pagina aziendale).
// Chiudere senza scegliere annulla il collegamento.
@Component({
  selector: 'mb-channel-choice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChannelMark],
  host: { '(document:keydown.escape)': 'cancel()' },
  template: `
    <div class="backdrop" (click)="cancel()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="choice-title">
      <header class="head">
        <mb-channel-mark [channel]="channel()" [active]="true" [size]="30" />
        <div class="titles">
          <h2 id="choice-title" class="dialog-title">Dove pubblichiamo su {{ name() }}?</h2>
          <p class="caption">{{ hint() }}</p>
        </div>
      </header>

      <div class="list" role="radiogroup" [attr.aria-label]="'Account ' + name()">
        @for (choice of choices(); track choice.id) {
          <button class="option" type="button" role="radio" [attr.aria-checked]="picked() === choice.id" [class.on]="picked() === choice.id"
            [disabled]="busy()" (click)="picked.set(choice.id)">
            @if (choice.picture) {
              <img class="picture" [src]="choice.picture" alt="" referrerpolicy="no-referrer" />
            } @else {
              <span class="picture initial" aria-hidden="true">{{ choice.name.charAt(0).toUpperCase() }}</span>
            }
            <span class="texts">
              <span class="strong">{{ choice.name }}</span>
              <span class="caption">{{ choice.detail }}</span>
            </span>
            <span class="dot" aria-hidden="true"></span>
          </button>
        }
      </div>

      <div class="actions">
        <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="cancel()">Annulla</button>
        <button class="btn btn-primary" type="button" [class.busy]="busy()" [attr.aria-disabled]="!picked()" (click)="confirm()">
          @if (busy()) {
            <span class="spinner"></span>
          }
          Collega
        </button>
      </div>
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
      width: min(460px, calc(100vw - 32px));
      max-height: calc(100dvh - 48px);
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .head {
      display: flex;
      align-items: flex-start;
      gap: 12px;
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
    .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      overflow-y: auto;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px 10px 10px;
      border: 1.5px solid var(--border-card);
      border-radius: var(--radius-xl);
      background: var(--white);
      text-align: left;
      cursor: pointer;
      transition: border-color 120ms var(--ease);
    }
    .option.on {
      border-color: var(--border-strong);
    }
    .picture {
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      object-fit: cover;
    }
    .initial {
      display: grid;
      place-items: center;
      background: var(--grey-100);
      color: var(--text-title);
      font-weight: 600;
    }
    .texts {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .dot {
      flex: none;
      width: 18px;
      height: 18px;
      border: 1.5px solid var(--border-strong);
      border-radius: 50%;
    }
    .option.on .dot {
      border: 5px solid var(--ink);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    @media (max-width: 480px) {
      .actions {
        flex-direction: column-reverse;
      }
    }
  `,
})
export class ChannelChoiceDialog {
  readonly channel = input.required<ChannelId>();
  readonly choices = input.required<ChannelChoice[]>();
  readonly busy = input(false);
  readonly chosen = output<string>();
  readonly cancelled = output<void>();

  protected readonly picked = signal<string | null>(null);
  protected readonly name = computed(() => channelName(this.channel()));
  protected readonly hint = computed(() =>
    this.channel() === 'linkedin'
      ? 'Scegli se pubblicare come te o come una pagina aziendale che gestisci.'
      : 'Scegli la Pagina su cui pubblicare: moonbrand pubblica solo lì.',
  );

  constructor() {
    lockPageScroll();
  }

  protected confirm(): void {
    const picked = this.picked();
    if (picked && !this.busy()) this.chosen.emit(picked);
  }

  protected cancel(): void {
    if (!this.busy()) this.cancelled.emit();
  }
}
