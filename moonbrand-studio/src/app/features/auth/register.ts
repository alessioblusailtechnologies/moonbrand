import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { PASSWORD_MIN } from '@moonbrand/shared/api/contract';
import { matchLocale } from '@moonbrand/shared/i18n/locales';

import { AuthService } from '../../core/auth/auth.service';
import { readSignupPrefill } from '../../core/auth/signup-prefill';
import { I18nService } from '../../core/i18n/i18n.service';
import { errorMessage } from '../../core/errors';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';
import { GoogleButton } from './google-button';

@Component({
  selector: 'mb-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, GoogleButton, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <form (submit)="submit($event)" novalidate>
        <div class="head">
          <h1 class="title">{{ 'auth.register.title' | t }}</h1>
          <p class="body">{{ 'auth.register.subtitle' | t }}</p>
        </div>
        <mb-google-button />
        <div class="field">
          <label for="name">{{ 'auth.fields.name' | t }}</label>
          <input id="name" type="text" autocomplete="name" [placeholder]="'auth.register.namePlaceholder' | t" [value]="name()"
            (input)="name.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label for="email">{{ 'auth.fields.email' | t }}</label>
          <input id="email" type="email" autocomplete="email" [placeholder]="'auth.fields.emailPlaceholder' | t" [value]="email()"
            (input)="email.set($any($event.target).value)" />
        </div>
        <div class="field">
          <label for="password">{{ 'auth.fields.password' | t }}</label>
          <input id="password" type="password" autocomplete="new-password" [placeholder]="'auth.register.passwordPlaceholder' | t: { n: passwordMin }"
            [value]="password()" (input)="password.set($any($event.target).value)" />
        </div>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
        <button class="btn btn-accent btn-lg btn-block submit" type="submit" [class.busy]="busy()" [disabled]="busy()">
          {{ (busy() ? 'auth.register.submitting' : 'auth.register.submit') | t }}
        </button>
        <p class="caption switch">{{ 'auth.register.hasAccount' | t }} <a routerLink="/login">{{ 'auth.register.signIn' | t }}</a></p>
      </form>
    </main>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  // Arrivando dal form del sito, nome, email e lingua sono già scritti nell'indirizzo.
  private readonly prefill = readSignupPrefill(new URLSearchParams(location.search));

  protected readonly passwordMin = PASSWORD_MIN;
  protected readonly name = signal(this.prefill.name);
  protected readonly email = signal(this.prefill.email);
  protected readonly password = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  constructor() {
    const locale = matchLocale(this.prefill.lang);
    if (locale) void this.i18n.use(locale);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const problem = this.validate();
    if (problem) {
      this.error.set(problem);
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.signUp({ name: this.name().trim(), email: this.email().trim(), password: this.password(), locale: this.i18n.locale() });
      await this.router.navigateByUrl('/verifica-email');
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('auth.register.failed')));
    } finally {
      this.busy.set(false);
    }
  }

  private validate(): string | null {
    if (!this.name().trim()) return this.i18n.t('auth.register.nameMissing');
    if (!/^\S+@\S+\.\S+$/.test(this.email().trim())) return this.i18n.t('auth.register.emailInvalid');
    if (this.password().length < PASSWORD_MIN) return this.i18n.t('auth.register.passwordShort', { n: PASSWORD_MIN });
    return null;
  }
}
