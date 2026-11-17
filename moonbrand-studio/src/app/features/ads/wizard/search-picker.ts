import { ChangeDetectionStrategy, Component, input, output, signal, type OnDestroy } from '@angular/core';

import { errorMessage } from '../../../core/errors';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';

// Una voce trovata o scelta: id per non scegliere due volte la stessa, detail sotto il nome (tipo, dove sta).
export interface PickerItem<T> {
  id: string;
  name: string;
  detail?: string;
  value: T;
}

// Cerca tra le voci di Google (luoghi, interessi) mentre si scrive e mostra le scelte come chip da togliere.
@Component({
  selector: 'mb-ad-search-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <div class="field">
      <label [attr.for]="inputId">{{ label() }}</label>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
      @if (selected().length) {
        <div class="chips picked">
          @for (item of selected(); track item.id) {
            <button class="chip selected" type="button" [attr.aria-label]="('ads.form.removeItem' | t) + ' ' + item.name" (click)="removed.emit(item.value)">
              {{ item.name }}@if (item.detail) {<span class="detail"> · {{ item.detail }}</span>}
              <mb-icon name="x" [size]="12" [stroke]="2.5" />
            </button>
          }
        </div>
      }
      <div class="field-row">
        <mb-icon name="search" [size]="15" />
        <input [id]="inputId" type="search" autocomplete="off" [placeholder]="placeholder()" [value]="query()" (input)="type($any($event.target).value)"
          (keydown.enter)="$event.preventDefault()" />
      </div>
      @if (query().trim().length >= 2) {
        <div class="results" role="listbox">
          @if (searching()) {
            <span class="caption">{{ 'ads.form.searching' | t }}</span>
          } @else if (failed() !== null) {
            <span class="caption danger">{{ failed() || ('ads.form.searchFailed' | t) }}</span>
          } @else {
            @for (item of results(); track item.id) {
              <button class="result" type="button" role="option" [disabled]="isPicked(item)" (click)="pick(item)">
                <span class="strong-sm">{{ item.name }}</span>
                @if (item.detail) {
                  <span class="caption">{{ item.detail }}</span>
                }
              </button>
            } @empty {
              <span class="caption">{{ 'ads.form.noResults' | t }}</span>
            }
          }
        </div>
      }
      @if (note()) {
        <span class="caption">{{ note() }}</span>
      }
    </div>
  `,
  styles: `
    .picked .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .detail {
      opacity: 0.75;
      font-weight: 400;
    }
    .field-row mb-icon {
      color: var(--text-body);
    }
    .results {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 260px;
      overflow-y: auto;
      padding-top: 6px;
      border-top: 1px solid var(--grey-100);
    }
    .result {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      padding: 8px 6px;
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      text-align: left;
      cursor: pointer;
    }
    .result:hover:not(:disabled) {
      background: var(--surface-sunken);
    }
    .result:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .danger {
      color: var(--danger);
    }
  `,
})
export class AdSearchPicker<T> implements OnDestroy {
  private static next = 0;
  protected readonly inputId = `ad-search-${AdSearchPicker.next++}`;

  readonly label = input.required<string>();
  readonly hint = input('');
  readonly placeholder = input('');
  // Una riga sotto la ricerca, per esempio quando si cerca solo tra i paesi.
  readonly note = input('');
  readonly search = input.required<(query: string) => Promise<PickerItem<T>[]>>();
  readonly selected = input.required<PickerItem<T>[]>();
  readonly picked = output<T>();
  readonly removed = output<T>();

  protected readonly query = signal('');
  protected readonly results = signal<PickerItem<T>[]>([]);
  protected readonly searching = signal(false);
  // Il messaggio dell'errore, o stringa vuota per quello generico; null se non è fallita.
  protected readonly failed = signal<string | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private round = 0;

  protected type(value: string): void {
    this.query.set(value);
    if (this.timer) clearTimeout(this.timer);
    if (value.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.searching.set(true);
    this.timer = setTimeout(() => void this.run(value.trim()), 300);
  }

  private async run(text: string): Promise<void> {
    const round = ++this.round;
    this.failed.set(null);
    try {
      const found = await this.search()(text);
      if (round === this.round) this.results.set(found);
    } catch (error) {
      if (round === this.round) this.failed.set(errorMessage(error, ''));
    } finally {
      if (round === this.round) this.searching.set(false);
    }
  }

  protected isPicked(item: PickerItem<T>): boolean {
    return this.selected().some((chosen) => chosen.id === item.id);
  }

  protected pick(item: PickerItem<T>): void {
    this.picked.emit(item.value);
    this.query.set('');
    this.results.set([]);
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }
}
