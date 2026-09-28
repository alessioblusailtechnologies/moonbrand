import { ChangeDetectionStrategy, Component, type TemplateRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { ContentScriptRequest } from '@moonbrand/shared/api/contract';
import { hasScript, type Content } from '@moonbrand/shared/domain/content';

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
import { ScriptEditor } from './script-editor';

// Cosa sta facendo il lavoro in corso: preparare il contenuto (o il copione di un video), ritoccarlo, fare il video.
type Work = 'prepare' | 'edit' | 'video';

@Component({
  selector: 'mb-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StepList, ContentPreview, ScriptEditor],
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
  protected readonly work = signal<Work>('prepare');
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly instruction = signal('');

  protected readonly formatLabel = computed(() => (this.content() ? FORMAT_LABELS[this.content()!.format] : ''));
  protected readonly statusLabel = computed(() => (this.content() ? STATUS_LABELS[this.content()!.status] : ''));
  protected readonly ready = computed(() => (this.content()?.variants.length ?? 0) > 0);
  // Un video ha il copione da leggere e correggere, prima e dopo il video.
  protected readonly scripted = computed(() => {
    const content = this.content();
    return content ? hasScript(content) : false;
  });
  protected readonly workLabel = computed(() => {
    const video = this.content()?.format === 'video';
    if (this.work() === 'video') return 'Preparo il video: immagini, clip, musica e voce. Ci vuole qualche minuto';
    if (this.work() === 'edit') return video && !this.ready() ? 'Ritocco il copione' : 'Ritocco il contenuto';
    return video ? 'Scrivo il copione del video' : 'Preparo testo e immagini';
  });

  constructor() {
    // Il titolo del contenuto nel percorso; i pulsanti quando il contenuto è pronto e nessuno ci sta lavorando.
    pageHeader(
      () => [{ label: 'Contenuti', link: '/contenuti' }, { label: this.content()?.title ?? '' }],
      () => ((this.ready() || this.scripted()) && !this.preparing() ? this.headerActions() : undefined),
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
      // Un lavoro già in corso su un video con il copione è il video; altrimenti la preparazione.
      if (jobId) void this.follow(jobId, content.format === 'video' && hasScript(content) ? 'video' : 'prepare');
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
  private async follow(jobId: string, work: Work): Promise<void> {
    this.preparing.set(true);
    this.work.set(work);
    this.steps.set([]);
    try {
      await this.ai.follow(jobId, (steps) => this.steps.set(steps));
      const { content } = await this.api.get(this.contentId());
      this.show(content);
      if (work === 'edit') this.instruction.set('');
    } catch (error) {
      const fallback = {
        prepare: 'Non sono riuscito a preparare il contenuto. Riprova.',
        edit: 'Non sono riuscito a ritoccare il contenuto. Riprova.',
        video: 'Non sono riuscito a fare il video. Riprova.',
      };
      this.toast.show(errorMessage(error, fallback[work]));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async send(): Promise<void> {
    const instruction = this.instruction().trim();
    if (!instruction || this.preparing() || !(this.ready() || this.scripted())) return;
    try {
      const { jobId } = await this.api.edit(this.contentId(), instruction);
      void this.follow(jobId, 'edit');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a chiedere il ritocco. Riprova.'));
    }
  }

  protected async regenerate(): Promise<void> {
    if (this.preparing()) return;
    const video = this.content()?.format === 'video';
    const confirmed = await this.confirm.ask({
      title: 'Rigenero il contenuto da zero?',
      message: video
        ? 'Riscrivo il copione partendo dall’idea: il copione e il video fatti finora si perdono e il contenuto torna bozza.'
        : 'Riscrivo testi e immagini partendo dall’idea: i ritocchi fatti finora si perdono e il contenuto torna bozza.',
      confirmLabel: 'Rigenera da zero',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { jobId } = await this.api.regenerate(this.contentId());
      void this.follow(jobId, 'prepare');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a rigenerare il contenuto. Riprova.'));
    }
  }

  protected async saveScript(request: ContentScriptRequest): Promise<void> {
    try {
      this.show(await this.api.saveScript(this.contentId(), request));
      this.toast.show('Copione salvato.');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a salvare il copione. Riprova.'));
    }
  }

  // Le correzioni non salvate vanno prima sul DB: il video si fa dal copione salvato.
  protected async generateVideo(request: ContentScriptRequest | null): Promise<void> {
    if (this.preparing()) return;
    try {
      if (request) this.show(await this.api.saveScript(this.contentId(), request));
      const { jobId } = await this.api.generateVideo(this.contentId());
      void this.follow(jobId, 'video');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a far partire il video. Riprova.'));
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
