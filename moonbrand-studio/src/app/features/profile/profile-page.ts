import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import type { BrandProfile } from '@moonbrand/shared/api/contract';
import type { SectionKey } from '@moonbrand/shared/domain/brand';
import { kindLabel } from '@moonbrand/shared/domain/catalog';
import { identityLine, SECTION_KEYS, sectionCopy, sectionStatus, sectionSummary, type SectionStatus } from '@moonbrand/shared/domain/sections';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { BrandsService } from '../../core/brands/brands.service';
import { ChannelConnectionService } from '../../core/brands/channel-connection';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { BrandAvatar } from '../../ui/brand-avatar';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';
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
  imports: [BrandAvatar, Icon, RouterLink, SectionEditor, ChannelChoiceDialog, TranslatePipe],
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
          <div class="empty"><span class="spinner"></span></div>
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
          <mb-section-editor [brandId]="current.id" [draft]="current.draft" [section]="key" (closed)="editing.set(null)"
            (saved)="profile.set({ id: current.id, draft: $event }); editing.set(null)" />
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
