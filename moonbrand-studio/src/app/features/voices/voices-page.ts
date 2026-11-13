import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

import type { VoicesResponse } from '@moonbrand/shared/api/contract';
import { VOICE_SAMPLE_MIN_SECONDS, type BrandVoice, type LibraryVoice } from '@moonbrand/shared/domain/voice';

import { BrandsService } from '../../core/brands/brands.service';
import { MicrophoneError, Recorder } from '../../core/chat/recorder';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { pageHeader } from '../../core/layout/page-header';
import { VoicesService } from '../../core/voices/voices.service';
import { ConfirmService } from '../../ui/confirm';
import { Icon } from '../../ui/icon';
import { Loader } from '../../ui/loader';
import { Select, type SelectOption } from '../../ui/select';
import { ToastService } from '../../ui/toast';

// Le lingue da filtrare nella libreria: quelle dei post, più quelle dei mercati vicini.
const LANGUAGES = ['it', 'en', 'fr', 'es', 'de', 'pt'];
// Una registrazione per la voce: oltre i 5 minuti l'API la rifiuta.
const MAX_RECORDING_S = 300;

function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Impostazioni → Voci: le voci fuori campo del brand. Si clona la propria da un audio o se ne sceglie una della
// libreria di ElevenLabs; la predefinita è quella che usa la chat.
@Component({
  selector: 'mb-voices-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, Loader, Select, TranslatePipe],
  template: `
    <section class="voices">
      <header class="texts">
        <h1 class="title">{{ 'voices.title' | t }}</h1>
        <p class="caption">{{ 'voices.intro' | t: { max: max() } }}</p>
      </header>

      @if (loading()) {
        <div class="empty"><mb-loader /></div>
      } @else if (data(); as current) {
        <div class="panel list">
          @for (voice of current.voices; track voice.id) {
            <div class="voice">
              <button class="icon-btn play" type="button" [class.on]="playing() === voice.previewUrl" [disabled]="!voice.previewUrl"
                [attr.aria-label]="'voices.play' | t: { name: voice.name }" (click)="play(voice.previewUrl)">
                <mb-icon [name]="playing() === voice.previewUrl ? 'square' : 'play'" [size]="14" />
              </button>
              <div class="grow texts">
                @if (renaming() === voice.id) {
                  <div class="row">
                    <input class="sunken grow" maxlength="60" [attr.aria-label]="'voices.nameLabel' | t" [value]="voice.name"
                      (input)="newName.set($any($event.target).value)" (keydown.enter)="rename(voice)" />
                    <button class="btn btn-primary btn-sm" type="button" [disabled]="busy()" (click)="rename(voice)">{{ 'voices.save' | t }}</button>
                    <button class="btn btn-ghost btn-sm" type="button" (click)="renaming.set(null)">{{ 'voices.cancel' | t }}</button>
                  </div>
                } @else {
                  <span class="name">
                    <span class="strong-sm">{{ voice.name }}</span>
                    @if (voice.isDefault) {
                      <span class="badge">{{ 'voices.default' | t }}</span>
                    }
                  </span>
                  <span class="caption">{{ voiceLine(voice) }}</span>
                }
              </div>
              @if (renaming() !== voice.id) {
                <div class="actions">
                  @if (!voice.isDefault) {
                    <button class="link-btn" type="button" [disabled]="busy()" (click)="makeDefault(voice)">{{ 'voices.makeDefault' | t }}</button>
                  }
                  <button class="icon-btn" type="button" [attr.aria-label]="'voices.rename' | t" [title]="'voices.rename' | t" (click)="startRename(voice)">
                    <mb-icon name="pen" [size]="15" />
                  </button>
                  <button class="icon-btn" type="button" [attr.aria-label]="'voices.remove' | t" [title]="'voices.remove' | t" [disabled]="busy()" (click)="remove(voice)">
                    <mb-icon name="trash" [size]="15" />
                  </button>
                </div>
              }
            </div>
          } @empty {
            <div class="empty small">
              <p class="strong-sm">{{ 'voices.none' | t }}</p>
              <p class="caption">{{ 'voices.noneHint' | t }}</p>
            </div>
          }
        </div>

        @if (full()) {
          <p class="caption">{{ 'voices.full' | t: { max: max() } }}</p>
        } @else {
          <section class="panel add">
            <div class="texts">
              <p class="label">{{ 'voices.cloneTitle' | t }}</p>
              <p class="caption">{{ (current.cloning ? 'voices.cloneHint' : 'voices.cloneOff') | t: { min: minSeconds } }}</p>
            </div>
            @if (current.cloning) {
              @if (sample(); as audio) {
                <div class="row sample">
                  <button class="icon-btn play" type="button" [class.on]="playing() === audio.url" [attr.aria-label]="'voices.play' | t: { name: audio.label }"
                    (click)="play(audio.url)">
                    <mb-icon [name]="playing() === audio.url ? 'square' : 'play'" [size]="14" />
                  </button>
                  <span class="grow caption">{{ audio.label }}</span>
                  <button class="link-btn" type="button" (click)="discard()">{{ 'voices.discard' | t }}</button>
                </div>
                <label class="field">
                  <span class="label">{{ 'voices.nameLabel' | t }}</span>
                  <input class="sunken" maxlength="60" [placeholder]="'voices.namePlaceholder' | t" [value]="cloneName()" (input)="cloneName.set($any($event.target).value)" />
                </label>
                <label class="consent">
                  <input type="checkbox" [checked]="consent()" (change)="consent.set($any($event.target).checked)" />
                  <span class="caption">{{ 'voices.consent' | t }}</span>
                </label>
                <button class="btn btn-primary align-start" type="button" [disabled]="!canClone()" (click)="clone()">
                  @if (cloning()) {
                    <span class="spinner"></span> {{ 'voices.cloning' | t }}
                  } @else {
                    {{ 'voices.clone' | t }}
                  }
                </button>
              } @else {
                <div class="row">
                  <input #picker class="file-input" type="file" accept="audio/*,video/*" tabindex="-1" (change)="picked($event)" />
                  <button class="btn btn-secondary btn-sm" type="button" [disabled]="recording()" (click)="picker.click()">
                    <mb-icon name="paperclip" [size]="14" /> {{ 'voices.pickFile' | t }}
                  </button>
                  <button class="btn btn-secondary btn-sm" type="button" [class.recording]="recording()" (click)="toggleRecording()">
                    <mb-icon [name]="recording() ? 'square' : 'mic'" [size]="14" />
                    {{ (recording() ? 'voices.stopRecording' : 'voices.record') | t }}
                  </button>
                  @if (recording()) {
                    <span class="caption" aria-live="polite">{{ 'voices.recording' | t: { time: clock(elapsed()) } }}</span>
                  }
                </div>
              }
            }
          </section>
        }

        <section class="panel add">
          <div class="texts">
            <p class="label">{{ 'voices.libraryTitle' | t }}</p>
            <p class="caption">{{ 'voices.libraryHint' | t }}</p>
          </div>
          <form class="row filters" (submit)="$event.preventDefault(); search()">
            <input class="sunken grow" maxlength="80" [attr.aria-label]="'voices.searchLabel' | t" [placeholder]="'voices.searchPlaceholder' | t"
              [value]="query()" (input)="query.set($any($event.target).value)" />
            <mb-select class="filter" [options]="languageOptions()" [value]="language()" (changed)="language.set($event)" />
            <mb-select class="filter" [options]="genderOptions()" [value]="gender()" (changed)="gender.set($event)" />
            <button class="btn btn-secondary btn-sm" type="submit" [disabled]="searching()">
              @if (searching()) {
                <span class="spinner"></span>
              } @else {
                <mb-icon name="search" [size]="14" />
              }
              {{ 'voices.search' | t }}
            </button>
          </form>
          @if (results(); as found) {
            <div class="results">
              @for (voice of found; track voice.voiceId) {
                <div class="voice">
                  <button class="icon-btn play" type="button" [class.on]="playing() === voice.previewUrl" [disabled]="!voice.previewUrl"
                    [attr.aria-label]="'voices.play' | t: { name: voice.name }" (click)="play(voice.previewUrl)">
                    <mb-icon [name]="playing() === voice.previewUrl ? 'square' : 'play'" [size]="14" />
                  </button>
                  <div class="grow texts">
                    <span class="strong-sm">{{ voice.name }}</span>
                    <span class="caption line">{{ libraryLine(voice) }}</span>
                  </div>
                  @if (owned().has(voice.voiceId)) {
                    <span class="caption">{{ 'voices.already' | t }}</span>
                  } @else {
                    <button class="btn btn-secondary btn-sm" type="button" [disabled]="full() || busy()" (click)="add(voice)">
                      <mb-icon name="plus" [size]="14" /> {{ 'voices.add' | t }}
                    </button>
                  }
                </div>
              } @empty {
                <p class="caption">{{ 'voices.noResults' | t }}</p>
              }
            </div>
          }
        </section>
      } @else {
        <div class="empty">
          <p class="strong-sm">{{ 'voices.loadFailed' | t }}</p>
          <button class="btn btn-secondary btn-sm" type="button" (click)="reload()">{{ 'common.retry' | t }}</button>
        </div>
      }
    </section>
  `,
  styles: `
    .voices {
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin: 0 auto;
      animation: fade-up 240ms var(--ease);
    }
    .texts {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .title {
      margin: 0;
    }
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 48px 16px;
      text-align: center;
    }
    .empty.small {
      padding: 20px 8px;
    }
    .list {
      gap: 0;
      padding: 6px 20px;
    }
    .voice {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--grey-100);
    }
    .voice:first-child {
      border-top: 0;
    }
    .play {
      flex: none;
    }
    .play.on {
      color: var(--text-title);
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .line {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .actions {
      display: flex;
      flex: none;
      align-items: center;
      gap: 4px;
    }
    .add {
      gap: 14px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .filters .filter {
      width: 150px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .consent {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      cursor: pointer;
    }
    .consent input {
      margin-top: 3px;
    }
    .align-start {
      align-self: flex-start;
    }
    .recording {
      color: var(--danger);
    }
    .results {
      display: flex;
      flex-direction: column;
    }
    @media (max-width: 640px) {
      .filters .filter {
        width: calc(50% - 4px);
      }
      .filters input {
        flex-basis: 100%;
      }
    }
  `,
})
export class VoicesPage {
  private readonly voices = inject(VoicesService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly i18n = inject(I18nService);
  protected readonly clock = clock;
  protected readonly minSeconds = VOICE_SAMPLE_MIN_SECONDS;

  private readonly brandId = computed(() => this.brands.activeBrand()?.id ?? null);
  protected readonly data = signal<VoicesResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly max = computed(() => this.data()?.max ?? 3);
  protected readonly full = computed(() => (this.data()?.voices.length ?? 0) >= this.max());
  protected readonly owned = computed(() => new Set(this.data()?.voices.map((voice) => voice.voiceId) ?? []));

  protected readonly renaming = signal<string | null>(null);
  protected readonly newName = signal('');

  // La voce da clonare: il file scelto o la registrazione, con il suo ascolto.
  protected readonly sample = signal<{ blob: Blob; url: string; label: string } | null>(null);
  protected readonly cloneName = signal('');
  protected readonly consent = signal(false);
  protected readonly cloning = signal(false);
  protected readonly canClone = computed(() => Boolean(this.sample()) && this.cloneName().trim().length > 0 && this.consent() && !this.cloning());
  protected readonly recording = signal(false);
  protected readonly elapsed = signal(0);
  private readonly recorder = new Recorder();
  private timer?: ReturnType<typeof setInterval>;

  protected readonly query = signal('');
  protected readonly language = signal('');
  protected readonly gender = signal('');
  protected readonly searching = signal(false);
  protected readonly results = signal<LibraryVoice[] | null>(null);

  // Un ascolto per volta: lo stesso pulsante lo ferma.
  protected readonly playing = signal<string | null>(null);
  private readonly audio = new Audio();

  protected readonly languageOptions = computed<SelectOption[]>(() => {
    const names = new Intl.DisplayNames([this.i18n.locale()], { type: 'language' });
    return [{ value: '', label: this.i18n.t('voices.anyLanguage') }, ...LANGUAGES.map((code) => ({ value: code, label: names.of(code) ?? code }))];
  });
  protected readonly genderOptions = computed<SelectOption[]>(() => [
    { value: '', label: this.i18n.t('voices.anyGender') },
    { value: 'female', label: this.i18n.t('voices.female') },
    { value: 'male', label: this.i18n.t('voices.male') },
    { value: 'neutral', label: this.i18n.t('voices.neutral') },
  ]);

  constructor() {
    pageHeader(() => [{ label: this.i18n.t('profile.title'), link: '/impostazioni' }, { label: this.i18n.t('voices.title') }]);
    this.audio.onended = () => this.playing.set(null);
    effect(() => {
      const brandId = this.brandId();
      if (brandId) untracked(() => void this.load(brandId));
    });
    // La lingua dell'interfaccia è il primo filtro della libreria.
    effect(() => {
      const locale = this.i18n.locale();
      untracked(() => this.language() || this.language.set(locale));
    });
    inject(DestroyRef).onDestroy(() => {
      this.audio.pause();
      clearInterval(this.timer);
      this.recorder.cancel();
      const sample = this.sample();
      if (sample) URL.revokeObjectURL(sample.url);
    });
  }

  protected reload(): void {
    const brandId = this.brandId();
    if (brandId) void this.load(brandId);
  }

  private async load(brandId: string): Promise<void> {
    this.loading.set(true);
    try {
      const data = await this.voices.list(brandId);
      if (this.brandId() === brandId) this.data.set(data);
    } catch (error) {
      this.data.set(null);
      this.toast.show(errorMessage(error, this.i18n.t('voices.loadFailed')));
    } finally {
      if (this.brandId() === brandId) this.loading.set(false);
    }
  }

  protected voiceLine(voice: BrandVoice): string {
    return [this.i18n.t(voice.kind === 'clone' ? 'voices.kindClone' : 'voices.kindLibrary'), voice.language, voice.description].filter(Boolean).join(' · ');
  }

  protected libraryLine(voice: LibraryVoice): string {
    const gender = voice.gender === 'male' || voice.gender === 'female' || voice.gender === 'neutral' ? this.i18n.t(`voices.${voice.gender}`) : voice.gender;
    return [voice.language, gender, voice.accent, voice.description].filter(Boolean).join(' · ');
  }

  protected play(url: string | null): void {
    if (!url) return;
    if (this.playing() === url) {
      this.audio.pause();
      this.playing.set(null);
      return;
    }
    this.audio.src = url;
    this.playing.set(url);
    this.audio.play().catch(() => this.playing.set(null));
  }

  // Un'azione sulle voci: rilegge la lista alla fine, e un errore lo dice il toast.
  private async act(work: (brandId: string) => Promise<unknown>, done?: string): Promise<boolean> {
    const brandId = this.brandId();
    if (!brandId || this.busy()) return false;
    this.busy.set(true);
    try {
      await work(brandId);
      if (done) this.toast.show(done);
      await this.load(brandId);
      return true;
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('voices.failed')));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected makeDefault(voice: BrandVoice): void {
    void this.act((brandId) => this.voices.update(brandId, voice.id, { isDefault: true }));
  }

  protected startRename(voice: BrandVoice): void {
    this.newName.set(voice.name);
    this.renaming.set(voice.id);
  }

  protected async rename(voice: BrandVoice): Promise<void> {
    const name = this.newName().trim();
    if (!name || name === voice.name) return this.renaming.set(null);
    if (await this.act((brandId) => this.voices.update(brandId, voice.id, { name }))) this.renaming.set(null);
  }

  protected async remove(voice: BrandVoice): Promise<void> {
    const confirmed = await this.confirm.ask({
      title: this.i18n.t('voices.removeConfirm', { name: voice.name }),
      confirmLabel: this.i18n.t('voices.remove'),
      tone: 'danger',
    });
    if (confirmed) await this.act((brandId) => this.voices.remove(brandId, voice.id), this.i18n.t('voices.removed'));
  }

  protected add(voice: LibraryVoice): void {
    void this.act(
      (brandId) =>
        this.voices.addLibrary(brandId, {
          voiceId: voice.voiceId,
          name: voice.name.slice(0, 60),
          language: voice.language,
          description: voice.description,
          previewUrl: voice.previewUrl,
        }),
      this.i18n.t('voices.added'),
    );
  }

  protected async search(): Promise<void> {
    this.searching.set(true);
    try {
      const { voices } = await this.voices.search({ q: this.query().trim(), language: this.language(), gender: this.gender() });
      this.results.set(voices);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('voices.failed')));
    } finally {
      this.searching.set(false);
    }
  }

  private setSample(blob: Blob, label: string): void {
    this.discard();
    this.sample.set({ blob, url: URL.createObjectURL(blob), label });
  }

  protected discard(): void {
    const sample = this.sample();
    if (sample) {
      if (this.playing() === sample.url) this.play(sample.url);
      URL.revokeObjectURL(sample.url);
    }
    this.sample.set(null);
  }

  protected picked(event: Event): void {
    const element = event.target as HTMLInputElement;
    const file = element.files?.[0];
    element.value = '';
    if (file) this.setSample(file, file.name);
  }

  protected async toggleRecording(): Promise<void> {
    if (this.recording()) return this.finishRecording();
    try {
      await this.recorder.start();
    } catch (error) {
      this.toast.show(this.i18n.t(error instanceof MicrophoneError ? error.key : 'chat.composer.micFailed'));
      return;
    }
    this.elapsed.set(0);
    this.recording.set(true);
    this.timer = setInterval(() => {
      this.elapsed.update((seconds) => seconds + 1);
      if (this.elapsed() >= MAX_RECORDING_S) void this.finishRecording();
    }, 1000);
  }

  private async finishRecording(): Promise<void> {
    clearInterval(this.timer);
    this.recording.set(false);
    const audio = await this.recorder.stop();
    if (audio.size === 0) return;
    if (this.elapsed() < VOICE_SAMPLE_MIN_SECONDS) {
      this.toast.show(this.i18n.t('voices.tooShort', { min: VOICE_SAMPLE_MIN_SECONDS }));
      return;
    }
    this.setSample(audio, this.i18n.t('voices.recorded', { time: clock(this.elapsed()) }));
  }

  protected async clone(): Promise<void> {
    const sample = this.sample();
    const brandId = this.brandId();
    if (!sample || !brandId || !this.canClone()) return;
    this.cloning.set(true);
    try {
      await this.voices.clone(brandId, this.cloneName().trim(), sample.blob);
      this.toast.show(this.i18n.t('voices.cloned'));
      this.discard();
      this.cloneName.set('');
      this.consent.set(false);
      await this.load(brandId);
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('voices.failed')));
    } finally {
      this.cloning.set(false);
    }
  }
}
