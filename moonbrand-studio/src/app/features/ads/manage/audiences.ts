import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import type { AdAudienceCreateRequest } from '@moonbrand/shared/api/contract';
import type { AdAudience, AdAudienceType } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { Icon } from '../../../ui/icon';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';
import { count } from './format';

const CHUNK = 10_000;
const EMAIL = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

// I pubblici del brand su Google: liste di clienti (email), visitatori del sito e pubblici simili. Si usano nel pubblico
// delle campagne per raggiungerli o escluderli.
@Component({
  selector: 'mb-ad-audiences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, TranslatePipe],
  template: `
    <p class="caption">{{ 'adsManage.aud.explain' | t }}</p>
    @if (loading() && !list()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <div class="panel empty small">
        <p class="caption danger">{{ failed() }}</p>
        <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
      </div>
    } @else if (list(); as audiences) {
      @for (audience of audiences; track audience.id) {
        <article class="panel item">
          <div class="row">
            <div class="grow texts">
              <span class="strong-sm">{{ audience.name }}</span>
              <span class="caption">{{ typeLabel(audience.type) | t }} · {{ sizeLine(audience) }}{{ audience.status ? ' · ' + audience.status : '' }}</span>
            </div>
            <div class="actions">
              @if (audience.type === 'customer_list') {
                <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy()" (click)="openUpload(audience)">{{ 'adsManage.aud.addPeople' | t }}</button>
              }
              @if (audience.type !== 'lookalike') {
                <button class="icon-btn" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.aud.remove' | t" (click)="remove(audience)">
                  <mb-icon name="trash" [size]="15" />
                </button>
              }
            </div>
          </div>
          @if (uploadFor() === audience.id) {
            <div class="upload">
              <p class="caption">{{ 'adsManage.aud.privacy' | t }}</p>
              <div class="field">
                <label for="aud-emails">{{ 'adsManage.aud.emails' | t }}</label>
                <textarea id="aud-emails" rows="5" [value]="emails()" (input)="emails.set($any($event.target).value)" [placeholder]="'adsManage.aud.emailsPlaceholder' | t"></textarea>
                <span class="hint">{{ 'adsManage.aud.found' | t: { n: parsed().length } }}</span>
              </div>
              <div class="row">
                <label class="btn btn-ghost btn-sm file">
                  <mb-icon name="paperclip" [size]="14" /> {{ 'adsManage.aud.file' | t }}
                  <input class="file-input" type="file" accept=".csv,.txt,text/csv,text/plain" (change)="readFile($event)" />
                </label>
                <span class="grow"></span>
                <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="uploadFor.set(null)">{{ 'common.cancel' | t }}</button>
                <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() || !parsed().length" (click)="upload(audience)">
                  @if (busy()) {
                    <span class="spinner"></span>
                  }
                  {{ 'adsManage.aud.send' | t: { n: parsed().length } }}
                </button>
              </div>
            </div>
          }
        </article>
      } @empty {
        <div class="panel empty small">
          <p class="strong-sm">{{ 'adsManage.aud.none' | t }}</p>
        </div>
      }

      <section class="panel adder">
        <p class="label">{{ 'adsManage.aud.new' | t }}</p>
        <div class="segmented">
          @for (option of types; track option) {
            <button type="button" [class.selected]="type() === option" (click)="type.set(option)">{{ typeLabel(option) | t }}</button>
          }
        </div>
        <p class="caption">{{ typeHint() | t }}</p>
        <div class="field">
          <label for="aud-name">{{ 'adsManage.aud.name' | t }}</label>
          <input id="aud-name" maxlength="100" [value]="name()" (input)="name.set($any($event.target).value)" />
        </div>
        @switch (type()) {
          @case ('website') {
            <div class="pair">
              <div class="field">
                <label for="aud-days">{{ 'adsManage.aud.days' | t }}</label>
                <input id="aud-days" type="number" min="1" max="540" [value]="days()" (input)="days.set($any($event.target).value)" />
              </div>
              <div class="field">
                <label for="aud-url">{{ 'adsManage.aud.urlContains' | t }}</label>
                <input id="aud-url" type="text" placeholder="/" [value]="urlContains()" (input)="urlContains.set($any($event.target).value)" />
              </div>
            </div>
            <p class="caption">{{ 'adsManage.aud.tagNeeded' | t }}</p>
          }
          @case ('lookalike') {
            <div class="field">
              <label for="aud-source">{{ 'adsManage.aud.source' | t }}</label>
              <select id="aud-source" [value]="source()" (change)="source.set($any($event.target).value)">
                <option value="">—</option>
                @for (audience of sources(); track audience.id) {
                  <option [value]="audience.id">{{ audience.name }}</option>
                }
              </select>
            </div>
            <div class="segmented">
              @for (option of sizes; track option) {
                <button type="button" [class.selected]="size() === option" (click)="size.set(option)">{{ sizeLabel(option) | t }}</button>
              }
            </div>
          }
        }
        <button class="btn btn-primary btn-sm add" type="button" [disabled]="busy() || !ready()" (click)="create()">{{ 'adsManage.aud.create' | t }}</button>
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 40px 16px;
      text-align: center;
    }
    .empty.small {
      padding: 24px 12px;
    }
    .danger {
      color: var(--danger);
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .upload {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--grey-100);
    }
    .upload .field,
    .adder .field {
      background: var(--surface-sunken);
    }
    .file {
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .pair {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .add {
      align-self: flex-start;
    }
    @media (max-width: 640px) {
      .pair {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class AdAudiences {
  readonly brandId = input.required<string>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly types: AdAudienceType[] = ['customer_list', 'website', 'lookalike'];
  protected readonly sizes = ['narrow', 'balanced', 'broad'] as const;

  protected readonly list = signal<AdAudience[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly uploadFor = signal<string | null>(null);
  protected readonly emails = signal('');
  protected readonly type = signal<AdAudienceType>('customer_list');
  protected readonly name = signal('');
  protected readonly days = signal('30');
  protected readonly urlContains = signal('/');
  protected readonly source = signal('');
  protected readonly size = signal<'narrow' | 'balanced' | 'broad'>('balanced');

  protected readonly parsed = computed(() => [
    ...new Set(
      this.emails()
        .split(/[\s,;]+/)
        .map((part) => part.trim().replace(/^"|"$/g, '').toLowerCase())
        .filter((part) => EMAIL.test(part)),
    ),
  ]);
  protected readonly sources = computed(() => (this.list() ?? []).filter((audience) => audience.type !== 'lookalike'));
  protected readonly typeHint = computed<MessageKey>(() => `adsManage.aud.hints.${this.type()}` as MessageKey);

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      untracked(() => void this.load(brandId));
    });
  }

  protected reload(): void {
    void this.load(this.brandId());
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      this.list.set((await this.service.audiences(brandId)).audiences);
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.aud.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected typeLabel(type: string): MessageKey {
    return (this.types as string[]).includes(type) ? (`adsManage.aud.types.${type}` as MessageKey) : 'adsManage.aud.types.other';
  }

  protected sizeLabel(size: string): MessageKey {
    return `adsManage.aud.sizes.${size}` as MessageKey;
  }

  protected sizeLine(audience: AdAudience): string {
    return audience.size === null ? this.i18n.t('adsManage.aud.sizeUnknown') : this.i18n.t('adsManage.aud.size', { n: count(this.i18n.locale(), audience.size) });
  }

  protected openUpload(audience: AdAudience): void {
    this.emails.set('');
    this.uploadFor.set(audience.id);
  }

  protected async readFile(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      this.toast.show(this.i18n.t('adsManage.aud.fileTooLarge'));
      return;
    }
    const text = await file.text();
    this.emails.update((current) => (current.trim() ? `${current}\n${text}` : text));
  }

  protected async upload(audience: AdAudience): Promise<void> {
    const emails = this.parsed();
    if (!emails.length || this.busy()) return;
    this.busy.set(true);
    let received = 0;
    let invalid = 0;
    try {
      for (let i = 0; i < emails.length; i += CHUNK) {
        const result = await this.service.addAudienceUsers(this.brandId(), audience.id, emails.slice(i, i + CHUNK));
        received += result.received;
        invalid += result.invalid;
      }
      this.toast.show(this.i18n.t('adsManage.aud.sent', { n: received, invalid }));
      this.uploadFor.set(null);
      this.emails.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected ready(): boolean {
    if (!this.name().trim()) return false;
    if (this.type() === 'website') {
      const days = Number(this.days());
      return Number.isInteger(days) && days >= 1 && days <= 540;
    }
    if (this.type() === 'lookalike') return Boolean(this.source());
    return true;
  }

  protected async create(): Promise<void> {
    if (!this.ready() || this.busy()) return;
    const request: AdAudienceCreateRequest = { type: this.type(), name: this.name().trim() };
    if (this.type() === 'website') {
      request.retentionDays = Number(this.days());
      request.urlContains = this.urlContains().trim() || '/';
    }
    if (this.type() === 'lookalike') {
      request.sourceAudienceId = this.source();
      request.size = this.size();
    }
    this.busy.set(true);
    try {
      const audience = await this.service.createAudience(this.brandId(), request);
      this.list.update((list) => [audience, ...(list ?? [])]);
      this.name.set('');
      this.toast.show(this.i18n.t('adsManage.aud.created'));
      if (audience.type === 'customer_list') this.openUpload(audience);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(audience: AdAudience): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('adsManage.aud.removeConfirm', { name: audience.name }),
      message: this.i18n.t('adsManage.aud.removeMessage'),
      confirmLabel: this.i18n.t('adsManage.aud.remove'),
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;
    this.busy.set(true);
    try {
      await this.service.removeAudience(this.brandId(), audience.id);
      this.list.update((list) => (list ?? []).filter((item) => item.id !== audience.id));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
