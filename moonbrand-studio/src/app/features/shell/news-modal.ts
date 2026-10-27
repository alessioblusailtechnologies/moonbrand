import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { AuthService } from '../../core/auth/auth.service';
import { BillingService } from '../../core/billing/billing.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon, type IconName } from '../../ui/icon';

interface NewsItem {
  icon: IconName;
  title: MessageKey;
  body: MessageKey;
}

// Le novità del rilascio (LATEST_NEWS nel contratto, testi in i18n/messages/news.ts): una volta per account, finché non
// si chiude. Non si apre sopra l'onboarding, sopra l'esito di un pagamento né a chi guarda un'utenza da admin.
const ITEMS: NewsItem[] = [
  { icon: 'music', title: 'news.music.title', body: 'news.music.body' },
  { icon: 'pen', title: 'news.edits.title', body: 'news.edits.body' },
];

@Component({
  selector: 'mb-news-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  host: { '(document:keydown.escape)': 'close()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="news-title">
        <button class="icon-btn close" type="button" [attr.aria-label]="'news.close' | t" (click)="close()">
          <mb-icon name="x" [size]="18" />
        </button>
        <span class="mark"><mb-icon name="sparkle" [size]="26" [stroke]="2" /></span>
        <p class="label">{{ 'news.label' | t }}</p>
        <h2 id="news-title" class="dialog-title">{{ 'news.title' | t }}</h2>
        <ul class="items">
          @for (item of items; track item.title) {
            <li>
              <span class="item-icon"><mb-icon [name]="item.icon" [size]="20" /></span>
              <div>
                <h3>{{ item.title | t }}</h3>
                <p>{{ item.body | t }}</p>
              </div>
            </li>
          }
        </ul>
        <button class="btn btn-primary btn-block" type="button" (click)="close()">{{ 'news.ok' | t }}</button>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 95;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 96;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      width: min(440px, calc(100vw - 32px));
      max-height: calc(100dvh - 48px);
      padding: 32px 28px 28px;
      overflow-y: auto;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      text-align: center;
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .close {
      position: absolute;
      top: 12px;
      right: 12px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 56px;
      height: 56px;
      margin-bottom: 4px;
      border-radius: 50%;
      background: var(--accent-soft);
      color: var(--text-title);
    }
    .label {
      margin: 0;
      color: var(--accent);
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .dialog-title {
      margin: 0;
      color: var(--text-title);
      font-size: 20px;
      font-weight: 600;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 16px;
      width: 100%;
      margin: 12px 0 16px;
      padding: 0;
      list-style: none;
      text-align: left;
    }
    .items li {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .item-icon {
      display: grid;
      flex: none;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-md);
      background: var(--grey-100);
      color: var(--text-title);
    }
    h3 {
      margin: 0 0 2px;
      color: var(--text-title);
      font-size: 15px;
      font-weight: 600;
    }
    .items p {
      margin: 0;
    }
  `,
})
export class NewsModal {
  private readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);
  private readonly router = inject(Router);

  protected readonly items = ITEMS;
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly open = computed(
    () => this.auth.account()?.newsSeen === false && !this.auth.viewingAs() && !this.billing.payment() && !this.url().includes('onboarding'),
  );

  protected close(): void {
    if (this.open()) void this.auth.markNewsSeen();
  }
}
