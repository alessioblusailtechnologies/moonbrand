import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Logo } from '../../ui/logo';
import { BrandSwitcher } from './brand-switcher';

@Component({
  selector: 'mb-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Logo, BrandSwitcher],
  template: `
    <header class="topbar">
      <mb-logo />
      <mb-brand-switcher />
    </header>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      height: var(--topbar-height);
      padding: 0 24px;
      border-bottom: 1px solid rgba(47, 52, 82, 0.08);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(12px);
    }
    .content {
      flex: 1;
      padding: 32px 24px;
    }
  `,
})
export class Shell {}
