import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';

import type { ChatAttachment } from '@moonbrand/shared/api/contract';

import { BrandsService } from '../../core/brands/brands.service';
import { ChatService } from '../../core/chat/chat.service';
import { MicrophoneError, Recorder } from '../../core/chat/recorder';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { resizedDataUri } from '../../core/images';
import { Icon } from '../../ui/icon';
import { ToastService } from '../../ui/toast';

// Una foto o un video scelto per il messaggio: si carica subito, il messaggio lo cita quando è pronto.
// progress: per un video, quanto è già partito (da 0 a 1); a 1 il server lo sta convertendo.
interface PendingAttachment {
  id: number;
  // Il percorso che avrà sul server, scelto qui: se lo si toglie mentre parte, o la risposta si perde, si fa cancellare.
  path: string;
  preview: string;
  file: string | null;
  failed: boolean;
  video: boolean;
  // Un audio: niente anteprima, il suo nome nel riquadro.
  audio: string | null;
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
// Una dettatura si chiude da sola dopo cinque minuti: oltre, meglio in più riprese.
const MAX_DICTATION_S = 300;

function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || (!file.type && /\.(mp4|mov|m4v|webm)$/i.test(file.name));
}

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || (!file.type && /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name));
}

// La casella dell'assistente: il testo sopra, allegati, dettatura e invio in una barra sotto. Foto e video si scelgono dal
// pulsante o si incollano, e partono subito. Il microfono registra fino al secondo clic e il testo trascritto (Voxtral)
// si aggiunge a quello scritto, da rileggere prima di mandarlo. La usano la chat e la finestra che crea un contenuto da un'idea.
// empty: si può mandare anche senza testo né allegati (c'è già altro, come l'idea). send: false toglie la freccia,
// quando a mandare è un pulsante di chi la usa; Invio manda comunque.
@Component({
  selector: 'mb-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  templateUrl: './composer.html',
  styleUrl: './composer.scss',
  host: { '[class.tall]': 'tall()' },
})
export class Composer {
  private readonly chat = inject(ChatService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly placeholder = input('');
  // Senza label, quella della chat.
  readonly label = input('');
  readonly tall = input(false);
  readonly running = input(false);
  readonly stopping = input(false);
  readonly busy = input(false);
  readonly empty = input(false);
  readonly send = input(true);
  // false: niente allegati (né pulsante né incolla), solo testo e dettatura. La usa il wizard delle campagne.
  readonly media = input(true);
  readonly submitted = output<ComposerMessage>();
  readonly stopped = output();

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('field');
  protected readonly draft = signal('');
  protected readonly attachments = signal<PendingAttachment[]>([]);
  private nextAttachment = 0;
  // Per ogni allegato che sta ancora partendo: la × lo ferma.
  private readonly uploads = new Map<number, AbortController>();
  protected readonly dictation = signal<'idle' | 'recording' | 'transcribing'>('idle');
  protected readonly elapsed = signal(0);
  private readonly recorder = new Recorder();
  private timer?: ReturnType<typeof setInterval>;

  protected readonly ariaLabel = computed(() => this.label() || this.i18n.t('chat.composer.label'));
  readonly uploading = computed(() => this.attachments().some((item) => !item.file && !item.failed));
  readonly canSend = computed(
    () =>
      !this.running() &&
      !this.busy() &&
      !this.uploading() &&
      this.dictation() === 'idle' &&
      (this.empty() || this.draft().trim().length > 0 || this.attachments().some((item) => item.file)),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      for (const item of this.attachments()) this.discard(item);
      this.clear();
      clearInterval(this.timer);
      this.recorder.cancel();
    });
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

  protected picked(event: Event): void {
    const element = event.target as HTMLInputElement;
    const files = [...(element.files ?? [])];
    if (files.length === 0) {
      element.value = '';
      return;
    }
    void this.attach(files).finally(() => {
      element.value = '';
    });
  }

  // Una foto o un video incollato nella casella vale come una scelta dal pulsante.
  protected pasted(event: ClipboardEvent): void {
    if (!this.media()) return;
    const media = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/') || isVideoFile(file) || isAudioFile(file));
    if (media.length === 0) return;
    event.preventDefault();
    void this.attach(media);
  }

  private async attach(files: File[]): Promise<void> {
    const brand = this.brands.activeBrand();
    if (!brand) return;
    const room = MAX_ATTACHMENTS - this.attachments().length;
    if (files.length > room) this.toast.show(this.i18n.t('chat.composer.tooMany', { n: MAX_ATTACHMENTS }));
    const uploads: Promise<void>[] = [];
    for (const file of files.slice(0, Math.max(0, room))) {
      const video = isVideoFile(file);
      const audio = isAudioFile(file) ? file.name : null;
      const pending: PendingAttachment = {
        id: ++this.nextAttachment,
        path: `allegati/${crypto.randomUUID()}.${video ? 'mp4' : audio ? 'mp3' : 'jpg'}`,
        preview: URL.createObjectURL(file),
        file: null,
        failed: false,
        video,
        audio,
        progress: 0,
      };
      this.attachments.update((list) => [...list, pending]);
      this.uploads.set(pending.id, new AbortController());
      const upload = pending.video || pending.audio ? this.uploadVideo(brand.id, file, pending, pending.audio ? 'audio' : 'video') : this.upload(brand.id, file, pending);
      uploads.push(upload.finally(() => this.uploads.delete(pending.id)));
    }
    await Promise.allSettled(uploads);
  }

