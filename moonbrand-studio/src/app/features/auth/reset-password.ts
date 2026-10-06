import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PASSWORD_MIN } from '@moonbrand/shared/api/contract';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

// Dal link dell'email: la nuova password, e si entra. Il link vale una volta sola.
@Component({
  selector: 'mb-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <form (submit)="submit($event)" novalidate>
        <div class="head">
          <h1 class="title">{{ 'auth.reset.title' | t }}</h1>
          <p class="body">{{ 'auth.reset.subtitle' | t }}</p>
        </div>
        @if (token) {
          <div class="field">
            <label for="password">{{ 'auth.fields.password' | t }}</label>
            <input id="password" type="password" autocomplete="new-password" [placeholder]="'auth.register.passwordPlaceholder' | t: { n: passwordMin }"
              [value]="password()" (input)="password.set($any($event.target).value)" />
          </div>
        }
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        @if (token && !expired()) {
          <button class="btn btn-primary btn-lg btn-block submit" type="submit" [class.busy]="busy()" [disabled]="busy()">
            {{ (busy() ? 'auth.reset.submitting' : 'auth.reset.submit') | t }}
          </button>
        } @else {
          <a class="btn btn-primary btn-lg btn-block submit" routerLink="/password-dimenticata">{{ 'auth.reset.requestNew' | t }}</a>
        }
        <p class="caption switch"><a routerLink="/login">{{ 'auth.forgot.back' | t }}</a></p>
      </form>
    </main>
  `,
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal(this.token ? '' : this.i18n.t('auth.reset.missingToken'));
  // Il link è già stato usato o è scaduto: serve chiederne un altro.
  protected readonly expired = signal(false);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy() || !this.token) return;
    if (this.password().length < PASSWORD_MIN) {
      this.error.set(this.i18n.t('auth.register.passwordShort', { n: PASSWORD_MIN }));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.resetPassword({ token: this.token, password: this.password() });
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.expired.set((error as { error?: { code?: string } }).error?.code === 'INVALID_LINK');
      this.error.set(errorMessage(error, this.i18n.t('auth.reset.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
