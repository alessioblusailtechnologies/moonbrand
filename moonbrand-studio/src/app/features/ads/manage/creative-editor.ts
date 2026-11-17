import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import type { AdCreativeRequest } from '@moonbrand/shared/api/contract';
import { AD_IMAGES, AD_LIMITS, type Ad, type AdImageRole, type AdImages } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { ToastService } from '../../../ui/toast';
import { AdImagePicker } from './image-picker';

type ListKey = 'headlines' | 'descriptions' | 'longHeadlines';
const ROLES: AdImageRole[] = ['landscape', 'square', 'portrait', 'logo'];
export const CALLS_TO_ACTION = ['LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'CONTACT_US', 'BOOK_NOW', 'GET_QUOTE', 'DOWNLOAD', 'SUBSCRIBE'] as const;

interface Form {
  linkUrl: string;
  headlines: string[];
  headlinePins: (number | null)[];
  descriptions: string[];
  descriptionPins: (number | null)[];
  longHeadlines: string[];
  businessName: string;
  images: AdImages;
  youtube: string;
  callToAction: string;
}

// L'annuncio di una campagna già su Google: testi, link e, per i tipi con le immagini, immagini e video. Google lo
// rimette in revisione dopo una modifica.
@Component({
  selector: 'mb-ad-creative-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdImagePicker, Icon, TranslatePipe],
  template: `
    <p class="caption">{{ 'adsManage.creative.explain' | t }}</p>
    @if (form(); as f) {
      <div class="field">
        <label for="cr-link">{{ 'ads.form.link' | t }}</label>
        <input id="cr-link" type="url" placeholder="https://" [value]="f.linkUrl" (input)="set('linkUrl', $any($event.target).value)" />
      </div>
      @if (hasBusiness()) {
        <div class="field">
          <label for="cr-business">{{ 'adsManage.creative.businessName' | t }}</label>
          <input id="cr-business" [attr.maxlength]="limits.businessName" [value]="f.businessName" (input)="set('businessName', $any($event.target).value)" />
        </div>
      }
      @for (list of lists(); track list.key) {
        <div class="field">
          <label>{{ list.label | t }}</label>
          <span class="hint">{{ 'adsManage.creative.listHint' | t: { min: list.min, max: list.max, chars: list.chars } }}</span>
          @for (text of f[list.key]; track $index) {
            <div class="field-row item">
              <input [attr.maxlength]="list.chars" [attr.aria-label]="list.label | t" [value]="text" (input)="setItem(list.key, $index, $any($event.target).value)" />
              <span class="count" [class.full]="text.length >= list.chars">{{ text.length }}/{{ list.chars }}</span>
              @if (list.pins) {
                <select class="pin" [attr.aria-label]="'adsManage.creative.pin' | t" [value]="pinOf(list.key, $index)" (change)="setPin(list.key, $index, $any($event.target).value)">
                  <option value="">{{ 'adsManage.creative.noPin' | t }}</option>
                  @for (n of list.pins; track n) {
                    <option [value]="n">{{ 'adsManage.creative.pinAt' | t: { n } }}</option>
                  }
                </select>
              }
              <button class="icon-btn" type="button" [disabled]="f[list.key].length <= list.min" [attr.aria-label]="'ads.form.removeItem' | t" (click)="removeItem(list.key, $index)">
                <mb-icon name="x" [size]="15" />
              </button>
            </div>
          }
          @if (f[list.key].length < list.max) {
            <button class="link-btn add" type="button" (click)="addItem(list.key)"><mb-icon name="plus" [size]="14" /> {{ 'adsManage.creative.addLine' | t }}</button>
          }
        </div>
      }
      @if (ad().campaignType === 'search') {
        <p class="caption">{{ 'adsManage.creative.pinHint' | t }}</p>
      }

      @for (role of roles(); track role) {
        <mb-ad-image-picker [brandId]="brandId()" [role]="role" [selected]="f.images[role]" [max]="imageMax(role)" (changed)="setImages(role, $event)" />
      }

      @if (hasVideo()) {
        <div class="field">
          <label for="cr-youtube">{{ 'adsManage.creative.youtube' | t }}</label>
          <textarea id="cr-youtube" rows="2" [value]="f.youtube" (input)="set('youtube', $any($event.target).value)" placeholder="https://youtu.be/…"></textarea>
          <span class="hint">{{ 'adsManage.creative.youtubeHint' | t: { max: limits.youtube.max } }}</span>
        </div>
      }
      @if (ad().campaignType === 'demand_gen') {
        <div class="field">
          <label for="cr-cta">{{ 'adsManage.creative.cta' | t }}</label>
          <select id="cr-cta" [value]="f.callToAction" (change)="set('callToAction', $any($event.target).value)">
            <option value="">{{ 'adsManage.creative.ctaAuto' | t }}</option>
            @for (cta of ctas; track cta) {
              <option [value]="cta">{{ ctaLabel(cta) | t }}</option>
            }
          </select>
        </div>
      }
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
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .item {
      gap: 8px;
      padding-top: 10px;
      border-top: 1px solid var(--grey-100);
    }
    .item input {
      flex: 1;
      min-width: 0;
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
      font-size: 12px !important;
      color: var(--text-body) !important;
    }
    .add {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 4px;
    }
    .danger {
      color: var(--danger);
    }
    .row.end {
      justify-content: flex-end;
    }
  `,
})
export class AdCreativeEditor implements OnInit {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();
  readonly saved = output<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly limits = AD_LIMITS;
  protected readonly ctas = CALLS_TO_ACTION;

  protected readonly form = signal<Form | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly hasBusiness = computed(() => this.ad().campaignType !== 'search');
  protected readonly hasVideo = computed(() => this.ad().campaignType === 'pmax' || this.ad().campaignType === 'demand_gen');
  protected readonly roles = computed(() => ROLES.filter((role) => AD_IMAGES[this.ad().campaignType][role]));
  protected readonly lists = computed(() => {
    const type = this.ad().campaignType;
    const limits = AD_LIMITS[type];
    const rows: { key: ListKey; label: MessageKey; min: number; max: number; chars: number; pins: number[] | null }[] = [
      { key: 'headlines', label: 'ads.form.headlines', ...limits.headlines, pins: type === 'search' ? [1, 2, 3] : null },
    ];
    if ('longHeadlines' in limits) rows.push({ key: 'longHeadlines', label: 'adsManage.creative.longHeadlines', ...limits.longHeadlines, pins: null });
    rows.push({ key: 'descriptions', label: 'ads.form.descriptions', ...limits.descriptions, pins: type === 'search' ? [1, 2] : null });
    return rows;
  });

  ngOnInit(): void {
    const { spec } = this.ad();
    const images = spec.images ?? { landscape: [], square: [], portrait: [], logo: [] };
    this.form.set({
      linkUrl: spec.linkUrl,
      headlines: [...spec.headlines],
      headlinePins: spec.headlines.map((_, i) => spec.headlinePins?.[i] ?? null),
      descriptions: [...spec.descriptions],
      descriptionPins: spec.descriptions.map((_, i) => spec.descriptionPins?.[i] ?? null),
      longHeadlines: [...(spec.longHeadlines ?? [])],
      businessName: spec.businessName ?? '',
      images: { landscape: [...images.landscape], square: [...images.square], portrait: [...images.portrait], logo: [...images.logo] },
      youtube: (spec.youtubeVideoIds ?? []).join('\n'),
      callToAction: spec.callToAction ?? '',
    });
  }

  protected set<K extends keyof Form>(key: K, value: Form[K]): void {
    this.form.update((f) => (f ? { ...f, [key]: value } : f));
  }

  protected setItem(key: ListKey, index: number, value: string): void {
    this.form.update((f) => (f ? { ...f, [key]: f[key].map((item, i) => (i === index ? value : item)) } : f));
  }

  private pinsKey(key: ListKey): 'headlinePins' | 'descriptionPins' | null {
    return key === 'headlines' ? 'headlinePins' : key === 'descriptions' ? 'descriptionPins' : null;
  }

  protected addItem(key: ListKey): void {
    const pins = this.pinsKey(key);
    this.form.update((f) => (f ? { ...f, [key]: [...f[key], ''], ...(pins && { [pins]: [...f[pins], null] }) } : f));
  }

  protected removeItem(key: ListKey, index: number): void {
    const pins = this.pinsKey(key);
    this.form.update((f) =>
      f ? { ...f, [key]: f[key].filter((_, i) => i !== index), ...(pins && { [pins]: f[pins].filter((_, i) => i !== index) }) } : f,
    );
  }

  protected pinOf(key: ListKey, index: number): string {
    const pins = this.pinsKey(key);
    const value = pins ? this.form()?.[pins][index] : null;
    return value ? String(value) : '';
  }

  protected setPin(key: ListKey, index: number, value: string): void {
    const pins = this.pinsKey(key);
    if (!pins) return;
    this.form.update((f) => (f ? { ...f, [pins]: f[pins].map((pin, i) => (i === index ? (value ? Number(value) : null) : pin)) } : f));
  }

  protected imageMax(role: AdImageRole): number {
    return AD_IMAGES[this.ad().campaignType][role]?.max ?? 1;
  }

  protected setImages(role: AdImageRole, files: string[]): void {
    this.form.update((f) => (f ? { ...f, images: { ...f.images, [role]: files } } : f));
  }

  protected ctaLabel(cta: string): MessageKey {
    return `adsManage.cta.${cta}` as MessageKey;
  }

  // Un link di YouTube o l'id da 11 caratteri.
  private youtubeIds(text: string): string[] {
    const ids = text
      .split(/\s|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => /(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{11})/.exec(part)?.[1] ?? (/^[\w-]{11}$/.test(part) ? part : ''))
      .filter(Boolean);
    return [...new Set(ids)].slice(0, AD_LIMITS.youtube.max);
  }

  private request(f: Form): AdCreativeRequest | string {
    const type = this.ad().campaignType;
    const filled = (items: string[], pins?: (number | null)[]) => {
      const kept = items.map((text, i) => ({ text: text.trim(), pin: pins?.[i] ?? null })).filter((item) => item.text);
      return { texts: kept.map((item) => item.text), pins: kept.map((item) => item.pin) };
    };
    const headlines = filled(f.headlines, f.headlinePins);
    const descriptions = filled(f.descriptions, f.descriptionPins);
    const long = filled(f.longHeadlines);
    for (const list of this.lists()) {
      const n = list.key === 'headlines' ? headlines.texts.length : list.key === 'descriptions' ? descriptions.texts.length : long.texts.length;
      if (n < list.min) return this.i18n.t('adsManage.creative.tooFew', { what: this.i18n.t(list.label), min: list.min });
    }
    if (!/^https?:\/\/\S+$/i.test(f.linkUrl.trim())) return this.i18n.t('adsManage.creative.badLink');
    for (const role of this.roles()) {
      const min = AD_IMAGES[type][role]?.min ?? 0;
      if (f.images[role].length < min) return this.i18n.t('adsManage.creative.needImage', { what: this.i18n.t(`adsManage.images.${role}` as MessageKey) });
    }
    const request: AdCreativeRequest = { linkUrl: f.linkUrl.trim(), headlines: headlines.texts, descriptions: descriptions.texts };
    if (type === 'search') {
      request.headlinePins = headlines.pins;
      request.descriptionPins = descriptions.pins;
    } else {
      request.longHeadlines = long.texts;
      request.businessName = f.businessName.trim();
      request.images = f.images;
    }
    if (this.hasVideo()) request.youtubeVideoIds = this.youtubeIds(f.youtube);
    if (type === 'demand_gen') request.callToAction = f.callToAction || null;
    return request;
  }

  protected async save(): Promise<void> {
    const f = this.form();
    if (!f || this.saving()) return;
    const request = this.request(f);
    if (typeof request === 'string') {
      this.error.set(request);
      return;
    }
    this.error.set(null);
    this.saving.set(true);
    try {
      const ad = await this.service.creative(this.brandId(), this.ad().id, request);
      this.toast.show(this.i18n.t('adsManage.creative.saved'));
      this.saved.emit(ad);
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.saving.set(false);
    }
  }
}
