import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

@Component({
  selector: 'mb-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <form (submit)="submit($event)" novalidate>
        <div class="head">
          <h1 class="title">{{ 'auth.login.title' | t }}</h1>
          <p class="body">{{ 'auth.login.subtitle' | t }}</p>
        </div>
        <div class="field">
          <label for="email">{{ 'auth.fields.email' | t }}</label>
          <input id="email" type="email" autocomplete="email" [placeholder]="'auth.fields.emailPlaceholder' | t" [value]="email()"
            (input)="email.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label for="password">{{ 'auth.fields.password' | t }}</label>
          <input id="password" type="password" autocomplete="current-password" [placeholder]="'auth.login.passwordPlaceholder' | t"
            [value]="password()" (input)="password.set($any($event.target).value)" />
        </div>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="btn btn-primary btn-lg btn-block submit" type="submit" [class.busy]="busy()" [disabled]="busy()">
          {{ (busy() ? 'auth.login.submitting' : 'auth.login.submit') | t }}
        </button>
        <p class="caption switch">{{ 'auth.login.noAccount' | t }} <a routerLink="/register">{{ 'auth.login.register' | t }}</a></p>
      </form>
    </main>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    if (!this.email().trim() || !this.password()) {
      this.error.set(this.i18n.t('auth.login.missing'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signIn({ email: this.email(), password: this.password() });
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('auth.login.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
