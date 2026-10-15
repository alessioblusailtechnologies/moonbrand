import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { BrandProfile } from '@moonbrand/shared/api/contract';
import type { BrandDraft, SectionKey } from '@moonbrand/shared/domain/brand';
import { kindLabel } from '@moonbrand/shared/domain/catalog';
import { SUBSCRIPTION_PLANS } from '@moonbrand/shared/domain/subscription';
import { identityLine, SECTION_KEYS, sectionCopy, sectionStatus, sectionSummary, type SectionStatus } from '@moonbrand/shared/domain/sections';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { BillingService } from '../../core/billing/billing.service';
import { subscriptionLive, subscriptionStatusLine } from '../../core/billing/subscription-status';
import { BrandsService } from '../../core/brands/brands.service';
import { CreditsService } from '../../core/credits/credits.service';
import { ChannelConnectionService } from '../../core/brands/channel-connection';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { BrandAvatar } from '../../ui/brand-avatar';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { ToastService } from '../../ui/toast';
import { PlanDialog } from '../plans/plan-dialog';
import { ChannelChoiceDialog } from './channel-choice';
import { SectionEditor } from './section-editor';

const STATUS: Record<SectionStatus, { color: string; label: MessageKey | null }> = {
  complete: { color: 'var(--mint-400)', label: null },
  partial: { color: 'var(--accent-soft)', label: 'profile.page.toComplete' },
  missing: { color: 'var(--grey-300)', label: 'profile.page.toDo' },
};

@Component({
  selector: 'mb-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BrandAvatar, Icon, Loader, RouterLink, SectionEditor, ChannelChoiceDialog, PlanDialog, TranslatePipe],
  template: `
    @if (brands.activeBrand(); as brand) {
      <section class="profile">
        <header class="head">
          <mb-brand-avatar [name]="brand.name" [logo]="brand.logoUri" [color]="brand.color" [size]="64" />
          <div class="grow texts">
            <span class="label">{{ kindLabel(brand.kind, i18n.locale()) }}</span>
            <h1 class="title">{{ brand.name }}</h1>
            @if (line()) {
              <p class="caption">{{ line() }}</p>
            }
          </div>
        </header>

        @if (loading()) {
          <div class="empty"><mb-loader /></div>
        } @else if (profile()) {
          <div class="panel rows">
            @for (row of rows(); track row.key) {
              <button class="row-btn" type="button" (click)="editing.set(row.key)">
                <span class="dot" [style.background]="row.color"></span>
                <span class="grow texts">
                  <span class="name">
                    <span class="strong-sm">{{ row.name }}</span>
                    @if (row.status) {
                      <span class="badge">{{ row.status | t }}</span>
                    }
                  </span>
                  <span class="caption summary">{{ row.summary }}</span>
                </span>
                <span class="edit caption">{{ 'common.edit' | t }}</span>
                <mb-icon name="chevron-right" [size]="16" class="chevron" />
              </button>
            }
          </div>
          <p class="caption">{{ 'profile.page.note' | t }}</p>
          <div class="panel rows">
            @if (plan(); as current) {
              <button class="row-btn" type="button" (click)="current.free || changingPlan.set(true)">
                <mb-icon name="layers" [size]="18" class="row-icon" />
                <span class="grow texts">
                  <span class="strong-sm">{{ 'plans.settingsRow' | t }}</span>
                  <span class="caption summary">{{ current.summary }}</span>
                  <span class="caption summary" [class.warn]="current.warn">{{ current.status }}</span>
                </span>
                @if (!current.free) {
                  <span class="edit caption">{{ 'common.edit' | t }}</span>
                  <mb-icon name="chevron-right" [size]="16" class="chevron" />
                }
              </button>
              @if (current.subscribed) {
                <button class="row-btn" type="button" (click)="openPortal()">
                  <mb-icon name="file-text" [size]="18" class="row-icon" />
                  <span class="grow texts">
                    <span class="strong-sm">{{ 'plans.billingRow' | t }}</span>
                    <span class="caption summary">{{ 'plans.billingRowHint' | t }}</span>
                  </span>
                  <mb-icon name="chevron-right" [size]="16" class="chevron" />
                </button>
              }
            }
            <a class="row-btn" routerLink="/impostazioni/crediti">
              <mb-icon name="bar-chart" [size]="18" class="row-icon" />
              <span class="grow texts">
                <span class="strong-sm">{{ 'credits.settingsRow' | t }}</span>
                <span class="caption summary">{{ 'credits.settingsRowHint' | t }}</span>
              </span>
              <mb-icon name="chevron-right" [size]="16" class="chevron" />
            </a>
          </div>
        } @else {
          <div class="empty">
            <p class="strong-sm">{{ 'profile.page.loadFailedTitle' | t }}</p>
            <button class="btn btn-secondary btn-sm" type="button" (click)="load(brand.id)">{{ 'common.retry' | t }}</button>
          </div>
        }
      </section>

      @if (editing(); as key) {
        @if (profile(); as current) {
          <mb-section-editor [brandId]="current.id" [draft]="current.draft" [followed]="current.followed" [section]="key" (closed)="editing.set(null)"
            (saved)="sectionSaved(current, key, $event)" />
        }
      }
    }
    @if (changingPlan()) {
      @if (brands.activeBrand(); as brand) {
        @if (plan(); as current) {
          <mb-plan-dialog [brandId]="brand.id" [current]="current.id" [subscribed]="current.subscribed" (closed)="changingPlan.set(false)" />
        }
      }
    }
    @if (connection.choosing(); as pending) {
      <mb-channel-choice [channel]="pending.channel" [choices]="pending.choices" [busy]="connection.selecting()"
        (chosen)="connection.select($event, connected)" (cancelled)="connection.cancel()" />
    }
  `,
  styles: `
    .profile {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .title {
      margin: 0;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 48px 16px;
      text-align: center;
    }
    .rows {
      gap: 0;
      padding: 6px 20px;
      border-radius: var(--radius-card);
    }
    .row-btn {
      display: flex;
      align-items: center;
      gap: 14px;
      width: 100%;
      padding: 16px 0;
      border: 0;
      border-top: 1px solid var(--grey-100);
      background: none;
      text-align: left;
      cursor: pointer;
    }
    a.row-btn {
      color: inherit;
      text-decoration: none;
    }
    .row-icon {
      flex: none;
      color: var(--text-body);
    }
    .row-btn:first-child {
      border-top: 0;
    }
    .row-btn:hover .edit {
      color: var(--text-title);
    }
    .row-btn:hover .chevron {
      transform: translateX(2px);
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .summary {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .summary.warn {
      color: var(--danger);
    }
    .edit {
      flex: none;
      font-weight: 500;
      transition: color 120ms var(--ease);
    }
    .chevron {
      flex: none;
      color: var(--grey-300);
      transition: transform 120ms var(--ease);
    }
    @media (max-width: 640px) {
      .edit {
        display: none;
      }
    }
  `,
})
export class ProfilePage {
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly brands = inject(BrandsService);
  protected readonly i18n = inject(I18nService);
  protected readonly kindLabel = kindLabel;

