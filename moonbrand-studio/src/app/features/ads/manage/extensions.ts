import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import type { AdExtensionsAddRequest, AdExtensionsResponse } from '@moonbrand/shared/api/contract';
import { AD_LIMITS, SNIPPET_HEADERS, type Ad, type AdSnippet } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { Icon } from '../../../ui/icon';
import { Loader } from '../../../ui/loader';
import { Select } from '../../../ui/select';
import { ToastService } from '../../../ui/toast';

const L = AD_LIMITS;
type Kind = 'sitelink' | 'callout' | 'snippet';

// Le estensioni della campagna su Google: link ad altre pagine del sito, frasi brevi e snippet strutturati. Si aggiungono e
// si tolgono; Google le mostra quando pensa che aiutino.
@Component({
  selector: 'mb-ad-extensions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, Select, TranslatePipe],
  template: `
    <p class="caption">{{ 'adsManage.ext.explain' | t }}</p>
    @if (loading() && !data()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <p class="caption danger">{{ failed() }}</p>
    } @else if (data(); as current) {
      <section class="stack">
        <p class="label">{{ 'adsManage.ext.sitelinks' | t }}</p>
        <p class="caption">{{ 'adsManage.ext.sitelinksHint' | t }}</p>
        @for (link of current.extensions.sitelinks; track link.resource) {
          <div class="panel item">
            <div class="grow texts">
              <span class="strong-sm">{{ link.text }}</span>
              <span class="caption">{{ link.linkUrl }}</span>
              @if (link.description1 || link.description2) {
                <span class="caption">{{ link.description1 }} {{ link.description2 }}</span>
              }
            </div>
            <button class="icon-btn" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.ext.remove' | t" (click)="remove(link.resource, link.text)">
              <mb-icon name="trash" [size]="14" />
            </button>
          </div>
        } @empty {
          <span class="caption">{{ 'adsManage.ext.none' | t }}</span>
        }
      </section>

      <section class="stack">
        <p class="label">{{ 'adsManage.ext.callouts' | t }}</p>
        <p class="caption">{{ 'adsManage.ext.calloutsHint' | t }}</p>
        <div class="chips">
          @for (callout of current.extensions.callouts; track callout.resource) {
            <span class="chip static">
              {{ callout.text }}
              <button class="icon-btn mini" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.ext.remove' | t" (click)="remove(callout.resource, callout.text)">
                <mb-icon name="x" [size]="12" />
              </button>
            </span>
          } @empty {
            <span class="caption">{{ 'adsManage.ext.none' | t }}</span>
          }
        </div>
      </section>

      <section class="stack">
        <p class="label">{{ 'adsManage.ext.snippets' | t }}</p>
        <p class="caption">{{ 'adsManage.ext.snippetsHint' | t }}</p>
        @for (snippet of current.extensions.snippets; track snippet.resource) {
          <div class="panel item">
            <div class="grow texts">
              <span class="strong-sm">{{ headerLabel(snippet.header) }}</span>
              <span class="caption">{{ snippet.values.join(', ') }}</span>
            </div>
            <button class="icon-btn" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.ext.remove' | t" (click)="remove(snippet.resource, snippet.header)">
              <mb-icon name="trash" [size]="14" />
            </button>
          </div>
        } @empty {
          <span class="caption">{{ 'adsManage.ext.none' | t }}</span>
        }
      </section>

      <section class="panel adder">
        <p class="label">{{ 'adsManage.ext.add' | t }}</p>
        <div class="segmented">
          @for (option of kinds; track option.value) {
            <button type="button" [class.selected]="kind() === option.value" (click)="kind.set(option.value)">{{ option.label | t }}</button>
          }
        </div>
        @switch (kind()) {
          @case ('sitelink') {
            <div class="pair">
              <div class="field">
                <label for="sl-text">{{ 'adsManage.ext.linkText' | t }}</label>
                <input id="sl-text" [attr.maxlength]="limits.sitelinks.text" [value]="sitelink().text" (input)="setSitelink('text', $any($event.target).value)" />
              </div>
              <div class="field">
                <label for="sl-url">{{ 'adsManage.ext.linkUrl' | t }}</label>
                <input id="sl-url" type="url" placeholder="https://" [value]="sitelink().linkUrl" (input)="setSitelink('linkUrl', $any($event.target).value)" />
              </div>
              <div class="field">
                <label for="sl-d1">{{ 'adsManage.ext.line1' | t }}</label>
                <input id="sl-d1" [attr.maxlength]="limits.sitelinks.description" [value]="sitelink().description1" (input)="setSitelink('description1', $any($event.target).value)" />
              </div>
              <div class="field">
                <label for="sl-d2">{{ 'adsManage.ext.line2' | t }}</label>
                <input id="sl-d2" [attr.maxlength]="limits.sitelinks.description" [value]="sitelink().description2" (input)="setSitelink('description2', $any($event.target).value)" />
              </div>
            </div>
            <span class="caption">{{ 'adsManage.ext.linesHint' | t }}</span>
          }
          @case ('callout') {
            <div class="field">
              <label for="co-text">{{ 'adsManage.ext.calloutText' | t }}</label>
              <textarea id="co-text" rows="3" [value]="callouts()" (input)="callouts.set($any($event.target).value)" [placeholder]="'adsManage.ext.calloutPlaceholder' | t"></textarea>
              <span class="hint">{{ 'adsManage.ext.calloutRule' | t: { chars: limits.callouts.chars } }}</span>
            </div>
          }
          @case ('snippet') {
            <mb-select [options]="headerOptions()" [value]="snippetHeader()" [label]="'adsManage.ext.header' | t" (changed)="snippetHeader.set($any($event))" />
            <div class="field">
              <label for="sn-values">{{ 'adsManage.ext.values' | t }}</label>
              <textarea id="sn-values" rows="3" [value]="snippetValues()" (input)="snippetValues.set($any($event.target).value)"></textarea>
              <span class="hint">{{ 'adsManage.ext.valuesRule' | t: { min: limits.snippetValues.min, max: limits.snippetValues.max, chars: limits.snippetValues.chars } }}</span>
            </div>
          }
        }
        <button class="btn btn-primary btn-sm add" type="button" [disabled]="busy() || !ready()" (click)="add()">{{ 'adsManage.ext.addButton' | t }}</button>
      </section>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .empty {
      display: grid;
      place-items: center;
      padding: 40px 0;
    }
    .danger {
      color: var(--danger);
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .item {
      flex-direction: row;
      align-items: center;
      padding: 12px 16px;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .chip.static {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: default;
    }
    .mini {
      width: 22px;
      height: 22px;
    }
    .adder {
      background: var(--surface-sunken);
    }
    .adder .field {
      background: var(--white);
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
export class AdExtensionsEditor {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly limits = L;
  protected readonly kinds: { value: Kind; label: MessageKey }[] = [
    { value: 'sitelink', label: 'adsManage.ext.sitelink' },
    { value: 'callout', label: 'adsManage.ext.callout' },
    { value: 'snippet', label: 'adsManage.ext.snippet' },
  ];

  protected readonly data = signal<AdExtensionsResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly kind = signal<Kind>('sitelink');
  protected readonly sitelink = signal({ text: '', linkUrl: '', description1: '', description2: '' });
  protected readonly callouts = signal('');
  protected readonly snippetHeader = signal<AdSnippet['header']>('Service catalog');
  protected readonly snippetValues = signal('');

  protected readonly headerOptions = () =>
    SNIPPET_HEADERS.map((header) => ({ value: header, label: this.headerLabel(header) }));

  constructor() {
    effect(() => {
      const brandId = this.brandId();
      const adId = this.ad().id;
      untracked(() => void this.load(brandId, adId));
    });
  }

  private async load(brandId: string, adId: string): Promise<void> {
    this.loading.set(true);
    this.failed.set(null);
    try {
      this.data.set(await this.service.extensions(brandId, adId));
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.ext.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected headerLabel(header: string): string {
    const key = `adsManage.snippetHeaders.${header.replace(/\s+/g, '_')}` as MessageKey;
    const text = this.i18n.t(key);
    return text === key ? header : text;
  }

  protected setSitelink(key: 'text' | 'linkUrl' | 'description1' | 'description2', value: string): void {
    this.sitelink.update((link) => ({ ...link, [key]: value }));
  }

  private lines(text: string, chars: number): string[] {
    return [...new Set(text.split(/\n|,/).map((line) => line.trim().slice(0, chars)).filter(Boolean))];
  }

  private request(): AdExtensionsAddRequest | null {
    switch (this.kind()) {
      case 'sitelink': {
        const link = this.sitelink();
        if (!link.text.trim() || !/^https?:\/\/\S+$/i.test(link.linkUrl.trim())) return null;
        const d1 = link.description1.trim();
        const d2 = link.description2.trim();
        return {
          sitelinks: [{ text: link.text.trim(), linkUrl: link.linkUrl.trim(), ...(d1 && d2 && { description1: d1, description2: d2 }) }],
        };
      }
      case 'callout': {
        const callouts = this.lines(this.callouts(), L.callouts.chars);
        return callouts.length ? { callouts } : null;
      }
      case 'snippet': {
        const values = this.lines(this.snippetValues(), L.snippetValues.chars).slice(0, L.snippetValues.max);
        return values.length >= L.snippetValues.min ? { snippets: [{ header: this.snippetHeader(), values }] } : null;
      }
    }
  }

  protected ready(): boolean {
    return this.request() !== null;
  }

  protected async add(): Promise<void> {
    const request = this.request();
    if (!request || this.busy()) return;
    this.busy.set(true);
    try {
      this.data.set(await this.service.addExtensions(this.brandId(), this.ad().id, request));
      this.toast.show(this.i18n.t('adsManage.ext.added'));
      this.sitelink.set({ text: '', linkUrl: '', description1: '', description2: '' });
      this.callouts.set('');
      this.snippetValues.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(resource: string, name: string): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('adsManage.ext.removeConfirm', { name }),
      confirmLabel: this.i18n.t('adsManage.ext.remove'),
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;
    this.busy.set(true);
    try {
      this.data.set(await this.service.removeExtensions(this.brandId(), this.ad().id, [resource]));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
