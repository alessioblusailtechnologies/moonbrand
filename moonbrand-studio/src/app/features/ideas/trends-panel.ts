import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { Router } from '@angular/router';

import type { TrendsResponse } from '@moonbrand/shared/api/contract';
import { TIKTOK_PLAYER_ORIGIN, trendEmbedUrl, type Trend, type TrendPlatform, type TrendSearchSummary, TREND_SEARCH } from '@moonbrand/shared/domain/trend';

import { BrandsService } from '../../core/brands/brands.service';
import { ChatService } from '../../core/chat/chat.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrendsService } from '../../core/trends/trends.service';
import { ChannelMark } from '../../ui/channel-mark';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { lockPageScroll } from '../../ui/scroll-lock';
import { ToastService } from '../../ui/toast';

type Filter = 'all' | TrendPlatform;

const PLATFORM_NAMES: Record<TrendPlatform, string> = { tiktok: 'TikTok', instagram: 'Instagram' };

// I video di tendenza delle ricerche del brand (una parola chiave alla volta, su TikTok e Instagram): copertine in griglia, al clic il player ufficiale del social (niente
// iframe per card, si caricherebbero tutti insieme) e Ricrea, che apre la chat con il video come riferimento.
@Component({
  selector: 'mb-trends-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ChannelMark, Icon, Loader, TranslatePipe],
  host: { '(document:keydown.escape)': 'creating() || close()', '(window:message)': 'onMessage($event)' },
  template: `
    <form class="search" role="search" (submit)="$event.preventDefault(); search()">
      <div class="field search-field">
        <label for="trend-search">{{ 'ideas.trends.searchLabel' | t }}</label>
        <div class="field-row">
          <input id="trend-search" type="search" maxlength="80" autocomplete="off" enterkeyhint="search"
            [placeholder]="'ideas.trends.searchPlaceholder' | t" [value]="query()" [disabled]="searching()"
            (input)="query.set($any($event.target).value)" />
          <button class="btn btn-primary btn-sm" type="submit" [disabled]="searching() || query().trim().length < 2">
            {{ (searching() ? 'ideas.trends.searching' : 'ideas.trends.search') | t }}
          </button>
        </div>
      </div>
    </form>

    <div class="head">
      <p class="caption">
        {{ 'ideas.trends.hint' | t }}
        <!-- Prima le ricerche gratis del mese, poi quanto costa ognuna; il tetto del giorno solo quando si avvicina. -->
        @if (free() > 0) {
          {{ 'ideas.trends.freeLeft' | t: { n: free() } }}
        } @else {
          {{ 'ideas.trends.paid' | t: { n: searchCredits } }}
        }
        @if (left() <= 5) {
          {{ 'ideas.trends.searchLeft' | t: { n: left() } }}
        }
      </p>
      <div class="chips" role="group" [attr.aria-label]="'ideas.trends.filter' | t">
        @for (option of filters; track option) {
          <button class="chip" type="button" [class.selected]="filter() === option" (click)="filter.set(option)">
            {{ option === 'all' ? ('ideas.trends.all' | t) : platformName(option) }}
          </button>
        }
      </div>
    </div>

    @if (searches().length > 1) {
      <!-- Le parole cercate: una mostra solo i suoi video. -->
      <div class="chips queries" role="group" [attr.aria-label]="'ideas.trends.searches' | t">
        <button class="chip" type="button" [class.selected]="selectedQuery() === null" (click)="selectedQuery.set(null)">
          {{ 'ideas.trends.allSearches' | t }}
        </button>
        @for (item of searches(); track item.query) {
          <button class="chip" type="button" [class.selected]="selectedQuery() === item.query" (click)="selectedQuery.set(item.query)">
            {{ item.query }} <span class="count">{{ item.count }}</span>
          </button>
        }
      </div>
    }

    @if (loading() || searching()) {
      <div class="empty"><mb-loader /></div>
    } @else if (trends().length === 0) {
      <div class="empty">
        <p class="strong-sm">{{ 'ideas.trends.none' | t }}</p>
        <p class="caption">{{ 'ideas.trends.noneHint' | t }}</p>
      </div>
    } @else if (visible().length === 0) {
      <div class="empty">
        @if (selectedQuery(); as query) {
          <p class="strong-sm">{{ 'ideas.trends.searchNone' | t: { query } }}</p>
          <p class="caption">{{ 'ideas.trends.searchNoneHint' | t }}</p>
        } @else {
          <p class="strong-sm">{{ 'ideas.trends.filterNone' | t }}</p>
        }
      </div>
    } @else {
      <ng-container [ngTemplateOutlet]="grid" />
    }

    <ng-template #grid>
      <div class="grid">
        @for (trend of visible(); track trend.id) {
          <button class="card" type="button" [attr.aria-label]="'ideas.trends.open' | t: { author: trend.author }" (click)="open(trend)">
            <span class="cover">
              @if (trend.thumbnailUrl) {
                <img [src]="trend.thumbnailUrl" alt="" loading="lazy" />
              } @else {
                <span class="caption-cover">{{ trend.caption }}</span>
              }
              <span class="platform"><mb-channel-mark [channel]="trend.platform" [active]="true" [size]="16" /></span>
              @if (trend.durationSeconds) {
                <span class="duration">{{ duration(trend.durationSeconds) }}</span>
              }
              <span class="play"><mb-icon name="play" [size]="22" /></span>
            </span>
            <span class="info">
              <span class="numbers caption">
                @if (trend.views !== null) {
                  <span><mb-icon name="eye" [size]="13" />{{ compact(trend.views) }}</span>
                }
                @if (trend.likes !== null) {
                  <span><mb-icon name="heart" [size]="13" />{{ compact(trend.likes) }}</span>
                }
              </span>
              <span class="author strong-sm">&#64;{{ trend.author }}</span>
              <span class="text caption">{{ trend.caption }}</span>
            </span>
          </button>
        }
      </div>
    </ng-template>

    @if (playing(); as trend) {
      <div class="backdrop" (click)="creating() || close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="'ideas.trends.open' | t: { author: trend.author }">
        <div class="player">
          @if (trend.thumbnailUrl && !ready()) {
            <img class="poster" [src]="trend.thumbnailUrl" alt="" />
          }
          @if (failed()) {
            <div class="fallback">
              <p class="caption">{{ 'ideas.trends.playerError' | t: { platform: platformName(trend.platform) } }}</p>
              <a class="btn btn-primary" [href]="trend.url" target="_blank" rel="noopener noreferrer">
                <mb-icon name="play" [size]="16" />{{ 'ideas.trends.watchOn' | t: { platform: platformName(trend.platform) } }}
              </a>
            </div>
          } @else {
            @if (!ready()) {
              <span class="wait"><mb-loader /></span>
            }
            <iframe #frame [src]="embed()" [class.ready]="ready()" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowfullscreen [title]="platformName(trend.platform)" (load)="loaded(trend)"></iframe>
          }
        </div>
        <div class="side">
          <div class="stack">
            <div class="row">
              <mb-channel-mark [channel]="trend.platform" [active]="true" [size]="18" />
              <span class="strong-sm">&#64;{{ trend.author }}</span>
              <button class="icon-btn close" type="button" [attr.aria-label]="'common.close' | t" [disabled]="creating()" (click)="close()">
                <mb-icon name="x" [size]="18" />
              </button>
            </div>
            <p class="caption numbers">
              @if (trend.views !== null) {
                <span>{{ 'ideas.trends.views' | t: { n: compact(trend.views) } }}</span>
              }
              @if (trend.likes !== null) {
                <span>{{ 'ideas.trends.likes' | t: { n: compact(trend.likes) } }}</span>
              }
              @if (trend.music) {
                <span><mb-icon name="music" [size]="13" />{{ trend.music }}</span>
              }
            </p>
            <p class="body description">{{ trend.caption }}</p>
            <a class="link-btn caption" [href]="trend.url" target="_blank" rel="noopener noreferrer">
              {{ 'ideas.trends.openOn' | t: { platform: platformName(trend.platform) } }}
            </a>
          </div>
          <div class="stack">
            <div class="field note">
              <label for="trend-note">{{ 'ideas.trends.noteLabel' | t }}</label>
              <textarea id="trend-note" rows="3" [placeholder]="'ideas.trends.notePlaceholder' | t" [value]="note()"
                [disabled]="creating()" (input)="note.set($any($event.target).value)"></textarea>
            </div>
            <p class="caption">{{ 'ideas.trends.recreateHint' | t }}</p>
            <button class="btn btn-primary" type="button" [disabled]="creating()" (click)="recreate(trend)">
              {{ (creating() ? 'ideas.trends.preparing' : 'ideas.trends.recreate') | t }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .head .caption,
    .head .strong-sm {
      margin: 0;
    }
    .search-field {
      border-color: var(--border-card);
    }
    .search-field input {
      flex: 1;
      min-width: 0;
    }
    .queries {
      flex-wrap: wrap;
    }
    .count {
      margin-left: 4px;
      opacity: 0.6;
    }
    .chips {
      display: flex;
      gap: 6px;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 16px;
      text-align: center;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 16px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .cover {
      position: relative;
      display: block;
      overflow: hidden;
      aspect-ratio: 9 / 16;
      border-radius: var(--radius-lg);
      background: var(--grey-100);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: transform 200ms var(--ease);
    }
    .card:hover .cover img {
      transform: scale(1.03);
    }
    .caption-cover {
      display: -webkit-box;
      overflow: hidden;
      padding: 16px;
      font-size: 13px;
      -webkit-line-clamp: 12;
      -webkit-box-orient: vertical;
    }
    .platform,
    .duration {
      position: absolute;
      top: 8px;
      display: inline-flex;
      align-items: center;
      padding: 4px 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      font-size: 11px;
      font-weight: 600;
    }
    .platform {
      left: 8px;
    }
    .duration {
      right: 8px;
    }
    .play {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--white);
      opacity: 0;
      background: rgba(0, 0, 0, 0.18);
      transition: opacity 160ms var(--ease);
    }
    .card:hover .play,
    .card:focus-visible .play {
      opacity: 1;
    }
    .info {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .numbers {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
    }
    .numbers span {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .author {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: var(--scrim);
      animation: fade-in 160ms var(--ease);
    }
    .dialog {
      position: fixed;
      top: 50%;
      left: 50%;
      z-index: 71;
      display: flex;
      gap: 20px;
      width: min(820px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow-y: auto;
      padding: 20px;
      border-radius: var(--radius-lg);
      background: var(--surface-card);
      box-shadow: var(--shadow-menu);
      transform: translate(-50%, -50%);
      animation: dialog-in 180ms var(--ease);
    }
    .player {
      flex: none;
      width: min(340px, 100%);
      aspect-ratio: 9 / 16;
      max-height: calc(100vh - 72px);
      overflow: hidden;
      border-radius: var(--radius-md, 12px);
      background: #000;
    }
    .player {
      position: relative;
    }
    .player iframe {
      width: 100%;
      height: 100%;
      border: 0;
      opacity: 0;
      transition: opacity 160ms var(--ease);
      &.ready {
        opacity: 1;
      }
    }
    .poster {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fallback {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
      padding: 24px 16px;
      color: #fff;
      text-align: center;
      background: linear-gradient(to top, rgb(0 0 0 / 85%), rgb(0 0 0 / 0%) 60%);
      .caption {
        margin: 0;
        color: #fff;
      }
      .btn {
        gap: 6px;
      }
    }
    .wait {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: #fff;
    }
    .side {
      display: flex;
      flex: 1;
      flex-direction: column;
      justify-content: space-between;
      gap: 20px;
      min-width: 0;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .close {
      margin-left: auto;
    }
    .description {
      max-height: 200px;
      overflow-y: auto;
      margin: 0;
      white-space: pre-line;
    }
    .note {
      border-color: var(--border-card);
    }
    @media (max-width: 720px) {
      .dialog {
        flex-direction: column;
        align-items: center;
      }
      .side {
        width: 100%;
      }
    }
  `,
})
export class TrendsPanel {
  private readonly api = inject(TrendsService);
  private readonly brands = inject(BrandsService);
  private readonly chat = inject(ChatService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly filters: Filter[] = ['all', 'tiktok', 'instagram'];
  protected readonly filter = signal<Filter>('all');
  protected readonly trends = signal<Trend[]>([]);
  protected readonly searches = signal<TrendSearchSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly playing = signal<Trend | null>(null);
  protected readonly note = signal('');
  protected readonly creating = signal(false);

  // La ricerca per parola chiave: la parola cercata diventa il filtro scelto, con i suoi video.
  protected readonly query = signal('');
  protected readonly searching = signal(false);
  protected readonly selectedQuery = signal<string | null>(null);
  protected readonly left = signal<number>(TREND_SEARCH.perDay);
  protected readonly free = signal<number>(TREND_SEARCH.freePerMonth);
  protected readonly searchCredits = TREND_SEARCH.credits;

  protected readonly visible = computed(() => {
    const filter = this.filter();
    const query = this.selectedQuery();
    return this.trends().filter((trend) => query === null || trend.query === query).filter((trend) => filter === 'all' || trend.platform === filter);
  });
  // Il player resta coperto dalla copertina finché non è pronto. Il player di TikTok va spesso in errore appena aperto
  // (2001: la prima richiesta parte senza device_id, che dentro un iframe non ha il cookie per farselo) e da fuori non
  // si può far ripartire: allora resta la copertina, con il tasto per guardarlo su TikTok.
  protected readonly ready = signal(false);
  protected readonly failed = signal(false);
  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private reveal: ReturnType<typeof setTimeout> | undefined;

  protected readonly embed = computed(() => {
    const trend = this.playing();
    return trend ? this.sanitizer.bypassSecurityTrustResourceUrl(trendEmbedUrl(trend)) : null;
  });

  constructor() {
    lockPageScroll(() => this.playing() !== null);
    inject(DestroyRef).onDestroy(() => clearTimeout(this.reveal));
    effect(() => {
      const brand = this.brands.activeBrand();
      if (brand) untracked(() => {
        this.selectedQuery.set(null);
        void this.load(brand.id);
      });
    });
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    try {
      const response = await this.api.list(brandId);
      if (this.brands.activeBrand()?.id !== brandId) return;
      this.show(response);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ideas.trends.loadError')));
    } finally {
      this.loading.set(false);
    }
  }

  protected async search(): Promise<void> {
    const brand = this.brands.activeBrand();
    const query = this.query().trim();
    if (!brand || this.searching() || query.length < 2) return;
    this.searching.set(true);
    try {
      const response = await this.api.search(brand.id, query);
      if (this.brands.activeBrand()?.id !== brand.id) return;
      this.show(response);
      this.selectedQuery.set(response.query);
      this.query.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ideas.trends.searchError')));
    } finally {
      this.searching.set(false);
    }
  }

  private show(response: TrendsResponse): void {
    this.searches.set(response.searches);
    this.trends.set(response.trends);
    this.left.set(response.left);
    this.free.set(response.free);
  }

  protected platformName(platform: TrendPlatform): string {
    return PLATFORM_NAMES[platform];
  }

  protected compact(value: number): string {
    return new Intl.NumberFormat(this.i18n.intl(), { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  protected duration(seconds: number): string {
    const total = Math.round(seconds);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  protected open(trend: Trend): void {
    this.note.set('');
    this.ready.set(false);
    this.failed.set(false);
    this.playing.set(trend);
  }

  protected close(): void {
    clearTimeout(this.reveal);
    this.playing.set(null);
  }

  // Instagram non manda segnali: si mostra appena caricato. TikTok l'errore lo dice subito dopo il caricamento, quindi
  // si aspetta un attimo prima di scoprirlo; se arriva prima, onMessage lo segna e resta la copertina.
  protected loaded(trend: Trend): void {
    clearTimeout(this.reveal);
    if (trend.platform !== 'tiktok') return this.ready.set(true);
    this.reveal = setTimeout(() => this.ready.set(true), 1500);
  }

  // I messaggi del player/v1 di TikTok: { 'x-tiktok-player': true, type, value }. Servono solo per l'errore.
  protected onMessage(event: MessageEvent): void {
    const frame = this.frame()?.nativeElement.contentWindow;
    if (event.origin !== TIKTOK_PLAYER_ORIGIN || !frame || event.source !== frame) return;
    let data: unknown = event.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch {
        return;
      }
    }
    const message = data as { 'x-tiktok-player'?: boolean; type?: string } | null;
    if (!message?.['x-tiktok-player']) return;
    if (message.type === 'onError' || message.type === 'onPlayerError') {
      clearTimeout(this.reveal);
      this.ready.set(false);
      this.failed.set(true);
    }
  }

  // La conversazione nuova parte dal video: l'API ne prepara il riferimento (il video o la copertina tra gli allegati)
  // e Claude lo riceve con i suoi numeri. Le indicazioni dell'utente seguono la richiesta.
  protected async recreate(trend: Trend): Promise<void> {
    const brand = this.brands.activeBrand();
    if (!brand || this.creating()) return;
    this.creating.set(true);
    try {
      const note = this.note().trim();
      const ask = this.i18n.t('ideas.trends.ask', { platform: this.platformName(trend.platform) });
      const message = note ? `${ask} ${note.charAt(0).toUpperCase()}${note.slice(1)}` : ask;
      const { conversationId } = await this.chat.start(brand.id, { message, trendId: trend.id });
      this.playing.set(null);
      void this.chat.refresh();
      await this.router.navigate(['/assistente', conversationId]);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('ideas.trends.chatError')));
    } finally {
      this.creating.set(false);
    }
  }
}
