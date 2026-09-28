import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, type OnInit } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import { currentVoiceCard, type BrandDraft, type ChannelId, type MediaFile, type Palette, type Visual } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName, PALETTE_SLOT_LABELS } from '@moonbrand/shared/domain/catalog';

import { AiJobsService } from '../../../core/ai/ai-jobs.service';
import { BrandsService } from '../../../core/brands/brands.service';
import { errorMessage } from '../../../core/errors';
import { Icon } from '../../../ui/icon';
import { LogoBackdrop } from '../../../ui/logo-backdrop';
import { LightboxService } from '../../../ui/lightbox';
import { StepList } from '../../../ui/step-list';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';
import { LOGO_SIDE, resizedDataUri } from '../../../core/images';

const MAX_REFERENCES = 6;

function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(input.trim());
  return match ? `#${match[1].toUpperCase()}` : null;
}

@Component({
  selector: 'mb-visual-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, LogoBackdrop, StepList],
  templateUrl: './visual-step.html',
  styleUrl: './visual-step.scss',
})
export class VisualStep implements OnInit {
  private readonly ai = inject(AiJobsService);
  private readonly brands = inject(BrandsService);
  private readonly toast = inject(ToastService);
  private readonly lightbox = inject(LightboxService);
  protected readonly store = inject(DraftStore);
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
  protected readonly sitePalette = computed(() => this.store.insights()?.palette ?? (this.visual().palette.origin === 'site' ? this.visual().palette : null));
  protected readonly custom = computed(() => this.visual().palette.origin !== 'site');
  protected readonly placeholders = computed(() => Array.from({ length: this.uploading() }, (_, i) => i));
  // Un canale dopo l'altro, nell'ordine del catalogo.
  protected readonly examples = computed(() => {
    const examples = this.store.examples() ?? [];
    const unselected = this.store.unselectedExamples();
    return CHANNELS.flatMap(({ id }) =>
      examples
        .filter((example) => example.channel === id)
        .map((example) => ({ ...example, name: channelName(id), selected: !unselected.includes(example.file) })),
    );
  });
  protected readonly selectedCount = computed(() => this.examples().filter((example) => example.selected).length);

  constructor() {
    effect(() => {
      this.hexDrafts.set(this.visual().palette.colors.map((color) => color.toUpperCase()));
    });
  }

  ngOnInit(): void {
    this.notes.set(this.visual().notes ?? '');
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
      this.set({ logoUri: await resizedDataUri(file, LOGO_SIDE, 'image/png') });
      this.toast.show('Logo caricato.');
    } catch {
      this.toast.show('Questo file non è un’immagine che riesco a leggere: usa un PNG, un JPEG o un SVG.');
    }
  }

  protected async pickReferences(event: Event): Promise<void> {
    const inputEl = event.target as HTMLInputElement;
    const brandId = this.store.brandId();
    const room = MAX_REFERENCES - this.references().length - this.uploading();
    const files = Array.from(inputEl.files ?? []).slice(0, Math.max(0, room));
    inputEl.value = '';
    if (!brandId) return;
    if (files.length === 0) {
      this.toast.show(`Al massimo ${MAX_REFERENCES} immagini: togline una per aggiungerne altre.`);
      return;
    }
    this.uploading.update((count) => count + files.length);
    for (const file of files) {
      try {
        const uploaded = await this.brands.uploadReference(brandId, await resizedDataUri(file, 1600, 'image/jpeg'));
        this.set({ references: [...(this.current().references ?? []), uploaded] });
      } catch (error) {
        this.toast.show(errorMessage(error, 'Un’immagine è troppo pesante o non si legge: l’ho saltata.'));
      } finally {
        this.uploading.update((count) => Math.max(0, count - 1));
      }
    }
  }

  protected async removeReference(file: MediaFile): Promise<void> {
    try {
      await this.store.removeReference(file);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a togliere l’immagine. Riprova.'));
    }
  }

  protected openReference(index: number): void {
    this.lightbox.open(
      this.references().map((file, i) => ({ url: file.url, alt: `Riferimento ${i + 1}` })),
      index,
    );
  }

  protected openExample(index: number): void {
    this.lightbox.open(
      this.examples().map((example) => ({ url: example.url, alt: `Esempio per ${example.name}`, caption: example.caption })),
      index,
    );
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

  // Con gli esempi già pronti le indicazioni li modificano (stessa sessione di Claude), altrimenti ne guidano la generazione.
  protected sendNotes(): void {
    const instruction = this.notes().trim();
    const jobId = this.store.examplesJobId();
    if (!instruction || this.preparing()) return;
    if (jobId && this.examples().length > 0) void this.editExamples(jobId, instruction);
    else void this.createExamples();
  }

  private async editExamples(jobId: string, instruction: string): Promise<void> {
    this.preparing.set(true);
    this.steps.set([]);
    try {
      const edited = await this.ai.editExamples({ jobId, instruction }, (steps) => this.steps.set(steps));
      this.store.setExamples(edited.examples, edited.jobId, true);
      this.notes.set('');
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a modificare gli esempi. Riprova.'));
    } finally {
      this.preparing.set(false);
    }
  }

  protected async createExamples(): Promise<void> {
    const brandId = this.store.brandId();
    if (this.preparing() || !brandId) return;
    const notes = this.notes().trim();
    this.set({ notes });
    const draft = this.draft();
    const brand: VisualBrandContext = {
      identity: draft.identity,
      positioning: draft.positioning,
      channels: this.selectedChannels(),
      themes: draft.themes.map((theme) => theme.name).filter(Boolean),
      voice: currentVoiceCard(draft.voice),
      palette: [...this.current().palette.colors],
      notes,
    };
    this.preparing.set(true);
    this.steps.set([]);
    try {
      const created = await this.ai.createExamples({ brandId, brand }, (steps) => this.steps.set(steps));
      this.store.setExamples(created.examples, created.jobId);
    } catch (error) {
      this.toast.show(errorMessage(error, 'Non sono riuscito a preparare gli esempi. Riprova.'));
    } finally {
      this.preparing.set(false);
    }
  }
}
