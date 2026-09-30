import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, type ElementRef, afterNextRender, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { ChatService } from '../../core/chat/chat.service';
import { PageHeader } from '../../core/layout/page-header';
import { Icon, type IconName } from '../../ui/icon';
import { Logo } from '../../ui/logo';
import { BrandSwitcher } from './brand-switcher';

// Le sezioni dell'app, nell'ordine della sidebar; quelle con bottom stanno in fondo.
// Sotto l'Assistente, le ultime conversazioni; le altre in /conversazioni.
const RECENT_CHATS = 4;
const CHATS_OPEN_KEY = 'mb.chats-open';

const SECTIONS: { path: string; label: string; icon: IconName; exact: boolean; bottom?: boolean }[] = [
  { path: '/assistente', label: 'Assistente', icon: 'message-circle', exact: false },
  { path: '/', label: 'Idee', icon: 'lightbulb', exact: true },
  { path: '/contenuti', label: 'Contenuti', icon: 'file-text', exact: false },
  { path: '/impostazioni', label: 'Impostazioni brand', icon: 'settings', exact: true, bottom: true },
];

@Component({
  selector: 'mb-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, BrandSwitcher],
  // L'altezza vera della barra in alto, per le pagine che occupano lo schermo (la chat): sul telefono va su due righe.
  host: { '[style.--topbar-height.px]': 'topbarHeight()', '(document:keydown.escape)': 'menuOpen.set(false)' },
  template: `
    @if (menuOpen()) {
      <div class="scrim" (click)="menuOpen.set(false)"></div>
    }
    <aside class="sidebar" [class.open]="menuOpen()">
      <div class="brand-mark"><mb-logo /></div>
      <nav class="nav" aria-label="Sezioni">
        @for (section of sections; track section.path) {
          <div class="nav-row" [class.bottom]="section.bottom">
            <a class="nav-item" [routerLink]="section.path" routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: section.exact }" ariaCurrentWhenActive="page" [attr.title]="section.label">
              <mb-icon [name]="section.icon" [size]="20" />
              <span class="nav-label">{{ section.label }}</span>
            </a>
            @if (section.path === '/assistente') {
              <button class="expand" type="button" [class.open]="chatsOpen()" [attr.aria-expanded]="chatsOpen()"
                [attr.aria-label]="chatsOpen() ? 'Nascondi le conversazioni' : 'Mostra le conversazioni'" (click)="toggleChats()">
                <mb-icon name="chevron-down" [size]="16" />
              </button>
            }
          </div>
          @if (section.path === '/assistente' && chatsOpen() && recentChats().length > 0) {
            <div class="sessions" aria-label="Ultime conversazioni">
              @for (item of recentChats(); track item.id) {
                <a class="session" [routerLink]="['/assistente', item.id]" routerLinkActive="active" ariaCurrentWhenActive="page"
                  [attr.title]="item.title">
                  <span class="session-title">{{ item.title }}</span>
                  @if (item.busy) {
                    <span class="spinner" aria-label="Sta rispondendo"></span>
                  }
                </a>
              }
              <a class="show-all" routerLink="/conversazioni">Mostra tutte <mb-icon name="chevron-right" [size]="14" /></a>
            </div>
          }
        }
      </nav>
    </aside>
    <div class="main">
      <header class="topbar" #topbar>
        <button class="icon-btn burger" type="button" aria-label="Apri il menu" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(true)">
          <mb-icon name="menu" [size]="20" />
        </button>
        <nav class="crumbs" aria-label="Dove sei">
          @for (crumb of header.crumbs(); track $index; let last = $last) {
            @if (crumb.link && !last) {
              <a class="crumb" [routerLink]="crumb.link">{{ crumb.label }}</a>
              <mb-icon class="crumb-sep" name="chevron-right" [size]="14" />
            } @else {
              <span class="crumb" [class.current]="last" [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
            }
          }
        </nav>
        @if (header.actions(); as actions) {
          <div class="page-actions">
            <ng-container [ngTemplateOutlet]="actions" />
          </div>
        }
        <mb-brand-switcher />
      </header>
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    :host {
      --content-padding: 32px;
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
      background: var(--surface-sidebar);
      color: var(--white);
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
      min-height: 0;
    }
    .nav-row {
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .nav-row.bottom {
      margin-top: auto;
    }
    .expand {
      position: absolute;
      top: 50%;
      right: 6px;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: 0;
      border-radius: var(--radius-sm);
      background: transparent;
      color: var(--sidebar-text);
      cursor: pointer;
      transform: translateY(-50%);
    }
    .expand:hover {
      background: var(--sidebar-hover);
      color: var(--white);
    }
    .expand mb-icon {
      transform: rotate(-90deg);
      transition: transform 160ms var(--ease);
    }
    .expand.open mb-icon {
      transform: none;
    }
    .nav-row:has(.nav-item.active) .expand {
      color: var(--white);
    }
    .sessions {
      display: flex;
      flex: 0 1 auto;
      flex-direction: column;
      gap: 2px;
      min-height: 0;
      margin: 4px 0 10px;
      overflow-y: auto;
    }
    .session {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      min-height: 34px;
      padding: 0 12px;
      border-radius: var(--radius-sm);
      color: var(--sidebar-text);
      font-size: 13px;
      text-decoration: none;
      transition:
        background-color 120ms var(--ease),
        color 120ms var(--ease);
    }
    .session:hover {
      background: var(--sidebar-hover);
      color: var(--white);
    }
    .session.active {
      background: var(--surface-sidebar-active);
      color: var(--white);
    }
    .session-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .session .spinner {
      flex: none;
      width: 10px;
      height: 10px;
    }
    .show-all {
      display: inline-flex;
      align-self: center;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      padding: 5px 10px 5px 12px;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: var(--radius-sm);
      color: var(--white);
      font-size: 12px;
      text-decoration: none;
    }
    .show-all:hover {
      border-color: rgba(255, 255, 255, 0.6);
    }
    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 42px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      color: var(--sidebar-text);
      font-size: 14px;
      font-weight: 500;
      text-decoration: none;
      transition:
        background-color 120ms var(--ease),
        color 120ms var(--ease);
    }
    .nav-item:hover {
      background: var(--sidebar-hover);
      color: var(--white);
    }
    .nav-item.active {
      background: var(--surface-sidebar-active);
      color: var(--white);
      font-weight: 600;
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
      gap: 16px;
      height: var(--topbar-height);
      padding: 0 24px 0 32px;
      border-bottom: 1px solid rgba(20, 33, 61, 0.08);
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
    }
    .crumbs {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 8px;
      min-width: 0;
      font-size: 14px;
    }
    .crumb {
      flex: none;
      max-width: 50vw;
      overflow: hidden;
      color: var(--text-body);
      text-decoration: none;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    a.crumb:hover {
      color: var(--text-title);
    }
    .crumb.current {
      flex: 0 1 auto;
      color: var(--text-title);
      font-weight: 600;
    }
    .crumb-sep {
      color: var(--grey-300);
    }
    // I pulsanti della pagina, separati dal brand da una linea come nel riferimento.
    .page-actions {
      display: flex;
      flex: none;
      align-items: center;
      gap: 8px;
      padding-right: 16px;
      border-right: 1px solid rgba(20, 33, 61, 0.1);
    }
    .content {
      flex: 1;
      padding: var(--content-padding);
    }
    .burger,
    .scrim {
      display: none;
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
      .nav-label,
      .sessions,
      .expand {
        display: none;
      }
    }
    // Sul telefono la barra laterale diventa un menu che entra da sinistra, aperto dal pulsante nella barra in alto;
    // in alto restano il titolo della pagina e il brand, e i pulsanti della pagina vanno su una seconda riga.
    @media (max-width: 760px) {
      :host {
        --content-padding: 16px;
      }
      .sidebar {
        position: fixed;
        inset: 0 auto 0 0;
        z-index: 60;
        align-items: stretch;
        width: min(300px, 86vw);
        height: 100dvh;
        padding: 18px 14px;
        transform: translateX(-100%);
        transition: transform 220ms var(--ease);
      }
      .sidebar.open {
        transform: none;
        box-shadow: var(--shadow-menu);
      }
      .brand-mark {
        width: auto;
        padding: 0 10px;
      }
      .nav-item {
        justify-content: flex-start;
        width: auto;
        padding: 0 12px;
      }
      .nav-label {
        display: inline;
      }
      .sessions {
        display: flex;
      }
      .expand {
        display: grid;
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: 55;
        display: block;
        background: var(--scrim);
        animation: fade-in 160ms var(--ease);
      }
      .burger {
        display: inline-flex;
        flex: none;
        margin-left: -6px;
      }
      .topbar {
        flex-wrap: wrap;
        gap: 8px 10px;
        height: auto;
        min-height: 56px;
        padding: 8px 12px;
      }
      .crumbs {
        font-size: 15px;
      }
      // mb-icon mette il suo display sull'elemento: senza !important la freccia resterebbe.
      .crumb:not(.current),
      .crumb-sep {
        display: none !important;
      }
      .crumb.current {
        max-width: none;
      }
      .page-actions {
        order: 3;
        width: 100%;
        padding: 0 0 2px;
        border-right: 0;
        overflow-x: auto;
      }
      // Solo icone (il cestino della chat): stanno sulla prima riga, accanto al brand.
      .page-actions:not(:has(.btn)) {
        order: 0;
        width: auto;
        padding: 0;
      }
    }
  `,
})
export class Shell {
  private readonly router = inject(Router);
  protected readonly chat = inject(ChatService);
  protected readonly header = inject(PageHeader);
  protected readonly sections = SECTIONS;

