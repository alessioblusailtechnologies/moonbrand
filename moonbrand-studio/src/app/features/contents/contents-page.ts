import { ChangeDetectionStrategy, Component, type TemplateRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { ContentSummary } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';

import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { ToastService } from '../../ui/toast';
import { FORMAT_LABELS, STATUS_LABELS } from './labels';

// Mentre un contenuto si prepara, l'elenco si aggiorna da solo.
const REFRESH_MS = 5000;

@Component({
  selector: 'mb-contents-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @if (brands.activeBrand()) {
      <section class="contents">
        @if (loading()) {
          <div class="empty"><span class="spinner"></span></div>
        } @else if (contents().length === 0) {
          <div class="empty">
            <p class="strong-sm">Ancora nessun contenuto</p>
            <p class="caption">Parti da un’idea: scegli formato e canali, e preparo testo e immagini.</p>
          </div>
        } @else {
          <div class="grid">
            @for (content of contents(); track content.id) {
              <a class="panel card" [routerLink]="['/contenuti', content.id]">
                <div class="cover">
                  @if (content.coverUrl) {
                    <img [src]="content.coverUrl" alt="" loading="lazy" />
                  } @else {
                    <span class="caption">{{ content.preparing ? 'Preparo testo e immagini…' : 'Senza immagine' }}</span>
                  }
                </div>
                <div class="meta">
                  <span class="badge">{{ formatLabel(content) }}</span>
                  @if (content.preparing) {
                    <span class="badge">In preparazione</span>
                  } @else {
                    <span class="badge" [class.mint]="content.status === 'approved'">{{ statusLabel(content) }}</span>
                  }
                </div>
                <h2 class="strong">{{ content.title }}</h2>
                <p class="caption">{{ channelsLabel(content) }}</p>
              </a>
            }
          </div>
        }
      </section>
    }

    <ng-template #headerActions>
      <a class="btn btn-secondary btn-sm from-idea" routerLink="/">Crea da un’idea</a>
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
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
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
      aspect-ratio: 4 / 5;
      overflow: hidden;
      border-radius: var(--radius-md);
      background: var(--surface-sunken);
    }
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
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

  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  protected readonly contents = signal<ContentSummary[]>([]);
  protected readonly loading = signal(true);
  private readonly preparing = computed(() => this.contents().some((content) => content.preparing));

  constructor() {
    pageHeader(
      () => [{ label: 'Contenuti' }],
      () => this.headerActions(),
    );
    effect(() => {
      const brand = this.brands.activeBrand();
      if (brand) untracked(() => void this.load(brand.id, true));
    });
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
      if (first) this.toast.show(errorMessage(error, 'Non riesco a caricare i contenuti. Riprova tra poco.'));
    } finally {
      if (first) this.loading.set(false);
    }
  }

  protected formatLabel(content: ContentSummary): string {
    return FORMAT_LABELS[content.format];
  }

  protected statusLabel(content: ContentSummary): string {
    return STATUS_LABELS[content.status];
  }

  protected channelsLabel(content: ContentSummary): string {
    return content.channels.map(channelName).join(', ');
  }
}
