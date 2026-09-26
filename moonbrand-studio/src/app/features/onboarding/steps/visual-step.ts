import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { BrandDraft, BrandLine, ChannelId, MediaFile, Palette, Visual } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName, lineFontFamily, PALETTE_SLOT_LABELS } from '@moonbrand/shared/domain/catalog';

import { BrandsService } from '../../../core/brands/brands.service';
import { errorMessage } from '../../../core/errors';
import { Icon } from '../../../ui/icon';
import { StepList } from '../../../ui/step-list';
import { ToastService } from '../../../ui/toast';
import { resizedDataUri } from '../images';
import { exampleChannels, MockAi } from '../mock-ai';
import { OnboardingStore } from '../onboarding.store';

const MAX_REFERENCES = 6;

const ASPECTS: Record<ChannelId, string> = { instagram: '4 / 5', facebook: '4 / 5', linkedin: '1 / 1', tiktok: '9 / 16', x: '16 / 9' };

function sameReferences(line: BrandLine | null | undefined, paths: readonly (string | null)[]): boolean {
  const now = [...new Set(paths.filter((path): path is string => Boolean(path)))].sort();
  if (!line?.from) return now.length === 0;
  const before = [...new Set(line.from)].sort();
  return before.length === now.length && before.every((path, i) => path === now[i]);
}

function isDark(hex: string): boolean {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return false;
  const value = parseInt(match[1], 16);
  return 0.299 * ((value >> 16) & 255) + 0.587 * ((value >> 8) & 255) + 0.114 * (value & 255) < 140;
}

function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

const loadedFonts = new Set<string>();

