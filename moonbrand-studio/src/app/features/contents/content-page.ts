import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { ContentPhotoUploadResponse } from '@moonbrand/shared/api/contract';
import type { Content, ContentFile, ContentPhotoSlot } from '@moonbrand/shared/domain/content';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { LightboxService } from '../../ui/lightbox';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { resizedDataUri } from '../onboarding/images';
import { cssAspect, FORMAT_LABELS, POST_ASPECT, STATUS_LABELS } from './labels';

// Cosa sta facendo il lavoro in corso, per il titolo del pannello e per l'errore.
type Work = 'prepare' | 'edit' | 'photos';

const WORK_LABELS: Record<Work, string> = {
  prepare: 'Preparo testo e immagini',
  edit: 'Ritocco il contenuto',
  photos: 'Metto le foto al loro posto',
};

const WORK_ERRORS: Record<Work, string> = {
  prepare: 'Non sono riuscito a preparare il contenuto. Riprova.',
  edit: 'Non sono riuscito a ritoccare il contenuto. Riprova.',
  photos: 'Non sono riuscito a mettere le foto. Riprova.',
};

// La scelta per uno slot, prima di mandarle tutte insieme: la foto caricata o farla generare.
type PhotoChoice = { upload: ContentPhotoUploadResponse } | 'ai';

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
  protected readonly work = signal<Work>('prepare');
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly channel = signal<ChannelId | null>(null);
  protected readonly instruction = signal('');
  protected readonly slide = signal(0);
  protected readonly choices = signal<Record<string, PhotoChoice>>({});
  protected readonly uploading = signal<string | null>(null);
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

  protected readonly slots = computed(() => this.content()?.visual.slots ?? []);
  protected readonly missingPhotos = computed(() => this.slots().filter((slot) => !slot.file).length);
  protected readonly chosen = computed(() => Object.keys(this.choices()).length);
  protected readonly workLabel = computed(() => WORK_LABELS[this.work()]);

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
      if (jobId) void this.follow(jobId, 'prepare');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non trovo questo contenuto.'));
      void this.router.navigateByUrl('/contenuti');
    } finally {
      this.loading.set(false);
    }
  }

  private show(content: Content): void {
    this.content.set(content);
    this.choices.set({});
    if (!this.channel() || !content.channels.includes(this.channel()!)) this.channel.set(content.channels[0] ?? null);
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
      this.toast.show(errorMessage(error, WORK_ERRORS[work]));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async send(): Promise<void> {
    const instruction = this.instruction().trim();
    if (!instruction || this.preparing() || !this.ready()) return;
    try {
      const { jobId } = await this.api.edit(this.contentId(), instruction);
      void this.follow(jobId, 'edit');
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
      void this.follow(jobId, 'prepare');
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

  // La foto per uno slot: si carica subito, e parte insieme alle altre scelte.
  protected async pickPhoto(slot: ContentPhotoSlot, event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    this.uploading.set(slot.id);
    try {
      const upload = await this.api.uploadPhoto(this.contentId(), await resizedDataUri(file, 2048, 'image/jpeg'));
      this.choices.update((choices) => ({ ...choices, [slot.id]: { upload } }));
    } catch (error) {
      this.toast.show(errorMessage(error, 'Questa foto è troppo pesante o non si legge: usa un JPEG, un PNG o un WebP.'));
    } finally {
      this.uploading.set(null);
    }
  }

  protected generatePhoto(slot: ContentPhotoSlot): void {
    this.choices.update((choices) => ({ ...choices, [slot.id]: 'ai' }));
  }

  protected clearChoice(slot: ContentPhotoSlot): void {
    this.choices.update(({ [slot.id]: _removed, ...rest }) => rest);
  }

  protected choice(slot: ContentPhotoSlot): PhotoChoice | null {
    return this.choices()[slot.id] ?? null;
  }

  // Quello che si vede nel riquadro dello slot: la foto appena caricata, altrimenti quella già messa.
  protected slotPreview(slot: ContentPhotoSlot): string | null {
    const choice = this.choice(slot);
    if (choice && choice !== 'ai') return choice.upload.url;
    return slot.url ?? null;
  }

  // Lo stato dello slot in una riga, sotto la descrizione.
  protected slotStatus(slot: ContentPhotoSlot): string {
    const choice = this.choice(slot);
    if (choice === 'ai') return 'La genero con l’AI';
    if (choice) return 'Foto caricata: la metto al suo posto';
    if (slot.source === 'ai') return 'Generata con l’AI';
    if (slot.source === 'upload') return 'La tua foto';
    return slot.file ? 'Foto messa' : 'Da scegliere';
  }

  protected async fillPhotos(): Promise<void> {
    const slots = Object.entries(this.choices()).map(([id, choice]) => (choice === 'ai' ? { id } : { id, upload: choice.upload.path }));
    if (slots.length === 0 || this.preparing()) return;
    try {
      const { jobId } = await this.api.fillPhotos(this.contentId(), slots);
      void this.follow(jobId, 'photos');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non riesco a mettere le foto. Riprova.'));
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
