import { Injectable, computed, effect, inject, signal } from '@angular/core';

import type { PositioningIdeas, WebsiteInsights } from '@moonbrand/shared/ai/steps';
import type { VisualExampleFile } from '@moonbrand/shared/api/contract';
import { applyPatch, type BrandDraft, type BrandKind, type Identity, type SectionKey, type SectionPatch } from '@moonbrand/shared/domain/brand';
import { changeDraftKind, createEmptyDraft } from '@moonbrand/shared/domain/catalog';
import { ONBOARDING_SECTION_KEYS } from '@moonbrand/shared/domain/sections';
import { createThemes } from '@moonbrand/shared/domain/themes';

import { AuthService } from '../../core/auth/auth.service';

export type OnboardingStep = 'intro' | SectionKey | 'summary';

export const ONBOARDING_STEPS: OnboardingStep[] = ['intro', ...ONBOARDING_SECTION_KEYS, 'summary'];

interface State {
  // Id del brand scelto già con la bozza: i file di riferimento vanno nella sua cartella prima che il brand esista.
  brandId: string | null;
  stepIndex: number;
  direction: 1 | -1;
  draft: BrandDraft | null;
  insights: WebsiteInsights | null;
  themesEdited: boolean;
  positioningIdeas: { key: string; ideas: PositioningIdeas } | null;
  examples: VisualExampleFile[] | null;
}

const INITIAL: State = {
  brandId: null,
  stepIndex: 0,
  direction: 1,
  draft: null,
  insights: null,
  themesEdited: false,
  positioningIdeas: null,
  examples: null,
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

const clamp = (index: number) => Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index));

@Injectable({ providedIn: 'root' })
export class OnboardingStore {
  private readonly auth = inject(AuthService);
  private readonly storageKey = computed(() => `moonbrand/onboarding/v1/${this.auth.account()?.id ?? 'anon'}`);
  private readonly state = signal<State>(this.read(this.storageKey()));

  readonly stepIndex = computed(() => (this.state().draft ? this.state().stepIndex : 0));
  readonly step = computed(() => ONBOARDING_STEPS[this.stepIndex()]);
  readonly direction = computed(() => this.state().direction);
  readonly draft = computed(() => this.state().draft);
  readonly insights = computed(() => this.state().insights);
  readonly positioningIdeas = computed(() => this.state().positioningIdeas);
  readonly brandId = computed(() => this.state().brandId);
  readonly examples = computed(() => this.state().examples);

  constructor() {
    effect(() => {
      const key = this.storageKey();
      this.state.set(this.read(key));
    });
    effect(() => {
      const value = this.state();
      try {
        localStorage.setItem(this.storageKey(), JSON.stringify(value));
      } catch {}
    });
  }

  goTo(index: number): void {
    this.state.update((state) => ({ ...state, stepIndex: clamp(index), direction: index >= state.stepIndex ? 1 : -1 }));
  }

  next(): void {
    this.state.update((state) => ({ ...state, stepIndex: clamp(state.stepIndex + 1), direction: 1 }));
  }

  back(): void {
    this.state.update((state) => ({ ...state, stepIndex: clamp(state.stepIndex - 1), direction: -1 }));
  }

  chooseKind(kind: BrandKind): void {
    this.state.update((state) => ({
      ...state,
      brandId: state.brandId ?? crypto.randomUUID(),
      draft: state.draft ? changeDraftKind(state.draft, kind) : createEmptyDraft(kind),
    }));
  }

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

  setExamples(examples: VisualExampleFile[] | null): void {
    this.state.update((state) => ({ ...state, examples }));
  }

  reset(): void {
    this.state.set(INITIAL);
  }

  private read(key: string): State {
    try {
      const raw = localStorage.getItem(key);
      const state: State = raw ? { ...INITIAL, ...(JSON.parse(raw) as Partial<State>) } : INITIAL;
      return state.draft && !state.brandId ? { ...state, brandId: crypto.randomUUID() } : state;
    } catch {
      return INITIAL;
    }
  }
}