function loadFont(family: string): void {
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,400;0,600;0,700;0,800;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

@Component({
  selector: 'mb-visual-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StepList],
  templateUrl: './visual-step.html',
  styleUrl: './visual-step.scss',
})
export class VisualStep {
  private readonly ai = inject(MockAi);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  protected readonly store = inject(OnboardingStore);
  readonly draft = input.required<BrandDraft>();

  protected readonly slotLabels = PALETTE_SLOT_LABELS;
  protected readonly maxReferences = MAX_REFERENCES;
  protected readonly notes = signal('');
  protected readonly uploading = signal(0);
  protected readonly preparing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly hexDrafts = signal<string[]>([]);

  protected readonly visual = computed(() => this.draft().visual);
  protected readonly references = computed(() => this.visual().references ?? []);
  protected readonly line = computed(() => this.visual().line ?? null);
  protected readonly sitePalette = computed(() => this.store.insights()?.palette ?? (this.visual().palette.origin === 'site' ? this.visual().palette : null));
  protected readonly custom = computed(() => this.visual().palette.origin !== 'site');
  protected readonly correctable = computed(() => this.line() !== null && sameReferences(this.line(), this.references().map((file) => file.path)));
  protected readonly written = computed(() => this.notes().trim().length > 0);
  protected readonly placeholders = computed(() => Array.from({ length: this.uploading() }, (_, i) => i));

  protected readonly lineRows = computed(() => {
    const line = this.line();
    if (!line) return [];
    const voice = `${lineFontFamily(line.voice.font)}${line.voice.italic ? ' corsivo' : ''}`;
    const label = lineFontFamily(line.label.font);
    return [
      { label: 'Caratteri', text: voice === label ? voice : `${voice} per la voce, ${label} per le etichette` },
      { label: 'Firma', text: [line.signature, line.address].filter(Boolean).join(' · ') },
      { label: 'Rubriche', text: line.rubrics.map((rubric) => rubric.name).join(' · ') },
    ].filter((row) => row.text);
  });

  protected readonly previews = computed(() => {
    const line = this.line();
    if (!line) return [];
    const { identity } = this.draft();
    const dark = isDark(line.ground);
    const photos = this.visual().imageStyle !== 'text-only';
    const references = this.references();
    return exampleChannels(this.selectedChannels()).map((channel, index) => ({
      channel,
      name: channelName(channel),
      aspect: ASPECTS[channel],
      ground: line.ground,
      ink: dark ? '#FFFFFF' : '#15171F',
      muted: dark ? 'rgba(255,255,255,0.7)' : 'rgba(21,23,31,0.6)',
      accent: line.accent,
      voiceFont: lineFontFamily(line.voice.font),
      voiceWeight: line.voice.weight,
      voiceItalic: line.voice.italic,
      labelFont: lineFontFamily(line.label.font),
      kicker: line.rubrics[index % Math.max(1, line.rubrics.length)]?.name ?? '',
      headline: index === 0 ? `Ciao, siamo ${identity.name || 'noi'}` : (identity.pitch || 'Così lavoriamo').slice(0, 80),
      photo: photos && index !== 1 ? (references[index % Math.max(1, references.length)]?.url ?? null) : null,
      signature: line.signature,
      address: line.address,
      logo: this.visual().signature ? this.visual().logoUri : null,
    }));
  });

  constructor() {
    effect(() => {
      this.hexDrafts.set(this.visual().palette.colors.map((color) => color.toUpperCase()));
    });
    effect(() => {
      const line = this.line();
      if (!line) return;
      loadFont(lineFontFamily(line.voice.font));
      loadFont(lineFontFamily(line.label.font));
    });
  }

  private selectedChannels(): ChannelId[] {
    const selected = CHANNELS.filter(({ id }) => this.draft().channels[id].selected).map(({ id }) => id);
    return selected.length > 0 ? selected : ['instagram'];
  }

  private current(): Visual {
    return this.store.draft()?.visual ?? this.visual();
  }

  protected set(patch: Partial<Visual>): void {
    this.store.patch({ key: 'visual', value: { ...this.current(), ...patch } });
  }

  protected async pickLogo(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    try {
      this.set({ logoUri: await resizedDataUri(file, 512, 'image/png') });
      this.toast.show('Logo caricato.');
    } catch {
      this.toast.show('Questo file non è un’immagine che riesco a leggere: usa un PNG, un JPEG o un SVG.');
    }
  }

  protected async pickReferences(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const room = MAX_REFERENCES - this.references().length - this.uploading();
    const files = Array.from(inputEl.files ?? []).slice(0, Math.max(0, room));
    inputEl.value = '';
    if (files.length === 0) {
      this.toast.show(`Al massimo ${MAX_REFERENCES} immagini: togline una per aggiungerne altre.`);
      return;
    }
    this.uploading.update((count) => count + files.length);
    for (const file of files) {
      try {
        const uploaded = await this.brands.uploadReference(await resizedDataUri(file, 1600, 'image/jpeg'));
        this.set({ references: [...(this.current().references ?? []), uploaded] });
      } catch (error) {
        this.toast.show(errorMessage(error, 'Un’immagine è troppo pesante o non si legge: l’ho saltata.'));
      } finally {
        this.uploading.update((count) => Math.max(0, count - 1));
      }
    }
  }

  protected removeReference(file: MediaFile): void {
    this.set({ references: (this.current().references ?? []).filter((item) => item !== file) });
  }

  protected chooseSitePalette(): void {
    const palette = this.sitePalette();
    if (palette) this.set({ palette });
  }

  protected chooseCustom(): void {
    const { palette } = this.current();
    this.set({ palette: { id: 'custom', name: 'I miei colori', colors: [...palette.colors], origin: 'custom' } });
  }

  protected editHex(index: number, text: string): void {
    this.hexDrafts.update((drafts) => drafts.map((draft, i) => (i === index ? text : draft)));
    const hex = normalizeHex(text);
    if (!hex) return;
    const colors: Palette['colors'] = [...this.current().palette.colors];
    colors[index] = hex;
    this.set({ palette: { id: 'custom', name: 'I miei colori', colors, origin: 'custom' } });
  }

  protected send(): void {
    if (this.preparing() || (this.correctable() && !this.written())) return;
    void this.generate(false);
  }

  protected async generate(restart: boolean): Promise<void> {
    if (this.preparing()) return;
    const applied = this.correctable() && !restart && this.written();
    const request: Visual = { ...this.current(), notes: this.notes().trim() };
    this.store.patch({ key: 'visual', value: request });
    this.preparing.set(true);
    this.steps.set([]);
    try {
      const { draft } = this;
      const style = await this.ai.proposeVisualStyle(
        {
          identity: draft().identity,
          themes: draft().themes.map((theme) => theme.name).filter(Boolean),
          visual: request,
          channels: this.selectedChannels(),
          restart,
        },
        (steps) => this.steps.set(steps),
      );
      this.set({
        typography: style.typography,
        imageStyle: style.imageStyle,
        direction: style.direction,
        line: style.line,
        examples: [],
        ...(style.video && { video: style.video }),
      });
      if (applied) this.notes.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a preparare la linea. Riprova.'));
    } finally {
      this.preparing.set(false);
    }
  }
}
