import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal } from '@angular/core';

import { Icon } from './icon';

export interface SelectOption {
  value: string;
  label: string;
  // Le opzioni con lo stesso gruppo stanno insieme sotto il suo titolo, nell'ordine in cui arrivano.
  group?: string;
}

interface MenuRow {
  kind: 'group' | 'option';
  label: string;
  value: string;
  index: number;
}

const MENU_MAX_HEIGHT = 280;
const MENU_GAP = 4;

// Il menu a tendina dello studio, al posto del <select> del browser: stessa resa su ogni sistema.
// Si apre sotto il campo (o sopra, se sotto non c'è spazio), in posizione fissa così nessun contenitore lo taglia;
// si usa con mouse, dito e tastiera (frecce, Invio, Esc). variant: 'sunken' è il campo grigio, 'plain' sta dentro un
// .field che ha già bordo e sfondo.
@Component({
  selector: 'mb-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: {
    '(document:pointerdown)': 'outside($event)',
    '(window:resize)': 'close()',
    '(document:scroll)': 'onScroll($event)',
  },
  template: `
    <button
      class="trigger"
      type="button"
      role="combobox"
      [class.sunken]="variant() === 'sunken'"
      [class.plain]="variant() === 'plain'"
      [class.compact]="compact()"
      [attr.id]="inputId()"
      [attr.aria-label]="label()"
      [attr.aria-expanded]="open()"
      aria-haspopup="listbox"
      [disabled]="disabled()"
      (click)="toggle()"
      (keydown)="onKey($event)"
    >
      <span class="value" [class.empty]="!selected()">{{ selected()?.label ?? placeholder() }}</span>
      <mb-icon name="chevrons-up-down" [size]="14" />
    </button>
    @if (open()) {
      <ul class="menu" role="listbox" [style.top.px]="position().top" [style.bottom.px]="position().bottom" [style.left.px]="position().left"
        [style.width.px]="position().width" [style.max-height.px]="position().maxHeight">
        @for (row of rows(); track row.kind + row.value + row.label) {
          @if (row.kind === 'group') {
            <li class="group" role="presentation">{{ row.label }}</li>
          } @else {
            <li class="option" role="option" [attr.aria-selected]="row.value === value()" [class.active]="row.index === active()"
              [class.selected]="row.value === value()" (pointerenter)="active.set(row.index)" (click)="choose(row.value)">
              <span class="grow">{{ row.label }}</span>
              @if (row.value === value()) {
                <mb-icon name="check" [size]="14" [stroke]="2.5" />
              }
            </li>
          }
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
    .trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      text-align: left;
      cursor: pointer;
      color: var(--text-title);
      &:disabled {
        cursor: default;
        opacity: 0.6;
      }
      mb-icon {
        flex: none;
        color: var(--grey-500);
      }
    }
    .trigger.sunken[aria-expanded='true'] {
      border-color: var(--border-strong);
      background: var(--white);
    }
    .trigger.plain {
      padding: 0;
      border: 0;
      background: transparent;
      font-size: 15px;
      font-weight: 500;
    }
    .trigger.compact {
      min-height: 34px;
      padding: 6px 10px;
    }
    .value {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      &.empty {
        color: var(--grey-500);
      }
    }
    .menu {
      position: fixed;
      z-index: 1000;
      margin: 0;
      padding: 6px;
      overflow-y: auto;
      list-style: none;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
    }
    .group {
      padding: 8px 10px 4px;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-body);
    }
    .option {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: var(--radius-sm);
      font-size: 14px;
      color: var(--text-title);
      cursor: pointer;
      &.active {
        background: var(--surface-sunken);
      }
      &.selected {
        font-weight: 600;
      }
      mb-icon {
        flex: none;
        color: var(--primary);
      }
    }
    .grow {
      flex: 1;
      min-width: 0;
    }
    @media (max-width: 760px), (pointer: coarse) {
      .trigger,
      .option {
        font-size: 16px;
      }
    }
  `,
})
export class Select {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<SelectOption[]>();
  readonly value = input<string>('');
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly label = input<string | null>(null);
  readonly inputId = input<string | null>(null);
  readonly variant = input<'sunken' | 'plain'>('sunken');
  readonly compact = input(false);
  readonly changed = output<string>();

  protected readonly open = signal(false);
  protected readonly active = signal(-1);
  protected readonly position = signal({ top: null as number | null, bottom: null as number | null, left: 0, width: 0, maxHeight: MENU_MAX_HEIGHT });

  protected readonly selected = computed(() => this.options().find((option) => option.value === this.value()) ?? null);

  // Le opzioni con i titoli dei gruppi in mezzo; index è la posizione tra le sole opzioni, per la tastiera.
  protected readonly rows = computed<MenuRow[]>(() => {
    const rows: MenuRow[] = [];
    let group: string | undefined;
    this.options().forEach((option, index) => {
      if (option.group && option.group !== group) rows.push({ kind: 'group', label: option.group, value: '', index: -1 });
      group = option.group;
      rows.push({ kind: 'option', label: option.label, value: option.value, index });
    });
    return rows;
  });

  protected toggle(): void {
    if (this.open()) this.close();
    else this.show();
  }

  private show(): void {
    if (this.disabled()) return;
    const rect = this.host.nativeElement.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - MENU_GAP * 2;
    const above = rect.top - MENU_GAP * 2;
    const up = below < Math.min(MENU_MAX_HEIGHT, 160) && above > below;
    this.position.set({
      top: up ? null : rect.bottom + MENU_GAP,
      bottom: up ? window.innerHeight - rect.top + MENU_GAP : null,
      left: rect.left,
      width: Math.max(rect.width, 180),
      maxHeight: Math.min(MENU_MAX_HEIGHT, up ? above : below),
    });
    this.active.set(Math.max(0, this.options().findIndex((option) => option.value === this.value())));
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
  }

  protected choose(value: string): void {
    this.close();
    if (value !== this.value()) this.changed.emit(value);
  }

  protected outside(event: PointerEvent): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  // Il menu è fisso: se scorre la pagina sotto, si chiude; se scorre il menu stesso, resta.
  protected onScroll(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.close();
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!this.open()) {
          this.show();
          return;
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.active.update((index) => (index + step + count) % count);
        this.scrollActive();
        return;
      }
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.open() && this.active() >= 0) this.choose(this.options()[this.active()].value);
        else this.show();
        return;
      case 'Escape':
        if (this.open()) {
          // Esc chiude il menu, non il pannello o la finestra che lo contiene.
          event.preventDefault();
          event.stopPropagation();
          this.close();
        }
        return;
      case 'Tab':
        this.close();
        return;
    }
  }

  private scrollActive(): void {
    queueMicrotask(() => this.host.nativeElement.querySelector('.option.active')?.scrollIntoView({ block: 'nearest' }));
  }
}
