import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import { AD_IMAGE_ASPECT, type AdImageOption, type AdImageRole } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { ToastService } from '../../../ui/toast';
import { readDataUri } from './format';

// Le immagini di un formato (orizzontale, quadrata, verticale, logo): si sceglie tra i contenuti del brand, il logo o una
// caricata dal dispositivo. Il server taglia al centro nella proporzione giusta, e l'anteprima fa lo stesso.
@Component({
  selector: 'mb-ad-image-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <div class="head">
      <span class="label">{{ roleLabel() | t }}</span>
      <span class="caption">{{ 'adsManage.images.count' | t: { n: selected().length, max: max() } }}</span>
    </div>
    <div class="grid">
      @for (image of options(); track image.file) {
        <button type="button" class="thumb" [class.on]="selected().includes(image.file)" [style.aspect-ratio]="aspect()"
          [attr.aria-pressed]="selected().includes(image.file)" [attr.aria-label]="image.title" [title]="image.title" (click)="toggle(image)">
          <img [src]="image.url" alt="" loading="lazy" />
          @if (selected().includes(image.file)) {
            <span class="mark"><mb-icon name="check" [size]="14" /></span>
          }
        </button>
      }
      <label class="thumb upload" [style.aspect-ratio]="aspect()">
        @if (uploading()) {
          <span class="spinner"></span>
        } @else {
          <mb-icon name="image-plus" [size]="20" />
          <span class="caption">{{ 'adsManage.images.upload' | t }}</span>
        }
        <input class="file-input" type="file" accept="image/png,image/jpeg,image/webp" [disabled]="uploading()" (change)="upload($event)" />
      </label>
    </div>
    @if (loading()) {
      <span class="caption">{{ 'adsManage.images.loading' | t }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
      gap: 8px;
    }
    .thumb {
      position: relative;
      display: grid;
      place-items: center;
      overflow: hidden;
      padding: 0;
      border: 2px solid transparent;
      border-radius: var(--radius-md);
      background: var(--grey-100);
      cursor: pointer;
    }
    .thumb.on {
      border-color: var(--primary);
    }
    .thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .mark {
      position: absolute;
      top: 4px;
      right: 4px;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--primary);
      color: var(--white);
    }
    .upload {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 4px;
      border: 1.5px dashed var(--grey-300);
      background: var(--white);
      text-align: center;
    }
  `,
})
export class AdImagePicker implements OnInit {
  readonly brandId = input.required<string>();
  readonly role = input.required<AdImageRole>();
  readonly selected = input<string[]>([]);
  readonly max = input(1);
  readonly changed = output<string[]>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  protected readonly images = signal<AdImageOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);

  protected readonly aspect = computed(() => String(AD_IMAGE_ASPECT[this.role()]));
  // Il logo per il formato logo; per gli altri le immagini, logo compreso in fondo.
  protected readonly options = computed(() => {
    const all = this.images();
    if (this.role() === 'logo') return [...all.filter((image) => image.source === 'logo'), ...all.filter((image) => image.source !== 'logo')];
    return all.filter((image) => image.source !== 'logo');
  });
  protected readonly roleLabel = computed<MessageKey>(() => `adsManage.images.${this.role()}` as MessageKey);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.images.set((await this.service.images(this.brandId())).images);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('adsManage.images.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(image: AdImageOption): void {
    const current = this.selected();
    if (current.includes(image.file)) {
      this.changed.emit(current.filter((file) => file !== image.file));
      return;
    }
    this.changed.emit(this.max() === 1 ? [image.file] : [...current, image.file].slice(-this.max()));
  }

  protected async upload(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      this.toast.show(this.i18n.t('adsManage.images.tooLarge'));
      return;
    }
    this.uploading.set(true);
    try {
      const image = await this.service.uploadImage(this.brandId(), await readDataUri(file));
      this.images.update((list) => [image, ...list]);
      this.toggle(image);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('adsManage.images.failed')));
    } finally {
      this.uploading.set(false);
    }
  }
}
