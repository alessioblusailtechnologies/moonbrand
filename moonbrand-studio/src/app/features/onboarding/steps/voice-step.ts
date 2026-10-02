import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import { currentVoiceCard, isConnected, type BrandDraft, type VoiceCard } from '@moonbrand/shared/domain/brand';
import { CHANNELS } from '@moonbrand/shared/domain/catalog';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { errorMessage } from '../../../core/errors';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon, type IconName } from '../../../ui/icon';
import { StepList } from '../../../ui/step-list';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';
import { MockAi, type VoiceAnalysis, type VoiceSample } from '../mock-ai';

const ROWS = [
  { key: 'register', label: 'onboarding.voice.rows.register' },
  { key: 'rhythm', label: 'onboarding.voice.rows.rhythm' },
  { key: 'lexicon', label: 'onboarding.voice.rows.lexicon' },
  { key: 'avoid', label: 'onboarding.voice.rows.avoid' },
] as const satisfies readonly { key: string; label: MessageKey }[];

type RowKey = (typeof ROWS)[number]['key'];
type Mode = 'sources' | 'paste' | 'recording';


@Component({
  selector: 'mb-voice-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StepList, TranslatePipe],
  templateUrl: './voice-step.html',
  styleUrl: './voice-step.scss',
})
export class VoiceStep {
  private readonly ai = inject(MockAi);
  private readonly toast = inject(ToastService);
  private readonly store = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  readonly draft = input.required<BrandDraft>();

  protected readonly rows = ROWS;
  protected readonly mode = signal<Mode>('sources');
  protected readonly adding = signal(false);
  protected readonly editing = signal(false);
  protected readonly texts = signal('');
  protected readonly analyzing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly seconds = signal(0);
  private timer: ReturnType<typeof setInterval> | undefined;

  protected readonly voice = computed(() => this.draft().voice);
  protected readonly card = computed(() => currentVoiceCard(this.voice()));
  protected readonly previous = computed(() => this.voice().cards.slice(0, -1).reverse());
  private readonly connected = computed(() => CHANNELS.find(({ id }) => isConnected(this.draft().channels[id])) ?? null);

  protected readonly sources = computed<{ key: string; title: string; meta: string; icon: IconName; disabled: boolean; run: () => void }[]>(() => {
    const channel = this.connected();
    return [
      {
        key: 'paste',
        title: this.i18n.t('onboarding.voice.sources.pasteTitle'),
        meta: this.i18n.t('onboarding.voice.sources.pasteMeta'),
        icon: 'clipboard',
        disabled: false,
        run: () => this.mode.set('paste'),
      },
      {
        key: 'history',
        title: channel
          ? this.i18n.t('onboarding.voice.sources.historyTitleChannel', { channel: channel.name })
          : this.i18n.t('onboarding.voice.sources.historyTitle'),
        meta: channel
          ? this.i18n.t('onboarding.voice.sources.historyMetaHandle', { handle: this.draft().channels[channel.id].handle ?? '' })
          : this.i18n.t('onboarding.voice.sources.historyMeta'),
        icon: 'history',
        disabled: !channel,
        run: () => channel && void this.analyze({ source: 'history', channel: channel.id }),
      },
      {
        key: 'recording',
        title: this.i18n.t('onboarding.voice.sources.recordingTitle'),
        meta: this.i18n.t('onboarding.voice.sources.recordingMeta'),
        icon: 'mic',
        disabled: false,
        run: () => this.startRecording(),
      },
    ];
  });

  private readonly dateFormat = computed(
    () => new Intl.DateTimeFormat(this.i18n.intl(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearInterval(this.timer));
  }

  protected formatDate(iso: string): string {
    return this.dateFormat().format(new Date(iso));
  }

  protected clock(): string {
    const seconds = this.seconds();
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  protected submitTexts(): void {
    if (this.texts().trim().length < 40) {
      this.toast.show(this.i18n.t('onboarding.voice.tooShort'));
      return;
    }
    void this.analyze({ source: 'pasted', texts: this.texts() });
  }

  protected startRecording(): void {
    this.seconds.set(0);
    this.mode.set('recording');
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.seconds.update((value) => value + 1);
      if (this.seconds() >= 60) this.stopRecording();
    }, 1000);
  }

  protected stopRecording(): void {
    clearInterval(this.timer);
    void this.analyze({ source: 'recording' });
  }

  protected cancelRecording(): void {
    clearInterval(this.timer);
    this.mode.set('sources');
  }

  protected editRow(key: RowKey, text: string): void {
    const card = this.card();
    if (!card) return;
    this.store.patch({ key: 'voice', value: { cards: [...this.voice().cards.slice(0, -1), { ...card, [key]: text }] } });
  }

  protected restore(older: VoiceCard): void {
    const { version: _version, createdAt: _createdAt, ...content } = older;
    this.toast.show(this.i18n.t('onboarding.voice.restored', { n: this.append(content) }));
  }

  protected addMore(): void {
    this.editing.set(false);
    this.adding.set(true);
  }

  private async analyze(sample: VoiceSample): Promise<void> {
    this.mode.set('sources');
    this.analyzing.set(true);
    this.steps.set([]);
    try {
      const analysis = await this.ai.analyzeVoice(sample, this.draft().identity, this.i18n.locale(), (steps) => this.steps.set(steps));
      const version = this.append(analysis);
      this.adding.set(false);
      this.texts.set('');
      this.toast.show(this.i18n.t('onboarding.voice.ready', { n: version }));
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('onboarding.voice.failed')));
    } finally {
      this.analyzing.set(false);
    }
  }

  private append(content: VoiceAnalysis): number {
    const cards = this.store.draft()?.voice.cards ?? this.voice().cards;
    const version = (cards.at(-1)?.version ?? 0) + 1;
    this.store.patch({ key: 'voice', value: { cards: [...cards, { ...content, version, createdAt: new Date().toISOString() }] } });
    return version;
  }
}
