import { Injectable, computed, inject, signal } from '@angular/core';

import type { BrandDraft, ChannelId, ChannelState, MediaFile } from '@moonbrand/shared/domain/brand';

import { BrandsService } from '../../core/brands/brands.service';
import { DraftStore, EMPTY_DRAFT_STATE, type DraftState } from '../onboarding/draft-store';

// La bozza di una sezione aperta dalle Impostazioni brand: parte dal brand salvato e ci torna solo con Salva.
@Injectable()
export class ProfileDraftStore extends DraftStore {
  private readonly brands = inject(BrandsService);
  protected readonly state = signal<DraftState>(EMPTY_DRAFT_STATE);
  private readonly saved = signal<BrandDraft | null>(null);
  // Le immagini di riferimento tolte: i file si cancellano dopo il salvataggio, così Annulla le ritrova.
  private removed: MediaFile[] = [];

  readonly dirty = computed(() => this.state().draft !== this.saved());
  // Il brand com'è salvato: cambia anche senza Salva quando si collega o scollega un canale.
  readonly savedDraft = this.saved.asReadonly();
  override unsaved(): boolean {
    return this.dirty();
  }

  // Un canale collegato o scollegato è già salvato dal server: cambia sia il brand salvato sia la bozza,
  // e le altre modifiche ancora da salvare restano tali.
  override applyChannel(id: ChannelId, channel: ChannelState): void {
    const withChannel = (draft: BrandDraft): BrandDraft => ({ ...draft, channels: { ...draft.channels, [id]: channel } });
    const dirty = this.dirty();
    const saved = this.saved();
    const next = saved && withChannel(saved);
    this.saved.set(next);
    this.state.update((state) => ({ ...state, draft: state.draft && (dirty ? withChannel(state.draft) : next) }));
  }

  start(brandId: string, draft: BrandDraft): void {
    this.saved.set(draft);
    this.state.set({ ...EMPTY_DRAFT_STATE, brandId, draft });
    this.removed = [];
  }

  async removeReference(file: MediaFile): Promise<void> {
    if (file.path) this.removed.push(file);
    this.withoutReference(file);
  }

  // Gli esempi rifatti e scelti prendono il posto dei riferimenti da seguire.
  async save(): Promise<BrandDraft> {
    const { brandId, draft: written } = this.state();
    if (!brandId || !written) throw new Error('Nessuna bozza da salvare.');
    // Le righe lasciate vuote non si salvano.
    const { profiles, milestones } = written.references;
    const draft: BrandDraft = {
      ...written,
      references: {
        ...written.references,
        profiles: profiles.map((profile) => profile.trim()).filter(Boolean),
        milestones: milestones.filter((milestone) => milestone.label.trim()),
      },
    };
    await this.brands.update(brandId, draft, this.selectedExamples());
    for (const file of this.removed) {
      if (file.path) await this.brands.removeReference(brandId, file.path).catch(() => undefined);
    }
    this.start(brandId, draft);
    return draft;
  }
}
