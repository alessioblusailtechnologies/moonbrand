import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Icon, type IconName } from '../../ui/icon';
import { Logo } from '../../ui/logo';
import { BrandSwitcher } from './brand-switcher';

// Le sezioni dell'app, nell'ordine della sidebar; quelle con bottom stanno in fondo.
const SECTIONS: { path: string; label: string; icon: IconName; exact: boolean; bottom?: boolean }[] = [
  { path: '/', label: 'Idee', icon: 'lightbulb', exact: true },
  { path: '/contenuti', label: 'Contenuti', icon: 'file-text', exact: false },
  { path: '/impostazioni', label: 'Impostazioni brand', icon: 'settings', exact: true, bottom: true },
];

@Component({
  selector: 'mb-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, BrandSwitcher],
  template: `
    <aside class="sidebar">
      <div class="brand-mark"><mb-logo /></div>
      <nav class="nav" aria-label="Sezioni">
        @for (section of sections; track section.path) {
          <a class="nav-item" [class.bottom]="section.bottom" [routerLink]="section.path" routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: section.exact }" ariaCurrentWhenActive="page" [attr.title]="section.label">
            <mb-icon [name]="section.icon" [size]="20" />
            <span class="nav-label">{{ section.label }}</span>
          </a>
        }
      </nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <mb-brand-switcher />
      </header>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      min-height: 100vh;
    }
    .sidebar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex: none;
      flex-direction: column;
      gap: 24px;
      width: 232px;
      height: 100vh;
      padding: 18px 14px;
      border-right: 1px solid rgba(47, 52, 82, 0.08);
      background: var(--surface-card);
    }
    .brand-mark {
      display: flex;
      align-items: center;
      height: 28px;
      padding: 0 10px;
      overflow: hidden;
    }
    .nav {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 4px;
    }
    .nav-item.bottom {
      margin-top: auto;
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 42px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      color: var(--text-body);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition:
        background-color 120ms var(--ease),
        color 120ms var(--ease);
    }
    .nav-item:hover {
      background: var(--surface-sunken);
      color: var(--text-title);
    }
    .nav-item.active {
      background: var(--navy-700);
      color: var(--white);
    }
    .main {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: flex-end;
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
    @media (max-width: 900px) {
      .sidebar {
        width: 68px;
        padding: 18px 10px;
        align-items: center;
      }
      .brand-mark {
        width: 32px;
        padding: 0;
      }
      .nav-item {
        justify-content: center;
        width: 44px;
        padding: 0;
      }
      .nav-label {
        display: none;
      }
    }
  `,
})
export class Shell {
  protected readonly sections = SECTIONS;
}
