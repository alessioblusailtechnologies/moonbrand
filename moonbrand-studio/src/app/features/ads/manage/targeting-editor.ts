import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import type { AdTargetingRequest } from '@moonbrand/shared/api/contract';
import { AD_DEVICES, adLocations, type Ad, type AdDevice, type AdLocation, type AdRadius } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { ToastService } from '../../../ui/toast';
import { AdLocationSearch } from './location-search';

export const LANGUAGES = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'ro', 'pl', 'ar', 'zh_CN', 'ru'];

// Dove e su quali dispositivi esce una campagna già su Google: luoghi, luoghi esclusi, raggi, lingue, dispositivi e se
// contare anche chi si interessa ai luoghi senza esserci.
@Component({
  selector: 'mb-ad-targeting-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdLocationSearch, Icon, TranslatePipe],
  template: `
    <section class="stack">
      <p class="label">{{ 'adsManage.target.where' | t }}</p>
      <mb-ad-location-search [brandId]="brandId()" [value]="locations()" (changed)="locations.set($event)" />
    </section>
    <section class="stack">
      <p class="label">{{ 'adsManage.target.excluded' | t }}</p>
      <mb-ad-location-search [brandId]="brandId()" [value]="excluded()" [exclude]="true" (changed)="excluded.set($event)" />
    </section>

    @if (radiusAllowed()) {
      <section class="stack">
        <p class="label">{{ 'adsManage.target.radius' | t }}</p>
        <p class="caption">{{ 'adsManage.target.radiusHint' | t }}</p>
        @for (r of radius(); track $index) {
          <div class="panel item">
            <span class="grow strong-sm">{{ r.label || (r.latitude + ', ' + r.longitude) }}</span>
            <span class="caption">{{ r.radius }} {{ r.unit }}</span>
            <button class="icon-btn" type="button" [attr.aria-label]="'adsManage.loc.remove' | t" (click)="removeRadius($index)"><mb-icon name="x" [size]="14" /></button>
          </div>
        }
        <div class="radius-row">
          <input class="sunken" type="text" [placeholder]="'adsManage.target.radiusLabel' | t" [value]="radiusDraft().label" (input)="setRadius('label', $any($event.target).value)" />
          <input class="sunken" type="number" step="any" [placeholder]="'adsManage.target.lat' | t" [value]="radiusDraft().latitude" (input)="setRadius('latitude', $any($event.target).value)" />
          <input class="sunken" type="number" step="any" [placeholder]="'adsManage.target.lng' | t" [value]="radiusDraft().longitude" (input)="setRadius('longitude', $any($event.target).value)" />
          <input class="sunken" type="number" min="1" max="800" [placeholder]="'km'" [value]="radiusDraft().radius" (input)="setRadius('radius', $any($event.target).value)" />
          <button class="btn btn-secondary btn-sm" type="button" [disabled]="!radiusReady()" (click)="addRadius()">{{ 'adsManage.target.addRadius' | t }}</button>
        </div>
        <span class="caption">{{ 'adsManage.target.coordsHint' | t }}</span>
      </section>
    }

    <button class="option-card" type="button" role="checkbox" [attr.aria-checked]="presenceOnly()" [class.selected]="presenceOnly()" (click)="presenceOnly.set(!presenceOnly())">
      <span class="grow">
        <span class="strong-sm">{{ 'adsManage.target.presence' | t }}</span>
        <span class="caption">{{ 'adsManage.target.presenceHint' | t }}</span>
      </span>
      <span class="radio-mark" [class.on]="presenceOnly()"></span>
    </button>

    <section class="stack">
      <p class="label">{{ 'ads.form.language' | t }}</p>
      <div class="chips">
        @for (option of languageOptions(); track option.value) {
          <button class="chip" type="button" [class.selected]="languages().includes(option.value)" [attr.aria-pressed]="languages().includes(option.value)"
            (click)="toggleLanguage(option.value)">{{ option.label }}</button>
        }
      </div>
    </section>

    <section class="stack">
      <p class="label">{{ 'adsManage.target.devices' | t }}</p>
      <div class="chips">
        @for (device of devices; track device) {
          <button class="chip" type="button" [class.selected]="chosenDevices().includes(device)" [attr.aria-pressed]="chosenDevices().includes(device)"
            (click)="toggleDevice(device)">{{ deviceLabel(device) | t }}</button>
        }
      </div>
    </section>

    @if (error()) {
      <p class="caption danger">{{ error() }}</p>
    }
    <div class="row end">
      <button class="btn btn-primary btn-sm" type="button" [disabled]="saving()" (click)="save()">
        @if (saving()) {
          <span class="spinner"></span>
        }
        {{ 'adsManage.save' | t }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      flex-direction: row;
      align-items: center;
      padding: 10px 14px;
    }
    .radius-row {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 80px auto;
      gap: 8px;
      align-items: center;
    }
    .danger {
      color: var(--danger);
    }
    .row.end {
      justify-content: flex-end;
    }
    @media (max-width: 640px) {
      .radius-row {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class AdTargetingEditor implements OnInit {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();
  readonly saved = output<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly devices = AD_DEVICES;

  protected readonly locations = signal<AdLocation[]>([]);
  protected readonly excluded = signal<AdLocation[]>([]);
  protected readonly radius = signal<AdRadius[]>([]);
  protected readonly languages = signal<string[]>([]);
  protected readonly chosenDevices = signal<AdDevice[]>([...AD_DEVICES]);
  protected readonly presenceOnly = signal(true);
  protected readonly radiusDraft = signal({ label: '', latitude: '', longitude: '', radius: '10' });
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly radiusAllowed = computed(() => this.ad().campaignType === 'search' || this.ad().campaignType === 'display');
  protected readonly languageOptions = computed(() => {
    const names = new Intl.DisplayNames([this.i18n.locale()], { type: 'language' });
    const all = [...new Set([...LANGUAGES, ...this.languages()])];
    return all.map((code) => ({ value: code, label: names.of(code.replace('_', '-')) ?? code }));
  });

  ngOnInit(): void {
    const { spec } = this.ad();
    this.locations.set(adLocations(spec));
    this.excluded.set([...(spec.excludedLocations ?? [])]);
    this.radius.set([...(spec.radius ?? [])]);
    this.languages.set([...spec.languages]);
    this.chosenDevices.set(spec.devices?.length ? [...spec.devices] : [...AD_DEVICES]);
    this.presenceOnly.set(spec.presenceOnly ?? true);
  }

  protected deviceLabel(device: AdDevice): MessageKey {
    return `adsManage.devices.${device}` as MessageKey;
  }

  protected toggleLanguage(code: string): void {
    this.languages.update((list) => (list.includes(code) ? list.filter((item) => item !== code) : [...list, code]));
  }

  protected toggleDevice(device: AdDevice): void {
    this.chosenDevices.update((list) => (list.includes(device) ? list.filter((item) => item !== device) : [...list, device]));
  }

  protected setRadius(key: 'label' | 'latitude' | 'longitude' | 'radius', value: string): void {
    this.radiusDraft.update((draft) => ({ ...draft, [key]: value }));
  }

  protected radiusReady(): boolean {
    const draft = this.radiusDraft();
    const lat = Number(draft.latitude);
    const lng = Number(draft.longitude);
    const r = Number(draft.radius);
    return draft.latitude !== '' && draft.longitude !== '' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && r >= 1 && r <= 800;
  }

  protected addRadius(): void {
    if (!this.radiusReady()) return;
    const draft = this.radiusDraft();
    this.radius.update((list) => [
      ...list,
      { label: draft.label.trim(), latitude: Number(draft.latitude), longitude: Number(draft.longitude), radius: Number(draft.radius), unit: 'km' },
    ]);
    this.radiusDraft.set({ label: '', latitude: '', longitude: '', radius: '10' });
  }

  protected removeRadius(index: number): void {
    this.radius.update((list) => list.filter((_, i) => i !== index));
  }

  protected async save(): Promise<void> {
    if (this.saving()) return;
    if (!this.locations().length && !this.radius().length) {
      this.error.set(this.i18n.t('adsManage.target.needPlace'));
      return;
    }
    if (!this.languages().length) {
      this.error.set(this.i18n.t('adsManage.target.needLanguage'));
      return;
    }
    if (!this.chosenDevices().length) {
      this.error.set(this.i18n.t('adsManage.target.needDevice'));
      return;
    }
    this.error.set(null);
    const request: AdTargetingRequest = {
      locations: this.locations(),
      excludedLocations: this.excluded(),
      languages: this.languages(),
      devices: this.chosenDevices(),
      presenceOnly: this.presenceOnly(),
      ...(this.radiusAllowed() && { radius: this.radius() }),
    };
    this.saving.set(true);
    try {
      const ad = await this.service.targeting(this.brandId(), this.ad().id, request);
      this.toast.show(this.i18n.t('adsManage.target.saved'));
      this.saved.emit(ad);
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.saving.set(false);
    }
  }
}
