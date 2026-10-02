import { ChangeDetectionStrategy, Component, type ElementRef, type TemplateRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChatService } from '../../core/chat/chat.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { Icon } from '../../ui/icon';

// Tutte le conversazioni del brand: la sidebar mostra solo le ultime. Ci porta anche ⌘K, quindi si comincia dalla ricerca.
@Component({
  selector: 'mb-conversations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TranslatePipe],
  template: `
    <section class="conversations">
      <input
        #searchField
        class="sunken"
        type="search"
        [attr.aria-label]="'shell.searchChats' | t"
        [placeholder]="'chat.conversations.searchPlaceholder' | t"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
      />

      <div class="panel list">
        @for (item of visible(); track item.id) {
          <a class="row" [routerLink]="['/assistente', item.id]">
            <mb-icon name="message-circle" [size]="16" />
            <span class="strong-sm row-title">{{ item.title }}</span>
            @if (item.busy) {
              <span class="caption busy"><span class="spinner"></span> {{ 'chat.conversations.replying' | t }}</span>
            } @else {
              <span class="caption">{{ when(item.updatedAt) }}</span>
            }
          </a>
        } @empty {
          <p class="caption empty">
            {{ (search() ? 'chat.conversations.noMatch' : 'chat.conversations.none') | t }}
          </p>
        }
      </div>
    </section>

    <ng-template #headerActions>
      <a class="btn btn-secondary btn-sm new" routerLink="/assistente">
        <mb-icon name="plus" [size]="16" /> {{ 'chat.conversations.new' | t }}
      </a>
    </ng-template>
  `,
  styles: `
    .conversations {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .new {
      gap: 6px;
      text-decoration: none;
    }
    .list {
      gap: 2px;
      padding: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: 48px;
      padding: 0 12px;
      border-radius: var(--radius-md);
      color: var(--text-title);
      text-decoration: none;
    }
    .row:hover {
      background: var(--surface-sunken);
    }
    .row-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .busy {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .busy .spinner {
      width: 10px;
      height: 10px;
    }
    .empty {
      padding: 24px 12px;
      text-align: center;
    }
  `,
})
export class ConversationsPage {
  private readonly chat = inject(ChatService);
  private readonly i18n = inject(I18nService);

  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  private readonly searchField = viewChild.required<ElementRef<HTMLInputElement>>('searchField');
  protected readonly search = signal('');
  protected readonly visible = computed(() => {
    const words = this.search().trim().toLowerCase();
    const all = this.chat.conversations();
    return words ? all.filter((item) => item.title.toLowerCase().includes(words)) : all;
  });

  constructor() {
    pageHeader(
      () => [{ label: this.i18n.t('shell.assistant'), link: '/assistente' }, { label: this.i18n.t('chat.conversations.all') }],
      () => this.headerActions(),
    );
    void this.chat.refresh();
    afterNextRender(() => this.searchField().nativeElement.focus());
  }

  protected when(date: string): string {
    const value = new Date(date);
    return value.toDateString() === new Date().toDateString()
      ? value.toLocaleTimeString(this.i18n.intl(), { hour: '2-digit', minute: '2-digit' })
      : value.toLocaleDateString(this.i18n.intl(), { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
