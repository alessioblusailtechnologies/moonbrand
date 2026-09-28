import { ChangeDetectionStrategy, Component, type TemplateRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { Content } from '@moonbrand/shared/domain/content';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { pageHeader } from '../../core/layout/page-header';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { ContentPreview } from './content-preview';
import { FORMAT_LABELS, STATUS_LABELS } from './labels';

@Component({
  selector: 'mb-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StepList, ContentPreview],
  templateUrl: './content-page.html',
  styleUrl: './content-page.scss',
})
export class ContentPage {
  private readonly api = inject(ContentsService);
  private readonly ai = inject(AiJobsService);
  private readonly brands = inject(BrandsService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  // Dal percorso /contenuti/:contentId.
  readonly contentId = input.required<string>();

  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  protected readonly content = signal<Content | null>(null);
  protected readonly loading = signal(true);
  protected readonly preparing = signal(false);
  protected readonly editing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly instruction = signal('');

  protected readonly formatLabel = computed(() => (this.content() ? FORMAT_LABELS[this.content()!.format] : ''));
  protected readonly statusLabel = computed(() => (this.content() ? STATUS_LABELS[this.content()!.status] : ''));
  protected readonly ready = computed(() => (this.content()?.variants.length ?? 0) > 0);

  constructor() {
    // Il titolo del contenuto nel percorso; i pulsanti quando il contenuto è pronto e nessuno ci sta lavorando.
    pageHeader(
      () => [{ label: 'Contenuti', link: '/contenuti' }, { label: this.content()?.title ?? '' }],
      () => (this.ready() && !this.preparing() ? this.headerActions() : undefined),
    );
    effect(() => {
      const id = this.contentId();
      untracked(() => void this.load(id));
    });
    // Cambiando brand, il contenuto non è più di quello attivo: si torna all'elenco.
    effect(() => {
      const brand = this.brands.activeBrand();
      const content = untracked(this.content);
      if (brand && content && content.brandId !== brand.id) void this.router.navigateByUrl('/contenuti');
    });
  }

  private async load(contentId: string): Promise<void> {
    this.loading.set(true);
    try {
      const { content, jobId } = await this.api.get(contentId);
      this.show(content);
      if (jobId) void this.follow(jobId, false);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non trovo questo contenuto.'));
      void this.router.navigateByUrl('/contenuti');
    } finally {
      this.loading.set(false);
    }
  }

  private show(content: Content): void {
    this.content.set(content);
  }

  // Il worker salva il contenuto a lavoro finito: allora si rilegge.
  private async follow(jobId: string, editing: boolean): Promise<void> {
    this.preparing.set(true);
    this.editing.set(editing);
    this.steps.set([]);
    try {
      await this.ai.follow(jobId, (steps) => this.steps.set(steps));
      const { content } = await this.api.get(this.contentId());
      this.show(content);
      if (editing) this.instruction.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, editing ? 'Non sono riuscito a ritoccare il contenuto. Riprova.' : 'Non sono riuscito a preparare il contenuto. Riprova.'));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async send(): Promise<void> {
    const instruction = this.instruction().trim();
    if (!instruction || this.preparing() || !this.ready()) return;
    try {
      const { jobId } = await this.api.edit(this.contentId(), instruction);
      void this.follow(jobId, true);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a chiedere il ritocco. Riprova.'));
    }
  }

  protected async regenerate(): Promise<void> {
    if (this.preparing()) return;
    const confirmed = await this.confirm.ask({
      title: 'Rigenero il contenuto da zero?',
      message: 'Riscrivo testi e immagini partendo dall’idea: i ritocchi fatti finora si perdono e il contenuto torna bozza.',
      confirmLabel: 'Rigenera da zero',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { jobId } = await this.api.regenerate(this.contentId());
      void this.follow(jobId, false);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a rigenerare il contenuto. Riprova.'));
    }
  }

  protected async toggleApproved(): Promise<void> {
    const content = this.content();
    if (!content) return;
    try {
      this.show(await this.api.setApproved(content.id, content.status !== 'approved'));
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a cambiare lo stato. Riprova.'));
    }
  }
}
