import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  type TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Icon } from '../../ui/icon';

import type { ContentSummary } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { formatWeekdayShort } from '@moonbrand/shared/lib/dates';

import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { ToastService } from '../../ui/toast';
import { cssAspect, formatLabel, stateTone, statusLabel } from './labels';

// Mentre un contenuto si prepara, l'elenco si aggiorna da solo.
const REFRESH_MS = 5000;

// La griglia masonry: colonne di almeno COLUMN_MIN px; ogni card va nella colonna più corta, così le copertine
// restano intere in ogni proporzione (un Reel 9:16 accanto a un post 4:5) e l'ordine si legge per righe.
// Sul telefono comunque due colonne, più strette: una card per schermata costringerebbe a scorrere troppo.
const COLUMN_MIN = 240;
const PHONE_COLUMNS = 2;
const PHONE_WIDTH = 300;
const GAP = 16;
// L'altezza della card oltre la copertina (badge, titolo, canali), in proporzione alla larghezza: basta per scegliere la colonna.
const CARD_TEXT = 0.55;

function aspectRatio(aspect: string | null): number {
  const [width, height] = (aspect ?? '4:5').split(':').map(Number);
  return width > 0 && height > 0 ? height / width : 1.25;
}

@Component({
  selector: 'mb-contents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TranslatePipe],
  template: `
    @if (brands.activeBrand()) {
      <section class="contents">
        @if (loading()) {
          <div class="empty"><span class="spinner"></span></div>
        } @else if (contents().length === 0) {
          <div class="empty">
            <p class="strong-sm">{{ 'contents.list.empty' | t }}</p>
            <p class="caption">{{ 'contents.list.emptyHint' | t }}</p>
          </div>
        } @else {
          <div class="grid" #grid>
            @for (column of columns(); track $index) {
              <div class="column">
                @for (content of column; track content.id) {
                  <a class="panel card" [routerLink]="['/contenuti', content.id]">
                    <div class="cover" [style.aspect-ratio]="cssAspect(content.coverAspect ?? '4:5')">
                      @if (content.coverUrl) {
                        <img [src]="content.coverUrl" alt="" loading="lazy" />
                        @if (content.format === 'video') {
                          <span class="play"><mb-icon name="play" [size]="18" /></span>
                        }
                      } @else if (content.format === 'video') {
                        <span class="caption">{{ (content.preparing ? 'contents.list.preparingVideo' : 'contents.list.noVideo') | t }}</span>
                      } @else {
                        <span class="caption">{{ (content.preparing ? 'contents.list.preparingPost' : 'contents.list.noImage') | t }}</span>
                      }
                    </div>
                    <div class="meta">
                      <span class="badge">{{ formatLabel(content) }}</span>
                      @if (content.preparing) {
                        <span class="badge">{{ 'contents.list.preparing' | t }}</span>
                      } @else {
                        <span class="badge" [class]="stateTone(content.state)">{{ statusLabel(content) }}</span>
                      }
                    </div>
                    <h2 class="strong">{{ content.title }}</h2>
                    <p class="caption">{{ channelsLabel(content) }}</p>
                  </a>
                }
              </div>
            }
          </div>
        }
      </section>
    }

    <ng-template #headerActions>
      <a class="btn btn-secondary btn-sm from-idea" routerLink="/">{{ 'contents.list.fromIdea' | t }}</a>
    </ng-template>
  `,
  styles: `
    .contents {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .from-idea {
      text-decoration: none;
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
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }
    .column {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 16px;
      min-width: 0;
    }
    .card {
      gap: 10px;
      padding: 12px;
      color: inherit;
      text-decoration: none;
      transition: transform 120ms var(--ease);
    }
    .card:hover {
      transform: translateY(-2px);
    }
    .cover {
      display: grid;
      place-items: center;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .cover {
      position: relative;
    }
    .play {
      position: absolute;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.92);
      color: var(--primary);
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    @media (max-width: 640px) {
      .grid,
      .column {
        gap: 10px;
      }
      .card {
        gap: 8px;
        padding: 8px;
      }
      .play {
        width: 36px;
        height: 36px;
      }
    }
    .strong {
      margin: 0;
    }
    .caption {
      margin: 0;
    }
  `,
})
export class ContentsPage {
  private readonly api = inject(ContentsService);
  private readonly toast = inject(ToastService);
  protected readonly brands = inject(BrandsService);
  private readonly i18n = inject(I18nService);

  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  protected readonly contents = signal<ContentSummary[]>([]);
  protected readonly loading = signal(true);
  private readonly preparing = computed(() => this.contents().some((content) => content.preparing));
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  private readonly columnCount = signal(1);
  protected readonly cssAspect = cssAspect;
  protected readonly stateTone = stateTone;

  // Le card nella colonna più corta, nell'ordine dell'elenco.
  protected readonly columns = computed(() => {
    const count = this.columnCount();
    const columns: ContentSummary[][] = Array.from({ length: count }, () => []);
    const heights = new Array<number>(count).fill(0);
    for (const content of this.contents()) {
      const shortest = heights.indexOf(Math.min(...heights));
      columns[shortest].push(content);
      heights[shortest] += aspectRatio(content.coverAspect) + CARD_TEXT;
    }
    return columns;
  });

  constructor() {
    pageHeader(
      () => [{ label: this.i18n.t('contents.title') }],
      () => this.headerActions(),
    );
    effect(() => {
      const brand = this.brands.activeBrand();
      if (brand) untracked(() => void this.load(brand.id, true));
    });
    // Quante colonne ci stanno: si ricalcola quando cambia la larghezza della pagina.
    // La griglia compare solo quando ci sono contenuti.
    const observer = new ResizeObserver(([entry]) =>
      this.columnCount.set(
        Math.max(entry.contentRect.width >= PHONE_WIDTH ? PHONE_COLUMNS : 1, Math.floor((entry.contentRect.width + GAP) / (COLUMN_MIN + GAP))),
      ),
    );
    effect(() => {
      const grid = this.grid()?.nativeElement;
      observer.disconnect();
      if (grid) observer.observe(grid);
    });
    inject(DestroyRef).onDestroy(() => observer.disconnect());
    effect((onCleanup) => {
      const brand = this.brands.activeBrand();
      if (!brand || !this.preparing()) return;
      const timer = setInterval(() => void this.load(brand.id, false), REFRESH_MS);
      onCleanup(() => clearInterval(timer));
    });
  }

  private async load(brandId: string, first: boolean): Promise<void> {
    if (first) this.loading.set(true);
    try {
      const contents = await this.api.list(brandId);
      if (this.brands.activeBrand()?.id === brandId) this.contents.set(contents);
    } catch (error) {
      if (first) this.toast.show(errorMessage(error, this.i18n.t('contents.list.loadError')));
    } finally {
      if (first) this.loading.set(false);
    }
  }

  protected formatLabel(content: ContentSummary): string {
    return formatLabel(content.format, this.i18n.locale());
  }

  protected statusLabel(content: ContentSummary): string {
    return statusLabel(content.state, this.i18n.locale());
  }

  // I canali e, se è nel piano, quando esce: sulla stessa riga, così la card resta alta uguale.
  protected channelsLabel(content: ContentSummary): string {
    const channels = content.channels.map(channelName).join(', ');
    const when = content.scheduledFor;
    if (!when) return channels;
    return this.i18n.t('contents.list.scheduled', { channels, day: formatWeekdayShort(when.date, this.i18n.locale()), time: when.time });
  }
}
