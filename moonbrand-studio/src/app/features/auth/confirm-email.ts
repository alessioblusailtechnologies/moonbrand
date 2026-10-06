import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from './auth-side';

type State = 'checking' | 'done' | 'failed';

// Dal link dell'email di benvenuto. Si apre anche senza essere dentro: il token basta a confermare.
@Component({
  selector: 'mb-confirm-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: './auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <div class="form" aria-live="polite">
        @switch (state()) {
          @case ('checking') {
            <div class="head">
              <h1 class="title">{{ 'auth.confirm.checking' | t }}</h1>
            </div>
          }
          @case ('done') {
            <div class="head">
              <h1 class="title">{{ 'auth.confirm.doneTitle' | t }}</h1>
              <p class="body">{{ 'auth.confirm.done' | t }}</p>
            </div>
            <a class="btn btn-primary btn-lg btn-block submit" routerLink="/">
              {{ (auth.signedIn() ? 'auth.confirm.toStudio' : 'auth.confirm.signIn') | t }}
            </a>
          }
          @case ('failed') {
            <div class="head">
              <h1 class="title">{{ 'auth.confirm.failedTitle' | t }}</h1>
              <p class="body">{{ 'auth.confirm.failed' | t }}</p>
            </div>
            @if (notice()) {
              <p [class]="resent() ? 'notice' : 'error'" role="alert">{{ notice() }}</p>
            }
            @if (auth.signedIn()) {
              <button class="btn btn-primary btn-lg btn-block submit" type="button" [class.busy]="busy()" [disabled]="busy() || resent()"
                (click)="resend()">
                {{ 'auth.confirm.resend' | t }}
              </button>
            } @else {
              <p class="body">{{ 'auth.confirm.signInToResend' | t }}</p>
              <a class="btn btn-primary btn-lg btn-block submit" routerLink="/login">{{ 'auth.confirm.signIn' | t }}</a>
            }
          }
        }
      </div>
    </main>
  `,
})
export class ConfirmEmail {
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  protected readonly state = signal<State>('checking');
  protected readonly busy = signal(false);
  protected readonly resent = signal(false);
  protected readonly notice = signal('');

  constructor() {
    const token = inject(ActivatedRoute).snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('failed');
      return;
    }
    this.auth.confirmEmail(token).then(
      () => this.state.set('done'),
      () => this.state.set('failed'),
    );
  }

  protected async resend(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await this.auth.resendConfirmation();
      this.resent.set(true);
      this.notice.set(this.i18n.t('auth.confirm.resent'));
    } catch (error) {
      this.notice.set(errorMessage(error, this.i18n.t('shell.emailBanner.failed')));
    } finally {
      this.busy.set(false);
    }
  }
}
