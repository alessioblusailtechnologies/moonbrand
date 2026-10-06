import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

// La richiesta del link per la nuova password. La risposta è la stessa che l'indirizzo abbia un account o no.
@Component({
  selector: 'mb-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      @if (sentTo(); as address) {
        <div class="form">
          <div class="head">
            <h1 class="title">{{ 'auth.forgot.sentTitle' | t }}</h1>
            <p class="body">{{ 'auth.forgot.sent' | t: { email: address } }}</p>
          </div>
          <a class="btn btn-secondary btn-lg btn-block submit" routerLink="/login">{{ 'auth.forgot.back' | t }}</a>
        </div>
      } @else {
        <form (submit)="submit($event)" novalidate>
          <div class="head">
            <h1 class="title">{{ 'auth.forgot.title' | t }}</h1>
            <p class="body">{{ 'auth.forgot.subtitle' | t }}</p>
          </div>
          <div class="field">
            <label for="email">{{ 'auth.fields.email' | t }}</label>
            <input id="email" type="email" autocomplete="email" [placeholder]="'auth.fields.emailPlaceholder' | t" [value]="email()"
              (input)="email.set($any($event.target).value)" />
          </div>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
          <button class="btn btn-primary btn-lg btn-block submit" type="submit" [class.busy]="busy()" [disabled]="busy()">
            {{ (busy() ? 'auth.forgot.submitting' : 'auth.forgot.submit') | t }}
          </button>
          <p class="caption switch"><a routerLink="/login">{{ 'auth.forgot.back' | t }}</a></p>
        </form>
      }
    </main>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  protected readonly email = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly sentTo = signal<string | null>(null);

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.busy()) return;
    const email = this.email().trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.error.set(this.i18n.t('auth.register.emailInvalid'));
      return;
    }
    this.busy.set(true);
    this.error.set('');
    try {
      await this.auth.forgotPassword(email);
      this.sentTo.set(email);
    } catch (error) {
      this.error.set(errorMessage(error, this.i18n.t('auth.forgot.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
