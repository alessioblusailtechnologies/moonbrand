import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { IdeasResponse } from '@moonbrand/shared/api/contract';
import type { Idea, IdeaStatus } from '@moonbrand/shared/domain/idea';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { BrandsService } from '../../core/brands/brands.service';
import { errorMessage } from '../../core/errors';
import { IdeasService } from '../../core/ideas/ideas.service';
import { Icon } from '../../ui/icon';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { SIGNAL_LABELS } from './labels';

type View = 'new' | 'saved';

// Masonry: colonne larghe almeno così, separate da questo spazio.
const MIN_COLUMN = 320;
const COLUMN_GAP = 16;

@Component({
  selector: 'mb-ideas-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Icon, StepList],
  host: { '(window:resize)': 'updateScroll()' },
  templateUrl: './ideas-page.html',
  styleUrl: './ideas-page.scss',
})
export class IdeasPage {
  private readonly api = inject(IdeasService);
  private readonly ai = inject(AiJobsService);
  private readonly toast = inject(ToastService);
  protected readonly brands = inject(BrandsService);

  protected readonly view = signal<View>('new');
  protected readonly themeId = signal<string | null>(null);
  protected readonly ideas = signal<Idea[]>([]);
  protected readonly themes = signal<IdeasResponse['themes']>([]);
  protected readonly loading = signal(true);
  protected readonly preparing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly lastDecision = signal<{ idea: Idea; previous: IdeaStatus } | null>(null);
  protected readonly canScrollLeft = signal(false);
  protected readonly canScrollRight = signal(false);
  private readonly filters = viewChild<ElementRef<HTMLElement>>('filters');
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  protected readonly columnCount = signal(3);

  protected readonly brand = computed(() => this.brands.activeBrand());
  protected readonly counts = computed(() => ({
    new: this.ideas().filter((idea) => idea.status === 'new').length,
    saved: this.ideas().filter((idea) => idea.status === 'saved').length,
  }));
  protected readonly visible = computed(() => {
    const themeId = this.themeId();
    return this.ideas().filter((idea) => idea.status === this.view() && (!themeId || idea.themeId === themeId));
  });
  // A rotazione tra le colonne: l'ordine si legge per righe, da sinistra a destra, e ogni colonna cresce da sé.
  protected readonly columns = computed(() => {
    const count = this.columnCount();
    return Array.from({ length: count }, (_, column) => this.visible().filter((_, index) => index % count === column));
  });

  constructor() {
    effect(() => {
      const brand = this.brand();
      if (brand) untracked(() => void this.load(brand.id));
    });
    effect((onCleanup) => {
      const element = this.list()?.nativeElement;
      if (!element) return;
      const observer = new ResizeObserver(([entry]) => {
        this.columnCount.set(Math.max(1, Math.floor((entry.contentRect.width + COLUMN_GAP) / (MIN_COLUMN + COLUMN_GAP))));
      });
      observer.observe(element);
      onCleanup(() => observer.disconnect());
    });
    // I temi cambiano con il brand: dopo il disegno si ricontrolla se la riga scorre.
    afterRenderEffect(() => {
      this.themes();
      this.updateScroll();
    });
  }

  protected updateScroll(): void {
    const element = this.filters()?.nativeElement;
    this.canScrollLeft.set(!!element && element.scrollLeft > 1);
    this.canScrollRight.set(!!element && element.scrollLeft + element.clientWidth < element.scrollWidth - 1);
  }

  protected scrollThemes(direction: 1 | -1): void {
    const element = this.filters()?.nativeElement;
    element?.scrollBy({ left: direction * element.clientWidth * 0.7, behavior: 'smooth' });
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    this.themeId.set(null);
    this.lastDecision.set(null);
    try {
      const response = await this.api.list(brandId);
      if (this.brand()?.id !== brandId) return;
      this.ideas.set(response.ideas);
      this.themes.set(response.themes);
      if (response.jobId) void this.follow(brandId, response.jobId);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a caricare le idee. Riprova tra poco.'));
    } finally {
      this.loading.set(false);
    }
  }

  // Il worker salva le idee a lavoro finito: allora si rilegge la lista.
  private async follow(brandId: string, jobId: string): Promise<void> {
    this.preparing.set(true);
    this.steps.set([]);
    try {
      await this.ai.follow(jobId, (steps) => this.steps.set(steps));
      if (this.brand()?.id !== brandId) return;
      this.ideas.set((await this.api.list(brandId)).ideas);
      this.view.set('new');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a preparare le idee. Riprova.'));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async more(): Promise<void> {
    const brand = this.brand();
    if (!brand || this.preparing()) return;
    try {
      const { id } = await this.api.generate(brand.id);
      void this.follow(brand.id, id);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a chiedere nuove idee. Riprova.'));
    }
  }

  protected async decide(idea: Idea, status: IdeaStatus): Promise<void> {
    try {
      const updated = await this.api.setStatus(idea.id, status);
      this.ideas.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      this.lastDecision.set({ idea: updated, previous: idea.status });
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a salvare la scelta. Riprova.'));
    }
  }

  protected async undo(): Promise<void> {
    const last = this.lastDecision();
    if (!last) return;
    this.lastDecision.set(null);
    await this.decide(last.idea, last.previous);
    this.lastDecision.set(null);
  }

  protected signalLabel(idea: Idea): string {
    return [SIGNAL_LABELS[idea.signal.kind] ?? idea.signal.kind, idea.signal.label].filter(Boolean).join(' · ');
  }

  protected theme(idea: Idea) {
    return this.themes().find((theme) => theme.id === idea.themeId) ?? null;
  }
}