  protected readonly profile = signal<BrandProfile | null>(null);
  protected readonly loading = signal(true);
  protected readonly editing = signal<SectionKey | null>(null);
  protected readonly changingPlan = signal(false);
  private readonly credits = inject(CreditsService);
  private readonly billing = inject(BillingService);

  // Il piano del brand attivo, come lo dicono i suoi crediti, e lo stato del suo abbonamento su Dodo Payments.
  protected readonly plan = computed(() => {
    const credits = this.credits.credits();
    if (!credits) return null;
    const plan = SUBSCRIPTION_PLANS[credits.plan];
    const status = credits.subscription?.status;
    return {
      id: credits.plan,
      summary: this.i18n.t('plans.settingsSummary', { plan: plan.name, ...plan.monthly }),
      status: subscriptionStatusLine(this.i18n, credits.subscription),
      warn: !subscriptionLive(credits.subscription) || status === 'past_due' || status === 'on_hold',
      // In omaggio: niente cambio di piano né portale dei pagamenti.
      free: Boolean(credits.subscription?.free),
      subscribed: subscriptionLive(credits.subscription) && !credits.subscription?.free,
    };
  });

  protected openPortal(): void {
    const brandId = this.brands.activeBrand()?.id;
    if (brandId) void this.billing.openPortal(brandId);
  }
  protected readonly connection = inject(ChannelConnectionService);
  // Solo l'id: dopo un salvataggio nome e logo cambiano, ma il profilo non va riletto.
  private readonly activeId = computed(() => this.brands.activeBrand()?.id ?? null);

  protected readonly line = computed(() => {
    const draft = this.profile()?.draft;
    return draft ? identityLine(draft, this.i18n.locale()) : '';
  });

  protected readonly rows = computed(() => {
    const draft = this.profile()?.draft;
    if (!draft) return [];
    const locale = this.i18n.locale();
    return SECTION_KEYS.map((key) => {
      const status = STATUS[sectionStatus(key, draft)];
      const name = sectionCopy(key, draft.identity.kind, locale).name;
      return { key, name, summary: sectionSummary(key, draft, locale), color: status.color, status: status.label };
    });
  });

  constructor() {
    pageHeader(() => [{ label: this.i18n.t('profile.title') }]);
    this.finishConnection();
    effect(() => {
      const brandId = this.activeId();
      if (brandId) untracked(() => void this.load(brandId));
    });
  }

  // Il ritorno dalla pagina di accesso del social (Collega nei Canali): il collegamento si finisce qui.
  private finishConnection(): void {
    const back = this.connection.finish(this.route.snapshot.queryParamMap, this.connected);
    if (back) void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected readonly connected = async (brandId: string) => {
    if (this.activeId() === brandId) await this.load(brandId);
  };

  // Con esempi nuovi scelti nel Visual cambiano anche quelli seguiti, che stanno nella cartella del brand: si rilegge il profilo.
  protected sectionSaved(current: BrandProfile, section: SectionKey, draft: BrandDraft): void {
    this.profile.set({ ...current, draft });
    this.editing.set(null);
    if (section === 'visual') void this.reloadFollowed(current.id);
  }

  private async reloadFollowed(brandId: string): Promise<void> {
    const profile = await this.brands.profile(brandId).catch(() => null);
    const current = this.profile();
    if (profile && current?.id === brandId) this.profile.set({ ...current, followed: profile.followed });
  }

  protected async load(brandId: string): Promise<void> {
    this.editing.set(null);
    this.loading.set(true);
    try {
      const profile = await this.brands.profile(brandId);
      if (this.activeId() === brandId) this.profile.set(profile);
    } catch (error) {
      this.profile.set(null);
      this.toast.show(errorMessage(error, this.i18n.t('profile.page.loadFailed')));
    } finally {
      if (this.activeId() === brandId) this.loading.set(false);
    }
  }
}
