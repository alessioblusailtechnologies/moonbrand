import { ChangeDetectionStrategy, Component, type TemplateRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { ContentScriptRequest, SlotView } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { formatAspects, hasScript, hasVideo, supportsFormat, type Content } from '@moonbrand/shared/domain/content';
import type { MessageKey, MessageParams } from '@moonbrand/shared/i18n/translate';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ContentsService } from '../../core/contents/contents.service';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { PendingMedia, type PendingTile } from '../../ui/pending-media';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { ContentPreview } from './content-preview';
import { ContentSchedule } from './content-schedule';
import { formatLabel, statusLabel, unsupportedLine } from './labels';
import { ScriptEditor } from './script-editor';

// Cosa sta facendo il lavoro in corso: preparare il contenuto (o il copione di un video), ritoccarlo, fare il video,
// scrivere per un canale aggiunto.
type Work = 'prepare' | 'edit' | 'video' | 'channel';

@Component({
  selector: 'mb-content-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, StepList, PendingMedia, ContentPreview, ContentSchedule, ScriptEditor, TranslatePipe],
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
  private readonly i18n = inject(I18nService);

  // Dal percorso /contenuti/:contentId.
  readonly contentId = input.required<string>();

  private readonly headerActions = viewChild<TemplateRef<unknown>>('headerActions');
  protected readonly content = signal<Content | null>(null);
  protected readonly loading = signal(true);
  protected readonly preparing = signal(false);
  protected readonly work = signal<Work>('prepare');
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly instruction = signal('');
  protected readonly brandChannels = signal<ChannelId[]>([]);
  // La sua uscita nel piano, se c'è.
  protected readonly slot = signal<SlotView | null>(null);
  // Il canale che un lavoro sta aggiungendo.
  protected readonly adding = signal<ChannelId | null>(null);
  protected readonly changingChannels = signal(false);
  protected readonly name = channelName;

  protected readonly formatLabel = computed(() => (this.content() ? formatLabel(this.content()!.format, this.i18n.locale()) : ''));
  protected readonly statusLabel = computed(() => (this.content() ? statusLabel(this.content()!.status, this.i18n.locale()) : ''));
  protected readonly ready = computed(() => (this.content()?.variants.length ?? 0) > 0);
  // Un video ha il copione da leggere e correggere, prima e dopo il video.
  protected readonly scripted = computed(() => {
    const content = this.content();
    return content ? hasScript(content) : false;
  });
  // I canali del brand che il contenuto non ha e che reggono il suo formato. Un contenuto nato in chat li aggiunge
  // nella sua conversazione, tranne il copione di un video, che non ha ancora testi né file.
  protected readonly addable = computed(() => {
    const content = this.content();
    if (!content) return [];
    const scriptOnly = content.format === 'video' && hasScript(content) && !hasVideo(content);
    if (content.conversationId && !scriptOnly) return [];
    return this.brandChannels().filter((channel) => !content.channels.includes(channel) && supportsFormat(content.format, channel));
  });
  // I canali del brand dove il formato non c'è, detti in una frase.
  protected readonly unsupported = computed(() => {
    const content = this.content();
    if (!content) return '';
    const names = this.brandChannels()
      .filter((channel) => !supportsFormat(content.format, channel))
      .map(channelName);
    return unsupportedLine(content.format, names, this.i18n.locale());
  });
  // Le card in arrivo mentre si preparano testo e immagini o si fa il video: una per proporzione dei canali.
  // Il copione di un video non ne ha, e un ritocco mostra il contenuto di prima finché non è finito.
  protected readonly pending = computed<PendingTile[]>(() => {
    const content = this.content();
    const work = this.work();
    if (!content || !this.preparing()) return [];
    const video = content.format === 'video';
    if (!(work === 'video' || (work === 'prepare' && !video))) return [];
    return formatAspects(content.format, content.channels).map((aspect) => ({
      kind: video ? 'video' : 'image',
      aspect,
      count: content.format === 'carousel' ? 3 : 1,
      ...(content.format === 'carousel' && { label: this.i18n.t('contents.page.preparingSlides') }),
    }));
  });
  protected readonly workLabel = computed(() => {
    const video = this.content()?.format === 'video';
    const adding = this.adding();
    const t = (key: MessageKey, params?: MessageParams) => this.i18n.t(key, params);
    if (this.work() === 'channel' && adding) {
      return t(video ? 'contents.page.work.channelVideo' : 'contents.page.work.channelImages', { channel: channelName(adding) });
    }
    if (this.work() === 'video') return t('contents.page.work.video');
    if (this.work() === 'edit') return t(video && !this.ready() ? 'contents.page.work.editScript' : 'contents.page.work.edit');
    return t(video ? 'contents.page.work.script' : 'contents.page.work.prepare');
  });

  constructor() {
    // Il titolo del contenuto nel percorso; i pulsanti quando il contenuto è pronto e nessuno ci sta lavorando.
    pageHeader(
      () => [{ label: this.i18n.t('contents.title'), link: '/contenuti' }, { label: this.content()?.title ?? '' }],
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
      const { content, jobId, brandChannels, slot } = await this.api.get(contentId);
      this.show(content);
      this.slot.set(slot);
      this.brandChannels.set(brandChannels);
      // Un lavoro già in corso su un video con il copione è il video; altrimenti la preparazione.
      if (jobId) void this.follow(jobId, content.format === 'video' && hasScript(content) ? 'video' : 'prepare');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.notFound')));
      void this.router.navigateByUrl('/contenuti');
    } finally {
      this.loading.set(false);
    }
  }

  // Il worker salva il contenuto a lavoro finito: allora si rilegge.
  private async follow(jobId: string, work: Work): Promise<void> {
    this.preparing.set(true);
    this.work.set(work);
    this.steps.set([]);
    try {
      await this.ai.follow(jobId, (steps) => this.steps.set(steps));
      const { content, slot } = await this.api.get(this.contentId());
      this.show(content);
      this.slot.set(slot);
      if (work === 'edit') this.instruction.set('');
      if (work === 'channel' && this.adding()) this.toast.show(this.i18n.t('contents.page.channelAdded', { channel: channelName(this.adding()!) }));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t(`contents.page.errors.${work}`)));
    } finally {
      this.preparing.set(false);
      this.adding.set(null);
    }
  }

  protected show(content: Content): void {
    this.content.set(content);
  }

  protected async addChannel(channel: ChannelId): Promise<void> {
    if (this.preparing() || this.changingChannels()) return;
    this.changingChannels.set(true);
    try {
      const { content, jobId } = await this.api.addChannel(this.contentId(), channel);
      this.show(content);
      if (jobId) {
        this.adding.set(channel);
        void this.follow(jobId, 'channel');
      } else {
        this.toast.show(this.i18n.t('contents.page.channelAdded', { channel: channelName(channel) }));
      }
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.addChannel', { channel: channelName(channel) })));
    } finally {
      this.changingChannels.set(false);
    }
  }

  protected async removeChannel(channel: ChannelId): Promise<void> {
    const content = this.content();
    if (!content || this.preparing() || this.changingChannels() || content.channels.length < 2) return;
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('contents.page.removeConfirm.title', { channel: channelName(channel) }),
      message: this.i18n.t('contents.page.removeConfirm.message', { channel: channelName(channel) }),
      confirmLabel: this.i18n.t('contents.page.removeConfirm.confirm'),
      tone: 'danger',
    });
    if (!confirmed) return;
    this.changingChannels.set(true);
    try {
      this.show(await this.api.removeChannel(content.id, channel));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.removeChannel', { channel: channelName(channel) })));
    } finally {
      this.changingChannels.set(false);
    }
  }

  protected async send(): Promise<void> {
    const instruction = this.instruction().trim();
    if (!instruction || this.preparing() || !(this.ready() || this.scripted())) return;
    try {
      const { jobId } = await this.api.edit(this.contentId(), instruction);
      void this.follow(jobId, 'edit');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.refine')));
    }
  }

  protected async regenerate(): Promise<void> {
    if (this.preparing()) return;
    const video = this.content()?.format === 'video';
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('contents.page.regenerateConfirm.title'),
      message: this.i18n.t(video ? 'contents.page.regenerateConfirm.messageVideo' : 'contents.page.regenerateConfirm.message'),
      confirmLabel: this.i18n.t('contents.page.regenerate'),
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      const { jobId } = await this.api.regenerate(this.contentId());
      void this.follow(jobId, 'prepare');
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.regenerate')));
    }
  }

  protected async saveScript(request: ContentScriptRequest): Promise<void> {
    try {
      this.show(await this.api.saveScript(this.contentId(), request));
      this.toast.show(this.i18n.t('contents.page.scriptSaved'));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.saveScript')));
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
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.startVideo')));
    }
  }

  protected async toggleApproved(): Promise<void> {
    const content = this.content();
    if (!content) return;
    try {
      this.show(await this.api.setApproved(content.id, content.status !== 'approved'));
      // Approvato o riaperto, la sua uscita cambia stato.
      if (this.slot()) this.slot.set((await this.api.get(content.id)).slot);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('contents.page.errors.status')));
    }
  }
}
