import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import type { Ad, AdRecommendation } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';

// I tipi di consiglio che sappiamo dire in parole semplici; gli altri con il nome di Google reso leggibile.
const KNOWN = new Set([
  'CAMPAIGN_BUDGET',
  'FORECASTING_CAMPAIGN_BUDGET',
  'MARGINAL_ROI_CAMPAIGN_BUDGET',
  'KEYWORD',
  'KEYWORD_MATCH_TYPE',
  'USE_BROAD_MATCH_KEYWORD',
  'SITELINK_ASSET',
  'CALLOUT_ASSET',
  'STRUCTURED_SNIPPET_ASSET',
  'RESPONSIVE_SEARCH_AD',
  'RESPONSIVE_SEARCH_AD_ASSET',
  'RESPONSIVE_SEARCH_AD_IMPROVE_AD_STRENGTH',
  'TARGET_CPA_OPT_IN',
  'TARGET_ROAS_OPT_IN',
  'MAXIMIZE_CLICKS_OPT_IN',
  'MAXIMIZE_CONVERSIONS_OPT_IN',
  'MAXIMIZE_CONVERSION_VALUE_OPT_IN',
  'ENHANCED_CPC_OPT_IN',
  'SEARCH_PARTNERS_OPT_IN',
  'DISPLAY_EXPANSION_OPT_IN',
  'UPGRADE_SMART_SHOPPING_CAMPAIGN_TO_PERFORMANCE_MAX',
  'IMAGE_ASSET',
  'MOVE_UNUSED_BUDGET',
  'RAISE_TARGET_CPA_BID_TOO_LOW',
  'LOWER_TARGET_ROAS',
  'CALL_ASSET',
  'LEAD_FORM_ASSET',
  'PERFORMANCE_MAX_OPT_IN',
  'IMPROVE_PERFORMANCE_MAX_AD_STRENGTH',
  'DYNAMIC_IMAGE_EXTENSION_OPT_IN',
]);

// I consigli di Google sull'account e sulle campagne: si applicano (non si torna indietro) o si scartano.
@Component({
  selector: 'mb-ad-recommendations',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Loader, TranslatePipe],
  template: `
    <p class="caption">{{ 'adsManage.recs.explain' | t }}</p>
    @if (loading() && !list()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <div class="panel empty small">
        <p class="caption danger">{{ failed() }}</p>
        <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
      </div>
    } @else if (list(); as recs) {
      @for (rec of recs; track rec.resource) {
        <article class="panel rec">
          <div class="row">
            <div class="grow texts">
              <span class="strong-sm">{{ title(rec) }}</span>
              <span class="caption">{{ hint(rec) }}</span>
              <span class="caption">{{ campaignOf(rec) }}</span>
              @if (impactLine(rec); as impact) {
                <span class="caption impact">{{ impact }}</span>
              }
            </div>
            <div class="actions">
              <button class="btn btn-ghost btn-sm" type="button" [disabled]="busy()" (click)="dismiss(rec)">{{ 'adsManage.recs.dismiss' | t }}</button>
              <button class="btn btn-primary btn-sm" type="button" [disabled]="busy()" (click)="apply(rec)">{{ 'adsManage.recs.apply' | t }}</button>
            </div>
          </div>
        </article>
      } @empty {
        <div class="panel empty small">
          <p class="strong-sm">{{ 'adsManage.recs.none' | t }}</p>
          <p class="caption">{{ 'adsManage.recs.noneHint' | t }}</p>
        </div>
      }
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
    .impact {
      color: var(--accent-strong);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
  `,
})
export class AdRecommendations {
  readonly brandId = input.required<string>();
  readonly ads = input<Ad[]>([]);
  // Un consiglio applicato può cambiare budget o offerte: la pagina rilegge le campagne.
  readonly applied = output<void>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);

  protected readonly list = signal<AdRecommendation[] | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  private readonly names = computed(() => new Map(this.ads().map((ad) => [ad.id, ad.name])));

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
      this.list.set((await this.service.recommendations(brandId)).recommendations);
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.recs.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  private readable(type: string): string {
    const text = type.toLowerCase().replace(/_/g, ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected title(rec: AdRecommendation): string {
    return KNOWN.has(rec.type) ? this.i18n.t(`adsManage.recTypes.${rec.type}` as MessageKey) : this.readable(rec.type);
  }

  protected hint(rec: AdRecommendation): string {
    return KNOWN.has(rec.type) ? this.i18n.t(`adsManage.recHints.${rec.type}` as MessageKey) : this.i18n.t('adsManage.recs.genericHint');
  }

  protected campaignOf(rec: AdRecommendation): string {
    const name = rec.adId ? this.names().get(rec.adId) : null;
    if (name) return this.i18n.t('adsManage.recs.campaign', { name });
    return rec.campaignId ? this.i18n.t('adsManage.recs.otherCampaign') : this.i18n.t('adsManage.recs.account');
  }

  // L'effetto stimato da Google, se c'è: clic e impressioni in più.
  protected impactLine(rec: AdRecommendation): string {
    const impact = rec.impact as { baseMetrics?: Record<string, unknown>; potentialMetrics?: Record<string, unknown> } | null;
    const base = impact?.baseMetrics;
    const potential = impact?.potentialMetrics;
    if (!base || !potential) return '';
    const diff = (key: string) => {
      const a = Number(base[key]);
      const b = Number(potential[key]);
      return Number.isFinite(a) && Number.isFinite(b) ? Math.round(b - a) : 0;
    };
    const clicks = diff('clicks');
    const impressions = diff('impressions');
    const format = (n: number) => new Intl.NumberFormat(this.i18n.locale()).format(n);
    if (clicks > 0) return this.i18n.t('adsManage.recs.moreClicks', { n: format(clicks) });
    if (impressions > 0) return this.i18n.t('adsManage.recs.moreImpressions', { n: format(impressions) });
    return '';
  }

  private async act(rec: AdRecommendation, apply: boolean): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      const work = apply ? this.service.applyRecommendations : this.service.dismissRecommendations;
      const { results } = await work.call(this.service, this.brandId(), [rec.resource]);
      const result = results[0];
      if (result?.status === 'failed') {
        this.toast.show(result.error ?? this.i18n.t('ads.failed'));
      } else {
        this.list.update((list) => (list ?? []).filter((item) => item.resource !== rec.resource));
        this.toast.show(this.i18n.t(apply ? 'adsManage.recs.applied' : 'adsManage.recs.dismissed'));
        if (apply) this.applied.emit();
      }
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async apply(rec: AdRecommendation): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('adsManage.recs.applyConfirm', { name: this.title(rec) }),
      message: this.i18n.t('adsManage.recs.applyMessage'),
      confirmLabel: this.i18n.t('adsManage.recs.apply'),
    });
    if (confirmed) await this.act(rec, true);
  }

  protected dismiss(rec: AdRecommendation): void {
    void this.act(rec, false);
  }
}
