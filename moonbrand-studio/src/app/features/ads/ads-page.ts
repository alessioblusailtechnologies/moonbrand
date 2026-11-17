import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { AdsResponse } from '@moonbrand/shared/api/contract';
import { maxSpend, type Ad, type AdAccount, type AdDraft, type AdStatus } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsService } from '../../core/ads/ads.service';
import { BrandsService } from '../../core/brands/brands.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { CHANNEL_ICONS } from '../../ui/channel-icons';
import { ToastService } from '../../ui/toast';
import { AdWizard } from './ad-wizard';
import { AdAccountInfo } from './manage/account';
import { AdAudiences } from './manage/audiences';
import { AdCampaignDetail } from './manage/campaign-detail';
import { AdConversions } from './manage/conversions';
import { TYPE_KEYS } from './manage/format';
import { AdRecommendations } from './manage/recommendations';

// I loghi delle piattaforme (Simple Icons, CC0), su 24×24. color null: quello del testo, per il tema scuro.
const LOGOS: Record<'google' | 'meta' | 'linkedin' | 'openai', { path: string; color: string | null }> = {
  google: { color: '#4285F4', path: 'M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998zm19.4643-6.0004L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644zM7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z' },
  meta: { color: '#0866FF', path: 'M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z' },
  linkedin: CHANNEL_ICONS.linkedin,
  openai: { color: null, path: 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z' },
};

const ACTIVE: AdStatus[] = ['scheduled', 'in_review', 'active'];

// Le sezioni sotto il collegamento: le campagne e gli strumenti dell'account Google Ads.
type Section = 'campaigns' | 'audiences' | 'conversions' | 'recommendations' | 'account';
const SECTIONS: { key: Section; label: MessageKey }[] = [
  { key: 'campaigns', label: 'adsManage.sections.campaigns' },
  { key: 'audiences', label: 'adsManage.sections.audiences' },
  { key: 'conversions', label: 'adsManage.sections.conversions' },
  { key: 'recommendations', label: 'adsManage.sections.recommendations' },
  { key: 'account', label: 'adsManage.sections.account' },
];

// Campagne: le campagne Google del brand sulla rete di ricerca. Si collega Google Ads, si scrive la campagna e la si
// avvia; la spesa la addebita Google sull'account del cliente. Niente chat: tutto qui.
@Component({
  selector: 'mb-ads-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdAccountInfo, AdAudiences, AdCampaignDetail, AdConversions, AdRecommendations, AdWizard, Icon, Loader, TranslatePipe],
  template: `
    <section class="ads">
      <header class="texts">
        <h1 class="title">{{ 'ads.title' | t }}</h1>
        <p class="caption">{{ 'ads.intro' | t }}</p>
      </header>

      @if (loading() && !data()) {
        <div class="empty"><mb-loader /></div>
      } @else if (data(); as current) {
        <div class="platforms">
          <section class="panel tile">
            <div class="tile-head">
              <span class="mark" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path [attr.d]="logos.google.path" [attr.fill]="logos.google.color" /></svg>
              </span>
              @if (current.connection; as connection) {
                <span class="badge" [class.mint]="!connection.lost && connection.adAccountId" [class.warn]="connection.lost">
                  {{ (connection.lost ? 'ads.tileLost' : connection.adAccountId ? 'ads.tileOn' : 'ads.tileChoose') | t }}
                </span>
              }
            </div>
            <div class="texts">
              <span class="strong-sm">{{ 'ads.google' | t }}</span>
              @if (current.connection; as connection) {
                @if (connection.lost) {
                  <span class="caption danger">{{ 'ads.lost' | t }}</span>
                } @else if (connection.adAccountId) {
                  <span class="caption">{{ 'ads.account' | t: { name: connection.adAccountName ?? connection.adAccountId, currency: connection.currency ?? '—' } }}</span>
                } @else {
                  <span class="caption">{{ 'ads.chooseAccountHint' | t }}</span>
                }
                @if (connection.simulated) {
                  <span class="caption">{{ 'ads.simulated' | t }}</span>
                }
              } @else {
                <span class="caption">{{ 'ads.connectHint' | t }}</span>
              }
            </div>
            <div class="tile-actions">
              @if (!current.connection || current.connection.lost) {
                <button class="btn btn-primary btn-sm" type="button" [disabled]="busy()" (click)="connect()">{{ 'ads.connectShort' | t }}</button>
                @if (current.simulation) {
                  <button class="link-btn" type="button" [disabled]="busy()" (click)="simulate()">{{ 'ads.simulate' | t }}</button>
                }
              } @else {
                @if (current.connection.adAccountId && !accounts()) {
                  <button class="link-btn" type="button" [disabled]="busy()" (click)="loadAccounts()">{{ 'ads.changeAccount' | t }}</button>
                }
                <button class="link-btn" type="button" [disabled]="busy()" (click)="disconnect()">{{ 'ads.disconnect' | t }}</button>
              }
            </div>
          </section>
          @for (platform of upcoming; track platform.key) {
            <section class="panel tile off" aria-disabled="true">
              <div class="tile-head">
                <span class="mark" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path [attr.d]="logos[platform.key].path" [attr.fill]="logos[platform.key].color ?? 'currentColor'" /></svg>
                </span>
                <span class="badge">{{ 'ads.soon' | t }}</span>
              </div>
              <div class="texts">
                <span class="strong-sm">{{ platform.name }}</span>
                <span class="caption">{{ platform.hint | t }}</span>
              </div>
              <div class="tile-actions">
                <button class="btn btn-secondary btn-sm" type="button" disabled>{{ 'ads.connectShort' | t }}</button>
              </div>
            </section>
          }
        </div>

        @if (accounts(); as list) {
          <section class="panel accounts">
            <p class="label">{{ 'ads.chooseAccount' | t }}</p>
            @for (account of list; track account.id) {
              <button class="option-card" type="button" role="radio" [attr.aria-checked]="current.connection?.adAccountId === account.id"
                [class.selected]="current.connection?.adAccountId === account.id" [disabled]="busy() || !usable(account)" (click)="choose(account)">
                <span class="grow">
                  <span class="strong-sm">{{ account.name }}</span>
                  <span class="caption">{{ account.id }} · {{ account.currency ?? '—' }}{{ usable(account) ? '' : ' · ' + ('ads.accountClosed' | t) }}</span>
                </span>
                <span class="radio-mark" [class.on]="current.connection?.adAccountId === account.id"></span>
              </button>
            } @empty {
              <p class="caption">{{ 'ads.noAccounts' | t }}</p>
            }
          </section>
        }

        @if (wizard(); as w) {
          <mb-ad-wizard [brandId]="w.brandId" [data]="current" [ad]="w.ad" (closed)="wizard.set(null)" (saved)="reload()" />
        }
        @if (detail(); as d) {
          <mb-ad-campaign-detail [brandId]="d.brandId" [ad]="d.ad" (changed)="detailChanged.set(true)" (closed)="closeDetail()" />
        }

        @if (canLaunch()) {
          <nav class="sections" role="tablist">
            @for (item of sections; track item.key) {
              <button type="button" role="tab" class="section-tab" [class.on]="section() === item.key" [attr.aria-selected]="section() === item.key"
                (click)="section.set(item.key)">{{ item.label | t }}</button>
            }
          </nav>
        }

        @switch (canLaunch() ? section() : 'campaigns') {
          @case ('audiences') {
            <mb-ad-audiences [brandId]="brandIdValue()" />
          }
          @case ('conversions') {
            <mb-ad-conversions [brandId]="brandIdValue()" />
          }
          @case ('recommendations') {
            <mb-ad-recommendations [brandId]="brandIdValue()" [ads]="current.ads" (applied)="reload()" />
          }
          @case ('account') {
            <mb-ad-account [brandId]="brandIdValue()" />
          }
          @default {

        <section class="campaigns">
          <div class="row">
            <h2 class="grow subtitle">{{ 'ads.campaigns' | t }}</h2>
            <button class="btn btn-primary btn-sm" type="button" (click)="open(null)"><mb-icon name="plus" [size]="14" /> {{ 'ads.newCampaign' | t }}</button>
          </div>
          @for (ad of current.ads; track ad.id) {
            <article class="panel campaign">
              <div class="row">
                <div class="grow texts">
                  <span class="name">
                    <span class="strong-sm">{{ ad.name }}</span>
                    <span class="badge">{{ typeLabel(ad) | t }}</span>
                    <span class="badge" [class.mint]="ad.status === 'active'" [class.warn]="ad.status === 'rejected' || ad.status === 'failed'">{{ statusLabel(ad.status) }}</span>
                  </span>
                  <span class="caption">{{ adLine(ad) }}</span>
                </div>
                <div class="actions">
                  @if (ad.status === 'draft' || ad.status === 'failed') {
                    <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="open(ad)">{{ 'ads.edit' | t }}</button>
                    <button class="btn btn-primary btn-sm" type="button" [disabled]="busy() || !canLaunch()" (click)="launch(ad)">{{ 'ads.launch' | t }}</button>
                  }
                  @if (manageable(ad)) {
                    <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="openDetail(ad)">{{ 'adsManage.manage' | t }}</button>
                  }
                  @if (active(ad)) {
                    <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy()" (click)="pause(ad)">{{ 'ads.pause' | t }}</button>
                  }
                  @if (ad.status === 'paused') {
                    <button class="btn btn-secondary btn-sm" type="button" [disabled]="busy()" (click)="resume(ad)">{{ 'ads.resume' | t }}</button>
                  }
                  @if (ad.status !== 'deleted') {
                    <button class="icon-btn" type="button" [attr.aria-label]="'ads.remove' | t" [title]="'ads.remove' | t" [disabled]="busy()" (click)="remove(ad)">
                      <mb-icon name="trash" [size]="15" />
                    </button>
                  }
                </div>
              </div>
              @if (ad.error) {
                <p class="caption danger">{{ ad.error }}</p>
              }
              @if (ad.rejectionReason) {
                <p class="caption danger">{{ ad.rejectionReason }}</p>
              }
              @if (ad.status !== 'draft' && ad.status !== 'failed') {
                @if (ad.metrics; as m) {
                  <div class="metrics">
                    <div><span class="caption">{{ 'ads.spend' | t }}</span><span class="strong-sm">{{ money(m.spend, ad.currency) }}</span></div>
                    <div><span class="caption">{{ 'ads.impressions' | t }}</span><span class="strong-sm">{{ number(m.impressions) }}</span></div>
                    <div><span class="caption">{{ 'ads.clicks' | t }}</span><span class="strong-sm">{{ number(m.clicks) }}</span></div>
                    <div><span class="caption">{{ 'ads.ctr' | t }}</span><span class="strong-sm">{{ percent(m.ctr) }}</span></div>
                    <div><span class="caption">{{ 'ads.cpc' | t }}</span><span class="strong-sm">{{ money(m.cpc, ad.currency) }}</span></div>
                  </div>
                } @else {
                  <p class="caption">{{ 'ads.noMetrics' | t }}</p>
                }
              }
            </article>
          } @empty {
            <div class="panel empty small">
              <p class="strong-sm">{{ 'ads.none' | t }}</p>
              <p class="caption">{{ 'ads.noneHint' | t }}</p>
            </div>
          }
        </section>
          }
        }
      } @else {
        <div class="empty">
          <p class="strong-sm">{{ 'ads.loadFailed' | t }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    .ads {
      display: flex;
      flex-direction: column;
      gap: 20px;
      max-width: 860px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .title,
    .subtitle {
      margin: 0;
    }
    .subtitle {
      font-size: 1.05rem;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 16px;
      text-align: center;
    }
    .empty.small {
      padding: 24px 12px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
    }
    .row.end {
      justify-content: flex-end;
    }
    .grow {
      flex: 1 1 0;
      min-width: 0;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
    }
    .danger {
      color: var(--danger);
    }
    .platforms {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 12px;
    }
    .tile {
      gap: 12px;
      min-height: 190px;
    }
    .tile.off {
      opacity: 0.55;
    }
    .tile-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }
    .tile-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      margin-top: auto;
    }
    .mark {
      display: grid;
      flex: none;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: var(--grey-100);
      color: var(--text-title);
    }
    .mark svg {
      width: 24px;
      height: 24px;
    }

    .campaign {
      gap: 14px;
    }
    .accounts {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .campaigns {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .sections {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      border-bottom: 1px solid rgba(20, 33, 61, 0.08);
      scrollbar-width: none;
    }
    .section-tab {
      flex: none;
      min-height: 40px;
      padding: 0 12px;
      border: 0;
      border-bottom: 2px solid transparent;
      background: transparent;
      color: var(--text-body);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }
    .section-tab.on {
      border-bottom-color: var(--primary);
      color: var(--text-title);
    }
    .metrics > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    @media (max-width: 640px) {
      .metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class AdsPage {
  private readonly ads = inject(AdsService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  // Le piattaforme che arriveranno: si vedono, ma non si collegano ancora.
  protected readonly logos = LOGOS;
  protected readonly upcoming: { key: 'meta' | 'linkedin' | 'openai'; name: string; hint: MessageKey }[] = [
    { key: 'meta', name: 'Meta', hint: 'ads.metaHint' },
    { key: 'linkedin', name: 'LinkedIn', hint: 'ads.linkedinHint' },
    { key: 'openai', name: 'OpenAI', hint: 'ads.openaiHint' },
  ];

  private readonly brandId = computed(() => this.brands.activeBrand()?.id ?? null);
  protected readonly data = signal<AdsResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly accounts = signal<AdAccount[] | null>(null);
  // La modale della campagna: nuova (ad null) o una bozza da riprendere.
  protected readonly wizard = signal<{ brandId: string; ad: Ad | null } | null>(null);
  // Una campagna già su Google aperta nella gestione; changed: qualcosa è cambiato, si rilegge alla chiusura.
  protected readonly detail = signal<{ brandId: string; ad: Ad } | null>(null);
  protected readonly detailChanged = signal(false);
  protected readonly sections = SECTIONS;
  protected readonly section = signal<Section>('campaigns');
  protected readonly brandIdValue = computed(() => this.brandId() ?? '');

  protected readonly currency = computed(() => this.data()?.connection?.currency ?? 'EUR');
  // Si avvia solo con Google Ads collegato e l'account scelto.
  protected readonly canLaunch = computed(() => {
    const connection = this.data()?.connection;
    return Boolean(connection && !connection.lost && connection.adAccountId);
  });

  constructor() {
    pageHeader(() => [{ label: this.i18n.t('shell.ads') }]);
    // Il ritorno da Google: l'indirizzo porta l'account collegato o l'errore, e va ripulito subito.
    const params = this.route.snapshot.queryParamMap;
    const returning = params.get('brand');
    if (returning) {
      const accountId = params.get('accountId');
      const failed = params.get('error');
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
      if (failed) this.toast.show(params.get('error_message') ?? this.i18n.t('ads.connectFailed'));
      else if (accountId) void this.finishConnect(returning, accountId);
    }
    effect(() => {
      const brandId = this.brandId();
      if (brandId)
        untracked(() => {
          this.wizard.set(null);
          this.detail.set(null);
          this.section.set('campaigns');
          this.accounts.set(null);
          void this.load(brandId);
        });
    });
  }

  protected reload(): void {
    const brandId = this.brandId();
    if (brandId) void this.load(brandId);
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.ads.list(brandId);
      if (this.brandId() !== brandId) return;
      this.data.set(data);
      // Collegato ma senza account scelto: si mostra subito la scelta.
      if (data.connection && !data.connection.lost && !data.connection.adAccountId && !this.accounts()) void this.loadAccounts();
    } catch (error) {
      if (this.brandId() === brandId) this.data.set(null);
      this.toast.show(errorMessage(error, this.i18n.t('ads.loadFailed')));
    } finally {
      if (this.brandId() === brandId) this.loading.set(false);
    }
  }

  // Un'azione: rilegge alla fine, e un errore lo dice il toast.
  private async act(work: (brandId: string) => Promise<unknown>, done?: string): Promise<boolean> {
    const brandId = this.brandId();
    if (!brandId || this.busy()) return false;
    this.busy.set(true);
    try {
      await work(brandId);
      if (done) this.toast.show(done);
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
      return false;
    } finally {
      this.busy.set(false);
      await this.load(brandId);
    }
  }

  protected usable(account: AdAccount): boolean {
    return account.selected && account.status?.toUpperCase() !== 'CLOSED';
  }

  protected async connect(): Promise<void> {
    const brandId = this.brandId();
    if (!brandId || this.busy()) return;
    this.busy.set(true);
    try {
      const back = new URL('/campagne', window.location.origin);
      back.searchParams.set('brand', brandId);
      const { authUrl } = await this.ads.connect(brandId, back.toString());
      if (authUrl) {
        window.location.assign(authUrl);
        return;
      }
      await this.load(brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.connectFailed')));
    } finally {
      this.busy.set(false);
    }
  }

  private async finishConnect(brandId: string, accountId: string): Promise<void> {
    this.busy.set(true);
    try {
      const { connection, accounts } = await this.ads.confirm(brandId, accountId);
      this.toast.show(this.i18n.t('ads.connected'));
      if (!connection.adAccountId) this.accounts.set(accounts);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.connectFailed')));
    } finally {
      this.busy.set(false);
      if (this.brandId() === brandId) await this.load(brandId);
    }
  }

  protected simulate(): void {
    void this.act((brandId) => this.ads.simulate(brandId), this.i18n.t('ads.connected'));
  }

  protected async loadAccounts(): Promise<void> {
    const brandId = this.brandId();
    if (!brandId) return;
    try {
      this.accounts.set((await this.ads.accounts(brandId)).accounts);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    }
  }

  protected async choose(account: AdAccount): Promise<void> {
    if (await this.act((brandId) => this.ads.chooseAccount(brandId, account.id))) this.accounts.set(null);
  }

  protected async disconnect(): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('ads.disconnectConfirm'),
      message: this.i18n.t('ads.disconnectMessage'),
      confirmLabel: this.i18n.t('ads.disconnect'),
      tone: 'danger',
    });
    if (confirmed && (await this.act((brandId) => this.ads.disconnect(brandId)))) this.accounts.set(null);
  }

  protected open(ad: Ad | null): void {
    const brandId = this.brandId();
    if (brandId) this.wizard.set({ brandId, ad });
  }

  private confirmLaunch(ad: Pick<AdDraft, 'name' | 'dailyBudget' | 'startsOn' | 'endsOn'>): Promise<boolean> {
    const currency = this.currency();
    const total = maxSpend(ad);
    const daily = this.money(ad.dailyBudget, currency);
    const days = total === null ? 0 : Math.round(total / ad.dailyBudget);
    return this.confirm.ask({
      title: this.i18n.t('ads.launchConfirm', { name: ad.name }),
      message:
        total === null
          ? this.i18n.t('ads.launchMessageOpen', { daily })
          : this.i18n.t('ads.launchMessageMax', { total: this.money(total, currency), daily, days }),
      confirmLabel: this.i18n.t('ads.launchLabel'),
    });
  }

  protected async launch(ad: Ad): Promise<void> {
    if (!(await this.confirmLaunch(ad))) return;
    void this.act((brandId) => this.ads.launch(brandId, ad.id), this.i18n.t('ads.launched'));
  }

  protected pause(ad: Ad): void {
    void this.act((brandId) => this.ads.pause(brandId, ad.id), this.i18n.t('ads.paused'));
  }

  protected resume(ad: Ad): void {
    void this.act((brandId) => this.ads.resume(brandId, ad.id), this.i18n.t('ads.resumed'));
  }

  protected async remove(ad: Ad): Promise<void> {
    const draft = ad.status === 'draft' || ad.status === 'failed';
    const confirmed = await this.confirm.ask({
      title: this.i18n.t(draft ? 'ads.removeDraftConfirm' : 'ads.removeConfirm', { name: ad.name }),
      ...(!draft && { message: this.i18n.t('ads.removeMessage') }),
      confirmLabel: this.i18n.t('ads.remove'),
      tone: 'danger',
    });
    if (confirmed) void this.act((brandId) => this.ads.remove(brandId, ad.id), this.i18n.t('ads.removed'));
  }

  // Le righe.

  protected active(ad: Ad): boolean {
    return ACTIVE.includes(ad.status);
  }

  protected statusLabel(status: AdStatus): string {
    return this.i18n.t(status === 'scheduled' ? 'adsManage.status.scheduled' : (`ads.status.${status}` as MessageKey));
  }

  protected typeLabel(ad: Ad): MessageKey {
    return TYPE_KEYS[ad.campaignType] ?? TYPE_KEYS.search;
  }

  // Dopo l'avvio la campagna si gestisce: andamento, modifiche, parole chiave.
  protected manageable(ad: Ad): boolean {
    return ad.status !== 'draft' && ad.status !== 'failed' && ad.status !== 'deleted';
  }

  protected openDetail(ad: Ad): void {
    const brandId = this.brandId();
    if (!brandId) return;
    this.detailChanged.set(false);
    this.detail.set({ brandId, ad });
  }

  protected closeDetail(): void {
    this.detail.set(null);
    if (this.detailChanged()) this.reload();
  }

  private date(value: string): string {
    return new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
  }

  protected adLine(ad: Ad): string {
    const dates = ad.endsOn
      ? this.i18n.t('ads.dates', { from: this.date(ad.startsOn), to: this.date(ad.endsOn) })
      : this.i18n.t('ads.datesOpen', { from: this.date(ad.startsOn) });
    const parts = [this.i18n.t('ads.perDay', { amount: this.money(ad.dailyBudget, ad.currency ?? this.currency()) }), dates];
    if (ad.syncedAt && ad.status !== 'draft') {
      const time = new Intl.DateTimeFormat(this.i18n.locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ad.syncedAt));
      parts.push(this.i18n.t('ads.syncedAt', { time }));
    }
    return parts.join(' · ');
  }

  protected money(value: number | null, currency: string | null): string {
    if (value === null) return '—';
    return new Intl.NumberFormat(this.i18n.locale(), { style: 'currency', currency: currency ?? 'EUR', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
  }

  protected number(value: number | null): string {
    return value === null ? '—' : new Intl.NumberFormat(this.i18n.locale()).format(value);
  }

  protected percent(value: number | null): string {
    return value === null ? '—' : `${new Intl.NumberFormat(this.i18n.locale(), { maximumFractionDigits: 1 }).format(value)}%`;
  }
}
