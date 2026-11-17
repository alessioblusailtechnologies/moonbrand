import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type { AdImageOption } from '@moonbrand/shared/domain/ads';

import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';

// Le immagini di un formato dell'annuncio (orizzontale, quadrata, verticale, logo). Si scelgono tra i contenuti del
// brand, il logo e quelle caricate; il server le taglia al centro nella proporzione giusta, e qui si vedono già tagliate.
@Component({
  selector: 'mb-ad-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <div class="field">
      <label>{{ label() }}</label>
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
      <div class="thumbs">
        @for (file of selected(); track file; let i = $index) {
          <div class="thumb" [style.aspect-ratio]="aspect()">
            @if (urlOf(file); as url) {
              <img [src]="url" alt="" />
            }
            <button class="icon-btn solid remove" type="button" [attr.aria-label]="'ads.form.removeImage' | t" (click)="remove(i)">
              <mb-icon name="x" [size]="12" [stroke]="3" />
            </button>
          </div>
        }
        @if (selected().length < max()) {
          <button class="thumb add" type="button" [style.aspect-ratio]="aspect()" [class.on]="open()" (click)="open.set(!open())">
            <mb-icon name="image-plus" [size]="20" />
            <span class="caption">{{ (max() === 1 && selected().length === 0 ? 'ads.form.chooseImage' : 'ads.form.addImage') | t }}</span>
          </button>
        }
      </div>
      @if (open()) {
        <div class="gallery">
          <div class="gallery-head">
            <span class="caption">{{ 'ads.form.imagesFrom' | t }}</span>
            <label class="btn btn-secondary btn-sm upload" [attr.for]="inputId" [class.disabled]="uploading()">
              @if (uploading()) {
                <span class="spinner"></span>
              }
              {{ 'ads.form.uploadImage' | t }}
            </label>
            <input [id]="inputId" class="file-input" type="file" accept="image/*" [disabled]="uploading()" (change)="picked($event)" />
          </div>
          @if (options(); as list) {
            <div class="grid">
              @for (option of list; track option.file) {
                <button class="option" type="button" [style.aspect-ratio]="aspect()" [class.chosen]="selected().includes(option.file)"
                  [disabled]="selected().includes(option.file)" [attr.aria-label]="option.title" [title]="option.title" (click)="choose(option)">
                  <img [src]="option.url" alt="" loading="lazy" />
                </button>
              } @empty {
                <p class="caption">{{ 'ads.form.noImages' | t }}</p>
              }
            </div>
          } @else {
            <p class="caption">{{ 'ads.form.loadingImages' | t }}</p>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .thumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .thumb {
      position: relative;
      height: 96px;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
    }
    .thumb img,
    .option img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .remove {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 22px;
      height: 22px;
    }
    .add {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-width: 96px;
      border: 1.5px dashed var(--grey-300);
      color: var(--text-body);
      cursor: pointer;
    }
    .add.on,
    .add:hover {
      border-color: var(--primary);
    }
    .gallery {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--grey-100);
    }
    .gallery-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .upload {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .upload.disabled {
      opacity: 0.6;
      pointer-events: none;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 8px;
      max-height: 300px;
      overflow-y: auto;
    }
    .option {
      padding: 0;
      overflow: hidden;
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
      cursor: pointer;
    }
    .option:hover:not(:disabled) {
      border-color: var(--primary);
    }
    .option.chosen {
      opacity: 0.4;
      cursor: default;
    }
  `,
})
export class AdImagePicker {
  private static next = 0;
  protected readonly inputId = `ad-image-${AdImagePicker.next++}`;

  readonly label = input.required<string>();
  readonly hint = input('');
  // Larghezza/altezza: 1.91 orizzontale, 1 quadrata, 0.8 verticale.
  readonly aspect = input(1);
  // null mentre si caricano.
  readonly options = input.required<AdImageOption[] | null>();
  readonly selected = input.required<string[]>();
  readonly max = input(1);
  readonly uploading = input(false);
  readonly selectedChange = output<string[]>();
  readonly upload = output<File>();

  protected readonly open = signal(false);
  private readonly byFile = computed(() => new Map((this.options() ?? []).map((option) => [option.file, option.url])));

  protected urlOf(file: string): string | null {
    return this.byFile().get(file) ?? null;
  }

  protected choose(option: AdImageOption): void {
    const next = [...this.selected(), option.file].slice(0, this.max());
    this.selectedChange.emit(next);
    if (next.length >= this.max()) this.open.set(false);
  }

  protected remove(index: number): void {
    this.selectedChange.emit(this.selected().filter((_, i) => i !== index));
  }

  protected picked(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (file) this.upload.emit(file);
  }
}
