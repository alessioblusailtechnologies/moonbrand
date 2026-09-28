import { ChangeDetectionStrategy, Component, computed, effect, inject, input, linkedSignal, signal } from '@angular/core';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { Content, ContentFile } from '@moonbrand/shared/domain/content';

import { Icon } from '../../ui/icon';
import { LightboxService } from '../../ui/lightbox';
import { ToastService } from '../../ui/toast';
import { cssAspect, POST_ASPECT } from './labels';

// Il contenuto come si pubblica: le immagini (slider per il carosello) e il testo del canale scelto.
// Nella pagina del contenuto a tutta larghezza; nella chat (compact) dentro una card, con le immagini più strette.
@Component({
  selector: 'mb-content-preview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  host: { '[class.compact]': 'compact()' },
  templateUrl: './content-preview.html',
  styleUrl: './content-preview.scss',
})
export class ContentPreview {
  private readonly toast = inject(ToastService);
  private readonly lightbox = inject(LightboxService);

  readonly content = input.required<Content>();
  readonly compact = input(false);

  // Il canale scelto resta finché il contenuto lo ha ancora; altrimenti il primo.
  protected readonly channel = linkedSignal<ChannelId[], ChannelId | null>({
    source: () => this.content().channels,
    computation: (channels, previous) => (previous?.value && channels.includes(previous.value) ? previous.value : (channels[0] ?? null)),
  });
  protected readonly slide = signal(0);
  // Punto di partenza di un trascinamento sullo slider; dragged evita che la fine del gesto apra la slide.
  protected dragFrom: number | null = null;
  private dragged = false;

  protected readonly variant = computed(() => this.content().variants.find((item) => item.channel === this.channel()) ?? null);

  // Le immagini del canale scelto: le slide del carosello, oppure la copertina nella proporzione del canale.
  protected readonly images = computed<ContentFile[]>(() => {
    const content = this.content();
    const files = content.visual.files ?? [];
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
