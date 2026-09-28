import { ChangeDetectionStrategy, Component, input, output, signal, type OnInit } from '@angular/core';

import type { CreateContentRequest } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { ContentFormat } from '@moonbrand/shared/domain/content';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { Idea } from '@moonbrand/shared/domain/idea';

import { lockPageScroll } from '../../ui/scroll-lock';
import { FORMAT_OPTIONS } from '../contents/labels';

@Component({
  selector: 'mb-create-content-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'busy() || closed.emit()' },
  template: `
    <div class="backdrop" (click)="busy() || closed.emit()"></div>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="create-content-title">
      <div class="stack">
        <h2 id="create-content-title" class="dialog-title">Crea il contenuto</h2>
        <p class="body">{{ idea().title }}</p>
      </div>

      <div class="stack">
        <p class="label">Formato</p>
        <div class="formats" role="radiogroup" aria-label="Formato">
          @for (option of formats; track option.id) {
            <button class="option-card" type="button" role="radio" [attr.aria-checked]="format() === option.id"
              [class.selected]="format() === option.id" (click)="format.set(option.id)">
              <span class="grow">
                <span class="strong-sm">{{ option.label }}</span>
                <span class="caption">{{ option.hint }}</span>
              </span>
              <span class="radio-mark" [class.on]="format() === option.id"></span>
            </button>
          }
        </div>
      </div>

      <div class="stack">
        <p class="label">Canali</p>
        <div class="chips" role="group" aria-label="Canali">
          @for (channel of channels(); track channel) {
            <button class="chip" type="button" [attr.aria-pressed]="selected().includes(channel)" [class.selected]="selected().includes(channel)"
              (click)="toggle(channel)">
              {{ name(channel) }}
            </button>
          }
        </div>
      </div>

      <div class="actions">
        <button class="btn btn-secondary" type="button" [disabled]="busy()" (click)="closed.emit()">Annulla</button>
        <button class="btn btn-primary" type="button" [disabled]="busy() || selected().length === 0" (click)="submit()">
          {{ busy() ? 'Creo…' : 'Crea il contenuto' }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 71;
      display: flex;
      flex-direction: column;
      gap: 18px;
      width: min(480px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      padding: 24px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .dialog-title {
      margin: 0;
      color: var(--text-title);
      font-size: 17px;
      font-weight: 600;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .body {
      margin: 0;
    }
    .formats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .option-card {
      padding: 12px 14px;
      border-color: var(--grey-100);
      background: var(--surface-card);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `,
})
export class CreateContentDialog implements OnInit {
  readonly idea = input.required<Idea>();
  readonly channels = input.required<ChannelId[]>();
  readonly busy = input(false);
  readonly closed = output();
  readonly created = output<CreateContentRequest>();

  constructor() {
    lockPageScroll();
  }

  protected readonly formats = FORMAT_OPTIONS;
  protected readonly format = signal<ContentFormat>('post');
  protected readonly selected = signal<ChannelId[]>([]);
  protected readonly name = channelName;

  ngOnInit(): void {
    this.selected.set([...this.channels()]);
  }

  protected toggle(channel: ChannelId): void {
    this.selected.update((list) => (list.includes(channel) ? list.filter((item) => item !== channel) : [...list, channel]));
  }

  protected submit(): void {
    if (this.selected().length > 0) this.created.emit({ format: this.format(), channels: this.selected() });
  }
}
