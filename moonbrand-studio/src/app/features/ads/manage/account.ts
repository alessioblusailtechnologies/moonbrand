import { ChangeDetectionStrategy, Component, effect, inject, input, signal, untracked } from '@angular/core';

import type { AdAccountInfoResponse } from '@moonbrand/shared/api/contract';
import type { AdAccessRole, AdInvitation } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AdsManageService } from '../../../core/ads/ads-manage.service';
import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ConfirmService } from '../../../ui/confirm';
import { Icon } from '../../../ui/icon';
import { Loader } from '../../../ui/loader';
import { ToastService } from '../../../ui/toast';

const ROLES: AdAccessRole[] = ['ADMIN', 'STANDARD', 'READ_ONLY', 'EMAIL_ONLY'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// L'account Google Ads del brand: se la fatturazione è a posto, e chi altro ci può entrare (inviti per email).
@Component({
  selector: 'mb-ad-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, TranslatePipe],
  template: `
    @if (loading() && !data()) {
      <div class="empty"><mb-loader /></div>
    } @else if (failed()) {
      <div class="panel empty small">
        <p class="caption danger">{{ failed() }}</p>
        <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
      </div>
    } @else if (data(); as current) {
      <section class="panel">
        <div class="row">
          <p class="label grow">{{ 'adsManage.account.billing' | t }}</p>
          <span class="badge" [class.mint]="current.billing.ready === true" [class.warn]="current.billing.ready === false">
            {{ billingBadge(current.billing.ready) | t }}
          </span>
        </div>
        @if (current.billing.ready === false) {
          <p class="body ink">{{ 'adsManage.account.billingMissing' | t }}</p>
          <a class="btn btn-primary btn-sm link" href="https://ads.google.com/aw/billing" target="_blank" rel="noopener">{{ 'adsManage.account.openBilling' | t }}</a>
        } @else if (current.billing.ready === null) {
          <p class="caption">{{ 'adsManage.account.billingUnknown' | t }}</p>
        } @else {
          <p class="caption">{{ 'adsManage.account.billingOk' | t }}</p>
        }
        @if (current.billing.detail) {
          <p class="caption">{{ current.billing.detail }}</p>
        }
      </section>

      <section class="panel">
        <p class="label">{{ 'adsManage.account.access' | t }}</p>
        <p class="caption">{{ 'adsManage.account.accessHint' | t }}</p>
        @for (invitation of current.invitations; track invitation.id) {
          <div class="row invite">
            <div class="grow texts">
              <span class="strong-sm">{{ invitation.email }}</span>
              <span class="caption">{{ roleLabel(invitation.role) | t }} · {{ statusLabel(invitation.status) }}</span>
            </div>
            <button class="icon-btn" type="button" [disabled]="busy()" [attr.aria-label]="'adsManage.account.revoke' | t" (click)="revoke(invitation)">
              <mb-icon name="trash" [size]="15" />
            </button>
          </div>
        } @empty {
          <span class="caption">{{ 'adsManage.account.noInvitations' | t }}</span>
        }
        <div class="field">
          <label for="inv-email">{{ 'adsManage.account.email' | t }}</label>
          <input id="inv-email" type="email" [value]="email()" (input)="email.set($any($event.target).value)" placeholder="nome@esempio.it" />
        </div>
        <div class="chips">
          @for (role of roles; track role) {
            <button class="chip" type="button" [class.selected]="role === chosenRole()" [attr.aria-pressed]="role === chosenRole()" (click)="chosenRole.set(role)">
              {{ roleLabel(role) | t }}
            </button>
          }
        </div>
        <p class="caption">{{ roleHint() | t }}</p>
        <button class="btn btn-primary btn-sm add" type="button" [disabled]="busy() || !validEmail()" (click)="invite()">{{ 'adsManage.account.invite' | t }}</button>
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
      overflow-wrap: anywhere;
    }
    .invite {
      padding: 8px 0;
      border-top: 1px solid var(--grey-100);
    }
    .field {
      background: var(--surface-sunken);
    }
    .link,
    .add {
      align-self: flex-start;
      text-decoration: none;
    }
  `,
})
export class AdAccountInfo {
  readonly brandId = input.required<string>();

  private readonly service = inject(AdsManageService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly roles = ROLES;

  protected readonly data = signal<AdAccountInfoResponse | null>(null);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly failed = signal<string | null>(null);
  protected readonly email = signal('');
  protected readonly chosenRole = signal<AdAccessRole>('STANDARD');

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
      this.data.set(await this.service.account(brandId));
    } catch (error) {
      this.failed.set(errorMessage(error, this.i18n.t('adsManage.account.failed')));
    } finally {
      this.loading.set(false);
    }
  }

  protected billingBadge(ready: boolean | null): MessageKey {
    return ready === true ? 'adsManage.account.billingReady' : ready === false ? 'adsManage.account.billingTodo' : 'adsManage.account.billingCheck';
  }

  protected roleLabel(role: string): MessageKey {
    return (ROLES as string[]).includes(role) ? (`adsManage.account.roles.${role}` as MessageKey) : 'adsManage.account.roles.STANDARD';
  }

  protected roleHint(): MessageKey {
    return `adsManage.account.roleHints.${this.chosenRole()}` as MessageKey;
  }

  protected statusLabel(status: string): string {
    const key = status.toUpperCase();
    if (key === 'PENDING' || key === 'PENDING_APPROVAL') return this.i18n.t('adsManage.account.pending');
    if (key === 'EXPIRED') return this.i18n.t('adsManage.account.expired');
    if (key === 'DECLINED') return this.i18n.t('adsManage.account.declined');
    return status;
  }

  protected validEmail(): boolean {
    return EMAIL.test(this.email().trim());
  }

  protected async invite(): Promise<void> {
    if (!this.validEmail() || this.busy()) return;
    this.busy.set(true);
    try {
      const invitation = await this.service.invite(this.brandId(), { email: this.email().trim(), role: this.chosenRole() });
      this.data.update((data) => (data ? { ...data, invitations: [invitation, ...data.invitations] } : data));
      this.email.set('');
      this.toast.show(this.i18n.t('adsManage.account.invited'));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async revoke(invitation: AdInvitation): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('adsManage.account.revokeConfirm', { email: invitation.email }),
      confirmLabel: this.i18n.t('adsManage.account.revoke'),
      tone: 'danger',
    });
    if (!confirmed || this.busy()) return;
    this.busy.set(true);
    try {
      await this.service.removeInvitation(this.brandId(), invitation.id);
      this.data.update((data) => (data ? { ...data, invitations: data.invitations.filter((item) => item.id !== invitation.id) } : data));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ads.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
