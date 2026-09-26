import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { Content, ContentFile } from '@moonbrand/shared/domain/content';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { LightboxService } from '../../ui/lightbox';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { cssAspect, FORMAT_LABELS, POST_ASPECT, STATUS_LABELS } from './labels';

@Component({
  selector: 'mb-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StepList],
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
  private readonly lightbox = inject(LightboxService);

  // Dal percorso /contenuti/:contentId.
  readonly contentId = input.required<string>();

  protected readonly content = signal<Content | null>(null);
  protected readonly loading = signal(true);
  protected readonly preparing = signal(false);
  protected readonly editing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly channel = signal<ChannelId | null>(null);
  protected readonly instruction = signal('');
  protected readonly slide = signal(0);
  // Punto di partenza di un trascinamento sullo slider; dragged evita che la fine del gesto apra la slide.
  protected dragFrom: number | null = null;
  private dragged = false;

  protected readonly formatLabel = computed(() => (this.content() ? FORMAT_LABELS[this.content()!.format] : ''));
  protected readonly statusLabel = computed(() => (this.content() ? STATUS_LABELS[this.content()!.status] : ''));
  protected readonly variant = computed(() => this.content()?.variants.find((item) => item.channel === this.channel()) ?? null);
  protected readonly ready = computed(() => (this.content()?.variants.length ?? 0) > 0);

  // Le immagini del canale scelto: le slide del carosello, oppure la copertina nella proporzione del canale.
  protected readonly images = computed<ContentFile[]>(() => {
    const content = this.content();
    const files = content?.visual.files ?? [];
    if (!content || files.length === 0) return [];
    const slides = files.filter((file) => file.role === 'slide');
    if (slides.length > 0) return slides;
    const covers = files.filter((file) => file.role === 'cover');
    const channel = this.channel();
    const fitting = channel && content.format === 'post' ? covers.find((file) => file.aspect === POST_ASPECT[channel]) : null;
    return [fitting ?? covers[0]].filter((file): file is ContentFile => Boolean(file));
  });

  protected readonly name = channelName;
  protected readonly cssAspect = cssAspect;

  constructor() {
    // Cambiando canale o immagini lo slider riparte dalla prima slide.
    effect(() => {
      this.images();
      this.slide.set(0);
    });
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
    if (!this.channel() || !content.channels.includes(this.channel()!)) this.channel.set(content.channels[0] ?? null);
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

  protected async copy(): Promise<void> {
    const variant = this.variant();
    if (!variant) return;
    const text = [variant.text, variant.hashtags.join(' ')].filter(Boolean).join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      this.toast.show('Testo copiato.');
    } catch {
      this.toast.show('Non riesco a copiare: seleziona il testo a mano.');
    }
  }

  protected move(step: number): void {
    this.slide.update((index) => Math.min(this.images().length - 1, Math.max(0, index + step)));
  }

  protected dragStart(event: PointerEvent): void {
    this.dragFrom = event.clientX;
    this.dragged = false;
  }

  protected dragEnd(event: PointerEvent): void {
    if (this.dragFrom === null) return;
    const distance = event.clientX - this.dragFrom;
    this.dragFrom = null;
    if (Math.abs(distance) < 40) return;
    this.dragged = true;
    this.move(distance < 0 ? 1 : -1);
  }

  protected openSlide(index: number): void {
    if (this.dragged) {
      this.dragged = false;
      return;
    }
    this.open(index);
  }

  protected open(index: number): void {
    const channel = this.channel();
    this.lightbox.open(
      this.images().map((file, i) => ({ url: file.url ?? '', alt: `Immagine ${i + 1}${channel ? ` per ${channelName(channel)}` : ''}` })),
      index,
    );
  }
}
