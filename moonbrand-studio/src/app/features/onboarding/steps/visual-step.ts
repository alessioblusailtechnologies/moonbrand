import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import { type BrandDraft, type MediaFile, type Palette, type Visual } from '@moonbrand/shared/domain/brand';
import { paletteSlotLabels } from '@moonbrand/shared/domain/catalog';

import { BrandsService } from '../../../core/brands/brands.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { LogoBackdrop } from '../../../ui/logo-backdrop';
import { LightboxService } from '../../../ui/lightbox';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';
import { LOGO_SIDE, resizedDataUri } from '../../../core/images';

const MAX_REFERENCES = 6;

function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

// Il passo visivo: il logo, i colori e le immagini di riferimento che il brand carica. Lo stile dei contenuti nasce da
// queste immagini: l'assistente le guarda prima di fare una grafica o un video.
@Component({
  selector: 'mb-visual-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, LogoBackdrop, TranslatePipe],
  templateUrl: './visual-step.html',
  styleUrl: './visual-step.scss',
})
export class VisualStep {
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly lightbox = inject(LightboxService);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(DraftStore);
  readonly draft = input.required<BrandDraft>();

  protected readonly slotLabels = computed(() => paletteSlotLabels(this.i18n.locale()));
  protected readonly maxReferences = MAX_REFERENCES;
  protected readonly uploading = signal(0);
  protected readonly hexDrafts = signal<string[]>([]);

  protected readonly visual = computed(() => this.draft().visual);
  protected readonly references = computed(() => this.visual().references ?? []);
  protected readonly sitePalette = computed(() => this.store.insights()?.palette ?? (this.visual().palette.origin === 'site' ? this.visual().palette : null));
  protected readonly custom = computed(() => this.visual().palette.origin !== 'site');
  protected readonly placeholders = computed(() => Array.from({ length: this.uploading() }, (_, i) => i));

  constructor() {
    effect(() => {
      this.hexDrafts.set(this.visual().palette.colors.map((color) => color.toUpperCase()));
    });
  }

  private current(): Visual {
    return this.store.draft()?.visual ?? this.visual();
  }

  protected set(patch: Partial<Visual>): void {
    this.store.patch({ key: 'visual', value: { ...this.current(), ...patch } });
  }

  protected async pickLogo(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    try {
      this.set({ logoUri: await resizedDataUri(file, LOGO_SIDE, 'image/png') });
      this.toast.show(this.i18n.t('onboarding.visual.logo.uploaded'));
    } catch {
      this.toast.show(this.i18n.t('onboarding.visual.logo.unreadable'));
    }
  }

  protected async pickReferences(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const brandId = this.store.brandId();
    const room = MAX_REFERENCES - this.references().length - this.uploading();
    const files = Array.from(inputEl.files ?? []).slice(0, Math.max(0, room));
    inputEl.value = '';
    if (!brandId) return;
    if (files.length === 0) {
      this.toast.show(this.i18n.t('onboarding.visual.references.max', { n: MAX_REFERENCES }));
      return;
    }
    this.uploading.update((count) => count + files.length);
    for (const file of files) {
      try {
        const uploaded = await this.brands.uploadReference(brandId, await resizedDataUri(file, 1600, 'image/jpeg'));
        this.set({ references: [...(this.current().references ?? []), uploaded] });
      } catch (error) {
        this.toast.show(errorMessage(error, this.i18n.t('onboarding.visual.references.uploadFailed')));
      } finally {
        this.uploading.update((count) => Math.max(0, count - 1));
      }
    }
  }

  protected async removeReference(file: MediaFile): Promise<void> {
    try {
      await this.store.removeReference(file);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('onboarding.visual.references.removeFailed')));
    }
  }

  protected openReference(index: number): void {
    this.lightbox.open(
      this.references().map((file, i) => ({ url: file.url, alt: this.i18n.t('onboarding.visual.references.alt', { n: i + 1 }) })),
      index,
    );
  }

  protected chooseSitePalette(): void {
    const palette = this.sitePalette();
    if (palette) this.set({ palette });
  }

  protected chooseCustom(): void {
    const { palette } = this.current();
    this.set({ palette: { id: 'custom', name: 'I miei colori', colors: [...palette.colors], origin: 'custom' } });
  }

  protected editHex(index: number, text: string): void {
    this.hexDrafts.update((drafts) => drafts.map((draft, i) => (i === index ? text : draft)));
    const hex = normalizeHex(text);
    if (!hex) return;
    const colors: Palette['colors'] = [...this.current().palette.colors];
    colors[index] = hex;
    this.set({ palette: { id: 'custom', name: 'I miei colori', colors, origin: 'custom' } });
  }
}
