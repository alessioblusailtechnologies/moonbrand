import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { BrandProfile, ChannelChoice, ChannelChoicesRequest } from '@moonbrand/shared/api/contract';
import type { ChannelId, SectionKey } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName, kindLabel } from '@moonbrand/shared/domain/catalog';
import { identityLine, SECTION_KEYS, sectionCopy, sectionStatus, sectionSummary, type SectionStatus } from '@moonbrand/shared/domain/sections';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { BrandsService } from '../../core/brands/brands.service';
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
  imports: [BrandAvatar, Icon, SectionEditor, ChannelChoiceDialog, TranslatePipe],
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
    @if (choosing(); as pending) {
      <mb-channel-choice [channel]="pending.channel" [choices]="pending.choices" [busy]="selecting()" (chosen)="select($event)"
        (cancelled)="cancelChoice()" />
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
  // Facebook e LinkedIn al ritorno dal social: le scelte di dove pubblicare, con i dati per completare il collegamento.
  protected readonly choosing = signal<{ brandId: string; channel: ChannelId; choices: ChannelChoice[]; request: ChannelChoicesRequest } | null>(null);
  protected readonly selecting = signal(false);
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
    void this.finishConnection();
    effect(() => {
      const brandId = this.activeId();
      if (brandId) untracked(() => void this.load(brandId));
    });
  }

  // Il ritorno dalla pagina di accesso del social (Collega nei Canali): Zernio ha aggiunto all'indirizzo l'account
  // collegato, l'errore o, per Facebook e LinkedIn, i dati per scegliere dove pubblicare. Ci sono token temporanei:
  // l'indirizzo torna subito pulito e i dati restano solo in memoria, fino al server.
  private async finishConnection(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const channel = params.get('canale') as ChannelId | null;
    const brandId = params.get('brand');
    if (!channel || !brandId || !CHANNELS.some(({ id }) => id === channel)) return;
    const accountId = params.get('accountId');
    const failed = params.get('error');
    const step = params.get('step');
    const request: ChannelChoicesRequest = {
      tempToken: params.get('tempToken') ?? '',
      connectToken: params.get('connect_token') ?? '',
      userProfile: params.get('userProfile') ?? '',
      ...(params.get('organizations') && { organizations: params.get('organizations')! }),
    };
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    if (!failed && (step === 'select_page' || step === 'select_organization') && request.tempToken) {
      try {
        const choices = await this.brands.channelChoices(brandId, channel, request);
        this.choosing.set({ brandId, channel, choices, request });
      } catch (error) {
        this.toast.show(errorMessage(error, this.failed(channel)));
      }
      return;
    }
    if (failed || !accountId) {
      this.toast.show(params.get('error_message') ?? this.failed(channel));
      return;
    }
    try {
      const { state } = await this.brands.confirmChannel(brandId, channel, accountId);
      this.toast.show(this.i18n.t('profile.connection.connected', { channel: channelName(channel), handle: state.handle ?? '' }));
      if (this.activeId() === brandId) await this.load(brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.failed(channel)));
    }
  }

  protected async select(choiceId: string): Promise<void> {
    const pending = this.choosing();
    if (!pending || this.selecting()) return;
    this.selecting.set(true);
    try {
      const { state } = await this.brands.selectChannel(pending.brandId, pending.channel, { ...pending.request, choiceId });
      this.choosing.set(null);
      this.toast.show(this.i18n.t('profile.connection.connected', { channel: channelName(pending.channel), handle: state.handle ?? '' }));
      if (this.activeId() === pending.brandId) await this.load(pending.brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.failed(pending.channel)));
    } finally {
      this.selecting.set(false);
    }
  }

  protected cancelChoice(): void {
    const pending = this.choosing();
    this.choosing.set(null);
    if (pending) this.toast.show(this.i18n.t('profile.connection.cancelled', { channel: channelName(pending.channel) }));
  }

  private failed(channel: ChannelId): string {
    return this.i18n.t('profile.connection.failed', { channel: channelName(channel) });
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
