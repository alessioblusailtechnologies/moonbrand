import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';

import type { ChatAttachment } from '@moonbrand/shared/api/contract';

import { BrandsService } from '../../core/brands/brands.service';
import { ChatService } from '../../core/chat/chat.service';
import { errorMessage } from '../../core/errors';
import { resizedDataUri } from '../../core/images';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';

// Una foto o un video scelto per il messaggio: si carica subito, il messaggio lo cita quando è pronto.
// progress: per un video, quanto è già partito (da 0 a 1); a 1 il server lo sta convertendo.
interface PendingAttachment {
  id: number;
  preview: string;
  file: string | null;
  failed: boolean;
  video: boolean;
  progress: number;
}

// Quello che la casella manda: il testo e i percorsi degli allegati già caricati.
export interface ComposerMessage {
  message: string;
  attachments: string[];
}

// Le foto si rimpiccioliscono prima di partire: bastano per i post e restano sotto il limite dell'API.
const ATTACHMENT_SIDE = 2560;
const MAX_ATTACHMENTS = 10;

// La casella dell'assistente: il testo sopra, allegati e invio in una barra sotto. Foto e video si scelgono dal
// pulsante o si incollano, e partono subito. La usano la chat e la finestra che crea un contenuto da un'idea.
// empty: si può mandare anche senza testo né allegati (c'è già altro, come l'idea). send: false toglie la freccia,
// quando a mandare è un pulsante di chi la usa; Invio manda comunque.
@Component({
  selector: 'mb-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './composer.html',
  styleUrl: './composer.scss',
  host: { '[class.tall]': 'tall()' },
})
export class Composer {
  private readonly chat = inject(ChatService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);

  readonly placeholder = input('');
  readonly label = input('Messaggio per l’assistente');
  readonly tall = input(false);
  readonly running = input(false);
  readonly stopping = input(false);
  readonly busy = input(false);
  readonly empty = input(false);
  readonly send = input(true);
  readonly submitted = output<ComposerMessage>();
  readonly stopped = output();

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');
  protected readonly draft = signal('');
  protected readonly attachments = signal<PendingAttachment[]>([]);
  private nextAttachment = 0;

  readonly uploading = computed(() => this.attachments().some((item) => !item.file && !item.failed));
  readonly canSend = computed(
    () =>
      !this.running() &&
      !this.busy() &&
      !this.uploading() &&
      (this.empty() || this.draft().trim().length > 0 || this.attachments().some((item) => item.file)),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  // Quello che si manderebbe adesso, o null se non si può ancora (un allegato che sta caricando).
  value(): ComposerMessage | null {
    if (!this.canSend()) return null;
    return {
      message: this.draft().trim(),
      attachments: this.attachments()
        .map((item) => item.file)
        .filter((file): file is string => Boolean(file)),
    };
  }

  // Dopo un invio riuscito: la casella torna vuota.
  clear(): void {
    this.draft.set('');
    for (const item of this.attachments()) URL.revokeObjectURL(item.preview);
    this.attachments.set([]);
  }

  focus(): void {
    this.input()?.nativeElement.focus();
  }

  // Un testo da cui partire, con il cursore in fondo.
  setDraft(text: string): void {
    this.draft.set(text);
    const element = this.input()?.nativeElement;
    element?.focus();
    queueMicrotask(() => element?.setSelectionRange(text.length, text.length));
  }

  protected submit(): void {
    const value = this.value();
    if (value) this.submitted.emit(value);
  }

  protected keydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.submit();
  }

  protected pick(): void {
    this.picker()?.nativeElement.click();
  }

  protected picked(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.attach([...(element.files ?? [])]);
    element.value = '';
  }

  // Una foto o un video incollato nella casella vale come una scelta dal pulsante.
  protected pasted(event: ClipboardEvent): void {
    const media = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
    if (media.length === 0) return;
    event.preventDefault();
    this.attach(media);
  }

  private attach(files: File[]): void {
    const brand = this.brands.activeBrand();
    if (!brand) return;
    const room = MAX_ATTACHMENTS - this.attachments().length;
    if (files.length > room) this.toast.show(`Al massimo ${MAX_ATTACHMENTS} allegati per messaggio.`);
    for (const file of files.slice(0, Math.max(0, room))) {
      const pending: PendingAttachment = {
        id: ++this.nextAttachment,
        preview: URL.createObjectURL(file),
        file: null,
        failed: false,
        video: file.type.startsWith('video/'),
        progress: 0,
      };
      this.attachments.update((list) => [...list, pending]);
      void (pending.video ? this.uploadVideo(brand.id, file, pending.id) : this.upload(brand.id, file, pending.id));
    }
  }

  private set(id: number, patch: Partial<PendingAttachment>): void {
    this.attachments.update((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  private async uploadVideo(brandId: string, file: File, id: number): Promise<void> {
    try {
      const uploaded = await this.chat.uploadVideo(brandId, file, (progress) => this.set(id, { progress }));
      this.set(id, { file: uploaded.file, progress: 1 });
    } catch (error) {
      this.set(id, { failed: true });
      this.toast.show(errorMessage(error, 'Non riesco a caricare il video. Riprova.'));
    }
  }

  private async upload(brandId: string, file: File, id: number): Promise<void> {
    try {
      const dataUri = await resizedDataUri(file, ATTACHMENT_SIDE, 'image/jpeg');
      const uploaded: ChatAttachment = await this.chat.upload(brandId, dataUri);
      this.set(id, { file: uploaded.file });
    } catch (error) {
      this.set(id, { failed: true });
      this.toast.show(errorMessage(error, 'Non riesco a caricare la foto: usa un PNG, un JPEG o un WebP.'));
    }
  }

  protected progressLabel(progress: number): string {
    return `${Math.floor(progress * 100)}%`;
  }

  protected unattach(id: number): void {
    const item = this.attachments().find((attachment) => attachment.id === id);
    if (item) URL.revokeObjectURL(item.preview);
    this.attachments.update((list) => list.filter((attachment) => attachment.id !== id));
  }
}
