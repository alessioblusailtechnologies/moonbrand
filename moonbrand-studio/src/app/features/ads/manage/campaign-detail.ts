import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal, type OnInit } from '@angular/core';

import type { Ad } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { lockPageScroll } from '../../../ui/scroll-lock';
import { AdCreativeEditor } from './creative-editor';
import { AdExtensionsEditor } from './extensions';
import { TYPE_KEYS } from './format';
import { AdKeywords } from './keywords';
import { AdPerformance } from './performance';
import { AdSearchTerms } from './search-terms';
import { AdSettingsEditor } from './settings-editor';
import { AdTargetingEditor } from './targeting-editor';

type Tab = 'performance' | 'creative' | 'targeting' | 'keywords' | 'terms' | 'extensions' | 'settings';

const TABS: { key: Tab; label: MessageKey; only?: Ad['campaignType'][] }[] = [
  { key: 'performance', label: 'adsManage.tabs.performance' },
  { key: 'creative', label: 'adsManage.tabs.creative' },
  { key: 'targeting', label: 'adsManage.tabs.targeting' },
  { key: 'keywords', label: 'adsManage.tabs.keywords', only: ['search'] },
  { key: 'terms', label: 'adsManage.tabs.terms', only: ['search'] },
  { key: 'extensions', label: 'adsManage.tabs.extensions', only: ['search', 'display'] },
  { key: 'settings', label: 'adsManage.tabs.settings' },
];

// Una campagna già su Google, in una modale a schede: andamento, annuncio, pubblico, parole chiave, termini di ricerca,
// estensioni e impostazioni. Ogni scheda salva da sé; la pagina rilegge l'elenco alla chiusura.
@Component({
  selector: 'mb-ad-campaign-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdCreativeEditor, AdExtensionsEditor, AdKeywords, AdPerformance, AdSearchTerms, AdSettingsEditor, AdTargetingEditor, Icon, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    <div class="scrim" (click)="close()"></div>
    <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="current().name">
      <header class="bar">
        <div class="texts grow">
          <span class="name">
            <span class="strong">{{ current().name }}</span>
            <span class="badge">{{ typeLabel() | t }}</span>
          </span>
          <span class="caption">{{ statusLine() }}</span>
        </div>
        <button class="icon-btn" type="button" [attr.aria-label]="'common.close' | t" (click)="close()"><mb-icon name="x" /></button>
      </header>
      <nav class="tabs" role="tablist">
        @for (item of tabs(); track item.key) {
          <button type="button" role="tab" class="tab" [class.on]="tab() === item.key" [attr.aria-selected]="tab() === item.key" (click)="tab.set(item.key)">
            {{ item.label | t }}
          </button>
        }
      </nav>
      <main class="page">
        <div class="inner">
          @switch (tab()) {
            @case ('performance') {
              <mb-ad-performance [brandId]="brandId()" [ad]="current()" />
            }
            @case ('creative') {
              <mb-ad-creative-editor [brandId]="brandId()" [ad]="current()" (saved)="update($event)" />
            }
            @case ('targeting') {
              <mb-ad-targeting-editor [brandId]="brandId()" [ad]="current()" (saved)="update($event)" />
            }
            @case ('keywords') {
              <mb-ad-keywords [brandId]="brandId()" [ad]="current()" />
            }
            @case ('terms') {
              <mb-ad-search-terms [brandId]="brandId()" [ad]="current()" />
            }
            @case ('extensions') {
              <mb-ad-extensions [brandId]="brandId()" [ad]="current()" />
            }
            @case ('settings') {
              <mb-ad-settings-editor [brandId]="brandId()" [ad]="current()" (saved)="update($event)" />
            }
          }
        </div>
      </main>
    </div>
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 60;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .scrim {
      position: absolute;
      inset: 0;
      background: var(--scrim);
      animation: fade-in 200ms var(--ease);
    }
    .dialog {
      position: relative;
      display: flex;
      flex-direction: column;
      width: min(880px, 100%);
      height: min(900px, 100%);
      overflow: hidden;
      border-radius: var(--radius-card);
      background: var(--surface-dialog);
      box-shadow: var(--shadow-menu);
      animation: fade-up 240ms var(--ease);
    }
    .bar {
      flex: none;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 18px 20px 10px 24px;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .tabs {
      flex: none;
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 0 20px;
      border-bottom: 1px solid rgba(20, 33, 61, 0.08);
      scrollbar-width: none;
    }
    .tab {
      flex: none;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-body);
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .tab.on {
      border-bottom-color: var(--primary);
      color: var(--text-title);
    }
    .page {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px 28px;
    }
    .inner {
      width: min(760px, 100%);
      margin: 0 auto;
    }
    @media (max-width: 640px) {
      :host {
        padding: 0;
      }
      .dialog {
        width: 100%;
        height: 100%;
        border-radius: 0;
      }
      .page {
        padding: 16px;
      }
    }
  `,
})
export class AdCampaignDetail implements OnInit {
  readonly brandId = input.required<string>();
  readonly ad = input.required<Ad>();
  readonly closed = output<void>();
  // Qualcosa è cambiato: la pagina rilegge alla chiusura.
  readonly changed = output<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly current = signal<Ad>(null as unknown as Ad);
  protected readonly tab = signal<Tab>('performance');
  protected readonly tabs = computed(() => TABS.filter((item) => !item.only || item.only.includes(this.current().campaignType)));
  protected readonly typeLabel = computed(() => TYPE_KEYS[this.current().campaignType]);
  protected readonly statusLine = computed(() => {
    const ad = this.current();
    const status = this.i18n.t(ad.status === 'scheduled' ? 'adsManage.status.scheduled' : (`ads.status.${ad.status}` as MessageKey));
    return ad.rejectionReason ? `${status} · ${ad.rejectionReason}` : status;
  });

  constructor() {
    lockPageScroll();
  }

  ngOnInit(): void {
    this.current.set(this.ad());
  }

  protected update(ad: Ad): void {
    this.current.set(ad);
    this.changed.emit();
  }

  protected close(): void {
    this.closed.emit();
  }
}
