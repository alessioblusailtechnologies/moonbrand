import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { BillingService } from '../../core/billing/billing.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';
import { AuthSide } from '../auth/auth-side';

// La pagina dei link di Paddle (il «Default payment link» dell'account): le email per aggiornare la carta o pagare un
// rinnovo non riuscito portano qui con _ptxn nell'indirizzo, e Paddle.js apre da solo il checkout di quella transazione.
// Si apre anche senza essere dentro lo studio.
@Component({
  selector: 'mb-billing-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, AuthSide, Logo, TranslatePipe],
  styleUrl: '../auth/auth-layout.scss',
  template: `
    <mb-auth-side />
    <main class="main">
      <mb-logo class="mobile-logo" />
      <div class="form" aria-live="polite">
        <div class="head">
          <h1 class="title">{{ 'plans.linkTitle' | t }}</h1>
          <p class="body">{{ (failed() ? 'plans.linkFailed' : 'plans.linkBody') | t }}</p>
        </div>
        <a class="btn btn-primary btn-lg btn-block submit" routerLink="/">
          {{ (auth.signedIn() ? 'auth.confirm.toStudio' : 'auth.confirm.signIn') | t }}
        </a>
      </div>
    </main>
  `,
})
export class BillingLink {
  protected readonly auth = inject(AuthService);
  protected readonly failed = signal(false);

  constructor() {
    inject(BillingService)
      .load()
      .catch(() => this.failed.set(true));
  }
}
