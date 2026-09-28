import { computed, type WritableSignal } from '@angular/core';

import type { PositioningIdeas, WebsiteInsights } from '@moonbrand/shared/ai/steps';
import type { VisualExampleFile } from '@moonbrand/shared/api/contract';
import { applyPatch, type BrandDraft, type Identity, type MediaFile, type SectionPatch } from '@moonbrand/shared/domain/brand';
import { createEmptyDraft } from '@moonbrand/shared/domain/catalog';
import { createThemes } from '@moonbrand/shared/domain/themes';

export interface DraftState {
  // Id del brand: i file di riferimento e gli esempi vanno nella sua cartella, anche prima che il brand esista.
  brandId: string | null;
  draft: BrandDraft | null;
  insights: WebsiteInsights | null;
  themesEdited: boolean;
  positioningIdeas: { key: string; ideas: PositioningIdeas } | null;
  examples: VisualExampleFile[] | null;
  examplesJobId: string | null;
  // Gli esempi partono tutti scelti: qui solo quelli tolti.
  unselectedExamples: string[];
}

export const EMPTY_DRAFT_STATE: DraftState = {
  brandId: null,
  draft: null,
  insights: null,
  themesEdited: false,
  positioningIdeas: null,
  examples: null,
  examplesJobId: null,
  unselectedExamples: [],
};

// Un campo si riempie dal sito solo se è vuoto o contiene ancora quanto letto la volta prima.
function fillFromSite(identity: Identity, insights: WebsiteInsights, previous: WebsiteInsights | null): Identity {
  const fill = (value: string, next: string, before: string | undefined) => (next && (!value.trim() || value === before) ? next : value);
  const nameKey = identity.kind === 'person' ? 'company' : 'name';
  return {
    ...identity,
    [nameKey]: fill(identity[nameKey], insights.name, previous?.name),
    ...(identity.kind !== 'person' && { sector: fill(identity.sector, insights.sector, previous?.sector) }),
    pitch: fill(identity.pitch, insights.pitch, previous?.pitch),
  };
}

// La bozza di un brand e quello che la accompagna mentre la si scrive: la usano i passi dell'onboarding,
// sia per un brand nuovo (OnboardingStore) sia per modificarne uno dalle Impostazioni brand.
export abstract class DraftStore<S extends DraftState = DraftState> {
  protected abstract readonly state: WritableSignal<S>;

  readonly draft = computed(() => this.state().draft);
  readonly insights = computed(() => this.state().insights);
  readonly positioningIdeas = computed(() => this.state().positioningIdeas);
  readonly brandId = computed(() => this.state().brandId);
  readonly examples = computed(() => this.state().examples);
  readonly unselectedExamples = computed(() => this.state().unselectedExamples);
  readonly examplesJobId = computed(() => this.state().examplesJobId);
  readonly selectedExamples = computed(() =>
    (this.state().examples ?? []).map((example) => example.file).filter((file) => !this.state().unselectedExamples.includes(file)),
  );

  // Togliere un'immagine di riferimento: subito per un brand nuovo, al salvataggio dalle Impostazioni brand.
  abstract removeReference(file: MediaFile): Promise<void>;

  patch(patch: SectionPatch): void {
    this.state.update((state) =>
      state.draft ? { ...state, draft: applyPatch(state.draft, patch), themesEdited: state.themesEdited || patch.key === 'themes' } : state,
    );
  }

  applyInsights(insights: WebsiteInsights): void {
    this.state.update((state) => {
      const current = state.draft;
      if (!current) return state;
      const otherBrand = state.insights !== null && state.insights.site !== insights.site;
      const draft = otherBrand
        ? { ...createEmptyDraft(current.identity.kind), identity: current.identity, channels: current.channels }
        : current;
      const themesEdited = otherBrand ? false : state.themesEdited;
      return {
        ...state,
        insights,
        themesEdited,
        positioningIdeas: otherBrand ? null : state.positioningIdeas,
        draft: {
          ...draft,
          identity: fillFromSite(draft.identity, insights, state.insights),
          themes: themesEdited ? draft.themes : createThemes(insights.themes),
          visual: draft.visual.palette.origin === 'custom' ? draft.visual : { ...draft.visual, palette: insights.palette },
        },
      };
    });
  }

  applyPositioningIdeas(key: string, ideas: PositioningIdeas): void {
    this.state.update((state) => {
      const { draft } = state;
      if (!draft || state.positioningIdeas?.key === key) return state;
      const { goals, audiences } = draft.positioning;
      return {
        ...state,
        positioningIdeas: { key, ideas },
        draft: {
          ...draft,
          positioning: {
            ...draft.positioning,
            goals: goals.length > 0 ? goals : ideas.picked.goals,
            audiences: audiences.length > 0 ? audiences : ideas.picked.audiences,
          },
        },
      };
    });
  }

  // Una modifica tiene la selezione (i file hanno gli stessi nomi), una generazione nuova la azzera.
  setExamples(examples: VisualExampleFile[] | null, jobId: string | null, keepSelection = false): void {
    this.state.update((state) => ({ ...state, examples, examplesJobId: jobId, unselectedExamples: keepSelection ? state.unselectedExamples : [] }));
  }

  toggleExample(file: string): void {
    this.state.update((state) => ({
      ...state,
      unselectedExamples: state.unselectedExamples.includes(file)
        ? state.unselectedExamples.filter((item) => item !== file)
        : [...state.unselectedExamples, file],
    }));
  }

  protected withoutReference(file: MediaFile): void {
    const draft = this.state().draft;
    if (!draft) return;
    this.patch({ key: 'visual', value: { ...draft.visual, references: (draft.visual.references ?? []).filter((item) => item !== file) } });
  }
}
