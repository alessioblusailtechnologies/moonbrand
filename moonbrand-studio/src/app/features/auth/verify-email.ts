import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon } from '../../ui/icon';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

// Dopo la registrazione, prima dell'onboarding: lo studio resta chiuso finché non si apre il link dell'email.
// Il link si apre di solito in un'altra scheda: tornando qui si ricontrolla da soli, oppure con il pulsante.
@Component({
  selector: 'mb-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AuthSide, Icon, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  host: { '(window:focus)': 'check(true)' },
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <div class="form">
        <span class="mail-badge"><mb-icon name="mail" [size]="22" [stroke]="1.8" /></span>
        <div class="head">
          <h1 class="title">{{ 'auth.verify.title' | t }}</h1>
          <p class="body">{{ 'auth.verify.subtitle' | t: { email: auth.account()?.email ?? '' } }}</p>
          <p class="caption">{{ 'auth.verify.spam' | t }}</p>
        </div>
        @if (message(); as text) {
          <p [class]="sent() ? 'notice' : 'error'" role="alert">{{ text }}</p>
        }
        <button class="btn btn-primary btn-lg btn-block submit" type="button" [class.busy]="checking()" [disabled]="checking()" (click)="check(false)">
          {{ (checking() ? 'auth.verify.checking' : 'auth.verify.proceed') | t }}
        </button>
        <button class="btn btn-secondary btn-lg btn-block" type="button" [class.busy]="sending()" [disabled]="sending()" (click)="resend()">
          {{ (sending() ? 'auth.verify.sending' : 'auth.verify.resend') | t }}
        </button>
        <p class="caption switch">
          {{ 'auth.verify.wrongEmail' | t }} <button class="link-btn" type="button" (click)="signOut()">{{ 'auth.verify.signOut' | t }}</button>
        </p>
      </div>
    </main>
  `,
  styles: `
    .mail-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      margin-bottom: 6px;
      border-radius: 999px;
      background: var(--accent-tint);
      color: var(--accent-strong);
    }
  `,
})
export class VerifyEmail {
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly checking = signal(false);
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected readonly message = signal('');

  // silent: il controllo al ritorno sulla scheda, che non dice niente se l'email non è ancora confermata.
  protected async check(silent: boolean): Promise<void> {
    if (this.checking()) return;
    this.checking.set(!silent);
    try {
      const account = await this.auth.reloadAccount();
      if (account?.emailConfirmed) {
        await this.router.navigateByUrl('/', { replaceUrl: true });
      } else if (!silent) {
        this.sent.set(false);
        this.message.set(this.i18n.t('auth.verify.notYet'));
      }
    } catch (error) {
      if (!silent) this.message.set(errorMessage(error, this.i18n.t('auth.verify.notYet')));
    } finally {
      this.checking.set(false);
    }
  }

  protected async resend(): Promise<void> {
    if (this.sending()) return;
    this.sending.set(true);
    try {
      await this.auth.resendConfirmation();
      this.sent.set(true);
      this.message.set(this.i18n.t('auth.verify.sent'));
    } catch (error) {
      this.sent.set(false);
      this.message.set(errorMessage(error, this.i18n.t('auth.verify.resendFailed')));
    } finally {
      this.sending.set(false);
    }
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/register');
  }
}
