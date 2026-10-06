import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';

// Il promemoria della conferma dell'email, sopra la pagina, finché non si apre il link. Si chiude fino al prossimo accesso.
@Component({
  selector: 'mb-email-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    @if (email(); as address) {
      <div class="banner" role="status">
        <mb-icon name="mail" [size]="16" [stroke]="1.8" />
        <p class="text">{{ 'shell.emailBanner.text' | t: { email: address } }}</p>
        <button class="link-btn" type="button" [disabled]="busy() || sent()" (click)="resend()">
          {{ (busy() ? 'shell.emailBanner.sending' : 'shell.emailBanner.resend') | t }}
        </button>
        <button class="close" type="button" [title]="'shell.emailBanner.close' | t" [attr.aria-label]="'shell.emailBanner.close' | t"
          (click)="closed.set(true)">
          <mb-icon name="x" [size]="14" />
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      flex: none;
    }
    .banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 12px;
      padding: 10px 24px;
      border-bottom: 1px solid var(--border-subtle);
      background: var(--accent-tint);
      color: var(--text-title);
    }
    .text {
      flex: 1;
      min-width: 0;
      font-size: 13px;
    }
    .link-btn {
      font-weight: 600;
    }
    .close {
      display: inline-flex;
      padding: 4px;
      border: 0;
      border-radius: 999px;
      background: none;
      color: var(--text-body);
      cursor: pointer;

      &:hover {
        background: rgba(20, 33, 61, 0.06);
      }
    }
  `,
})
export class EmailBanner {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);

  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly closed = signal(false);
  protected readonly email = computed(() => {
    const account = this.auth.account();
    return account && !account.emailConfirmed && !this.closed() ? account.email : null;
  });

  protected async resend(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.resendConfirmation();
      this.sent.set(true);
      this.toast.show(this.i18n.t('shell.emailBanner.sent'));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('shell.emailBanner.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