  private set(id: number, patch: Partial<PendingAttachment>): void {
    this.attachments.update((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  // Un file che non partirà con il messaggio non deve restare tra gli allegati del brand, dove la chat lo prenderebbe
  // per uno di quelli mandati. Se sta ancora arrivando, il server lo butta appena finisce.
  private forget(brandId: string, path: string): void {
    void this.chat.removeAttachment(brandId, path).catch(() => undefined);
  }

  // Un caricamento finito dopo che l'allegato è stato tolto dalla casella.
  private arrived(brandId: string, id: number, file: string, patch: Partial<PendingAttachment> = {}): void {
    if (this.attachments().some((item) => item.id === id)) this.set(id, { ...patch, file });
    else this.forget(brandId, file);
  }

  // Tolto prima dell'invio: se sta partendo si ferma, e sul server si cancella (o si cancellerà appena arriva).
  private discard(item: PendingAttachment): void {
    this.uploads.get(item.id)?.abort();
    const brand = this.brands.activeBrand();
    if (brand && !item.failed) this.forget(brand.id, item.file ?? item.path);
  }

  private async uploadVideo(brandId: string, file: File, pending: PendingAttachment, kind: 'video' | 'audio'): Promise<void> {
    const { id, path } = pending;
    try {
      const uploaded = await this.chat.uploadVideo(brandId, file, (progress) => this.set(id, { progress }), kind, this.uploads.get(id)?.signal, idOf(path));
      this.arrived(brandId, id, uploaded.file, { progress: 1 });
    } catch (error) {
      if (this.uploads.get(id)?.signal.aborted) return;
      // Fallito per noi, ma il server potrebbe averlo ricevuto lo stesso (la risposta persa per strada).
      this.forget(brandId, path);
      this.set(id, { failed: true });
      this.toast.show(errorMessage(error, this.i18n.t(kind === 'audio' ? 'chat.composer.audioFailed' : 'chat.composer.videoFailed')));
    }
  }

  private async upload(brandId: string, file: File, pending: PendingAttachment): Promise<void> {
    const { id, path } = pending;
    try {
      const dataUri = await resizedDataUri(file, ATTACHMENT_SIDE, 'image/jpeg');
      const uploaded: ChatAttachment = await this.chat.upload(brandId, dataUri, idOf(path));
      this.arrived(brandId, id, uploaded.file);
    } catch (error) {
      this.forget(brandId, path);
      this.set(id, { failed: true });
      this.toast.show(errorMessage(error, this.i18n.t('chat.composer.photoFailed')));
    }
  }

  protected async toggleDictation(): Promise<void> {
    if (this.dictation() === 'transcribing') return;
    if (this.dictation() === 'recording') return this.finishDictation();
    try {
      await this.recorder.start();
    } catch (error) {
      this.toast.show(this.i18n.t(error instanceof MicrophoneError ? error.key : 'chat.composer.micFailed'));
      return;
    }
    this.elapsed.set(0);
    this.dictation.set('recording');
    this.timer = setInterval(() => {
      this.elapsed.update((seconds) => seconds + 1);
      if (this.elapsed() >= MAX_DICTATION_S) void this.finishDictation();
    }, 1000);
  }

  // Si chiude il microfono e si trascrive: il testo va in coda a quello già scritto.
  private async finishDictation(): Promise<void> {
    clearInterval(this.timer);
    const brand = this.brands.activeBrand();
    const audio = await this.recorder.stop();
    if (!brand || audio.size === 0) {
      this.dictation.set('idle');
      return;
    }
    this.dictation.set('transcribing');
    try {
      const text = await this.chat.transcribe(brand.id, audio);
      if (text) {
        const current = this.draft().trimEnd();
        this.setDraft(current ? `${current} ${text}` : text);
      } else {
        this.toast.show(this.i18n.t('chat.composer.heardNothing'));
      }
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('chat.composer.transcribeFailed')));
    } finally {
      this.dictation.set('idle');
    }
  }

  protected elapsedLabel(): string {
    const seconds = this.elapsed();
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  protected progressLabel(progress: number): string {
    return `${Math.floor(progress * 100)}%`;
  }

  protected unattach(id: number): void {
    const item = this.attachments().find((attachment) => attachment.id === id);
    if (item) {
      URL.revokeObjectURL(item.preview);
      this.discard(item);
    }
    this.attachments.update((list) => list.filter((attachment) => attachment.id !== id));
  }
}

// allegati/<id>.mp4 → <id>
const idOf = (path: string): string => path.slice(path.indexOf('/') + 1, path.lastIndexOf('.'));
