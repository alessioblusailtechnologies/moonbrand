import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

// Il ritorno da Google: il codice nell'indirizzo diventa la sessione, poi si va nello studio (o all'onboarding).
@Component({
  selector: 'mb-google-callback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <div class="form" aria-live="polite">
        @if (error(); as message) {
          <div class="head">
            <h1 class="title">{{ 'auth.google.failedTitle' | t }}</h1>
          </div>
          <p class="error" role="alert">{{ message }}</p>
          <a class="btn btn-primary btn-lg btn-block submit" routerLink="/login">{{ 'auth.google.back' | t }}</a>
        } @else {
          <div class="head">
            <h1 class="title">{{ 'auth.google.signingIn' | t }}</h1>
          </div>
        }
      </div>
    </main>
  `,
})
export class GoogleCallback {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly error = signal('');

  constructor() {
    const code = inject(ActivatedRoute).snapshot.queryParamMap.get('code');
    if (!code) {
      this.error.set(this.i18n.t('auth.google.failed'));
      return;
    }
    this.auth.signInWithGoogle(code, this.i18n.locale()).then(
      () => this.router.navigateByUrl('/', { replaceUrl: true }),
      (error: unknown) => this.error.set(errorMessage(error, this.i18n.t('auth.google.failed'))),
    );
  }
}