  // Il menu sul telefono: si chiude cambiando pagina.
  protected readonly menuOpen = signal(false);
  protected readonly topbarHeight = signal<number | null>(null);
  private readonly topbar = viewChild.required<ElementRef<HTMLElement>>('topbar');

  // Aperta o chiusa con la freccia; la scelta resta tra una visita e l'altra.
  protected readonly chatsOpen = signal(readChatsOpen());

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  constructor() {
    effect(() => {
      this.url();
      this.menuOpen.set(false);
    });
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const element = this.topbar().nativeElement;
      const observer = new ResizeObserver(() => this.topbarHeight.set(element.offsetHeight));
      observer.observe(element);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // Le ultime conversazioni, più quella aperta se è più vecchia: si vede sempre dove si è.
  protected readonly recentChats = computed(() => {
    const all = this.chat.conversations();
    const recent = all.slice(0, RECENT_CHATS);
    const openId = /^\/assistente\/([^/?#]+)/.exec(this.url())?.[1];
    const open = all.find((item) => item.id === openId);
    return open && !recent.includes(open) ? [...recent, open] : recent;
  });

  protected toggleChats(): void {
    this.chatsOpen.update((open) => !open);
    try {
      localStorage.setItem(CHATS_OPEN_KEY, this.chatsOpen() ? '1' : '0');
    } catch {
      // Senza storage la scelta vale finché la pagina resta aperta.
    }
  }
}

function readChatsOpen(): boolean {
  try {
    return localStorage.getItem(CHATS_OPEN_KEY) !== '0';
  } catch {
    return true;
  }
}
