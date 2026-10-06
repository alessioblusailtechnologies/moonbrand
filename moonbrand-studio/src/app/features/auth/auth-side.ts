import { ChangeDetectionStrategy, Component } from '@angular/core';

import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Logo } from '../../ui/logo';

@Component({
  selector: 'mb-auth-side',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Logo, TranslatePipe],
  template: `
    <mb-logo />
    <div class="claim-block">
      <p class="claim">{{ 'auth.side.claim' | t }}</p>
      <p class="note">{{ 'auth.side.note' | t }}</p>
    </div>
    <span class="moon" aria-hidden="true"></span>
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 48px;
      padding: 40px;
      overflow: hidden;
      color: var(--white);
    }
    .claim-block {
      position: relative;
      z-index: 1;
      max-width: 440px;
      margin-top: 12vh;
    }
    .claim {
      font-size: 36px;
      font-weight: 700;
      line-height: 1.12;
      letter-spacing: -0.02em;
    }
    .note {
      margin-top: 16px;
      color: rgba(255, 255, 255, 0.72);
      font-size: 15px;
    }
    // La luna del logo in grande, che sorge dall'angolo: la parte in ombra è il blu della cornice.
    .moon {
      position: absolute;
      right: -120px;
      bottom: -120px;
      width: 480px;
      height: 480px;
      overflow: hidden;
      border-radius: 50%;
      background: var(--accent);
      box-shadow: 0 0 120px rgba(242, 154, 46, 0.25);
      animation: fade-up 480ms var(--ease) both;
    }
    .moon::after {
      position: absolute;
      top: -55px;
      left: -129px;
      width: 406px;
      height: 406px;
      border-radius: 50%;
      background: var(--surface-sidebar);
      content: '';
    }
  `,
})
export class AuthSide {}
