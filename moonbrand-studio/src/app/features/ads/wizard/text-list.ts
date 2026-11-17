import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';

// Una lista di testi brevi con il contatore dei caratteri, da min a max righe: titoli, descrizioni, callout. Con pins
// ogni riga può avere una posizione fissa (1..pinMax) nell'annuncio della rete di ricerca.
@Component({
  selector: 'mb-ad-text-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <div class="field">
      <label>{{ label() }}</label>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
      @for (item of items(); track $index; let i = $index) {
        <div class="field-row item">
          @if (multiline()) {
            <textarea rows="2" [attr.maxlength]="chars()" [attr.aria-label]="label()" [value]="item" (input)="setItem(i, $any($event.target).value)"></textarea>
          } @else {
            <input [attr.maxlength]="chars()" [attr.aria-label]="label()" [value]="item" (input)="setItem(i, $any($event.target).value)" />
          }
          <span class="count" [class.full]="item.length >= chars()">{{ item.length }}/{{ chars() }}</span>
          @if (pinMax() > 0) {
            <select class="pin" [attr.aria-label]="'ads.form.pin' | t" [value]="pinAt(i)" (change)="setPin(i, $any($event.target).value)">
              <option value="">{{ 'ads.form.pinNone' | t }}</option>
              @for (n of pinOptions(); track n) {
                <option [value]="n" [selected]="pinAt(i) === '' + n">{{ 'ads.form.pinPosition' | t: { n } }}</option>
              }
            </select>
          }
          <button class="icon-btn" type="button" [disabled]="items().length <= min()" [attr.aria-label]="'ads.form.removeItem' | t" (click)="remove(i)">
            <mb-icon name="x" [size]="15" />
          </button>
        </div>
      }
      @if (items().length < max()) {
        <button class="link-btn add" type="button" (click)="add()"><mb-icon name="plus" [size]="14" /> {{ addLabel() }}</button>
      }
    </div>
  `,
  styles: `
    .item {
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--grey-100);
    }
    .item input,
    .item textarea {
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .count {
      flex: none;
      width: 44px;
      color: var(--text-body);
      font-size: 12px;
      text-align: right;
    }
    .count.full {
      color: var(--danger);
    }
    .pin {
      flex: none;
      width: auto !important;
      max-width: 120px;
      font-size: 12px !important;
      color: var(--text-body) !important;
    }
    .add {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class AdTextList {
  readonly label = input.required<string>();
  readonly hint = input('');
  readonly addLabel = input.required<string>();
  readonly items = input.required<string[]>();
  readonly pins = input<(number | null)[]>([]);
  readonly pinMax = input(0);
  readonly min = input(0);
  readonly max = input(20);
  readonly chars = input(30);
  readonly multiline = input(false);
  readonly itemsChange = output<string[]>();
  readonly pinsChange = output<(number | null)[]>();

  protected readonly pinOptions = computed(() => Array.from({ length: this.pinMax() }, (_, i) => i + 1));

  protected pinAt(index: number): string {
    const pin = this.pins()[index];
    return pin ? String(pin) : '';
  }

  protected setItem(index: number, value: string): void {
    this.itemsChange.emit(this.items().map((item, i) => (i === index ? value : item)));
  }

  protected setPin(index: number, value: string): void {
    const pins = Array.from({ length: this.items().length }, (_, i) => this.pins()[i] ?? null);
    pins[index] = value ? Number(value) : null;
    this.pinsChange.emit(pins);
  }

  protected add(): void {
    this.itemsChange.emit([...this.items(), '']);
    if (this.pinMax() > 0) this.pinsChange.emit([...Array.from({ length: this.items().length }, (_, i) => this.pins()[i] ?? null), null]);
  }

  protected remove(index: number): void {
    this.itemsChange.emit(this.items().filter((_, i) => i !== index));
    if (this.pinMax() > 0) this.pinsChange.emit(Array.from({ length: this.items().length }, (_, i) => this.pins()[i] ?? null).filter((_, i) => i !== index));
  }
}
