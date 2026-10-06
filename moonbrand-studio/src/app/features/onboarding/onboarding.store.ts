import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';

import type { BrandKind, ChannelId, ChannelState, MediaFile, SectionKey } from '@moonbrand/shared/domain/brand';
import { changeDraftKind, createEmptyDraft } from '@moonbrand/shared/domain/catalog';
import { ONBOARDING_SECTION_KEYS } from '@moonbrand/shared/domain/sections';

import { AuthService } from '../../core/auth/auth.service';
import { BrandsService } from '../../core/brands/brands.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../ui/confirm';
import { DraftStore, EMPTY_DRAFT_STATE, type DraftState } from './draft-store';

export type OnboardingStep = 'intro' | SectionKey | 'summary';

export const ONBOARDING_STEPS: OnboardingStep[] = ['intro', ...ONBOARDING_SECTION_KEYS, 'summary'];

interface State extends DraftState {
  stepIndex: number;
  direction: 1 | -1;
}

const INITIAL: State = { ...EMPTY_DRAFT_STATE, stepIndex: 0, direction: 1 };

const clamp = (index: number) => Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index));

// crypto.randomUUID c'è solo in un contesto sicuro (https o localhost): aperto da un indirizzo in http
// l'id nasce da getRandomValues, che c'è sempre, nello stesso formato UUID v4.
function newBrandId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// La bozza del brand nuovo, passo dopo passo; resta nel browser finché il brand non è creato.
@Injectable({ providedIn: 'root' })
export class OnboardingStore extends DraftStore<State> {
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly i18n = inject(I18nService);
  private readonly confirm = inject(ConfirmService);
  private readonly storageKey = computed(() => `moonbrand/onboarding/v1/${this.auth.account()?.id ?? 'anon'}`);
  protected readonly state = signal<State>(this.read(this.storageKey()));

  readonly stepIndex = computed(() => (this.state().draft ? this.state().stepIndex : 0));
  readonly step = computed(() => ONBOARDING_STEPS[this.stepIndex()]);
  readonly direction = computed(() => this.state().direction);
  override readonly connectReturn = '/onboarding';

  constructor() {
    super();
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
    // Una bozza il cui brand esiste già è rimasta da un onboarding finito altrove (un'altra scheda, un altro passaggio):
    // il brand c'è, la bozza non serve più.
    effect(() => {
      const brandId = this.state().brandId;
      if (brandId && this.brands.brands().some((brand) => brand.id === brandId)) untracked(() => this.reset());
    });
  }

  // Prima di un brand nuovo, se ce n'è uno a metà: si riprende o si ricomincia. Lo chiede chi apre l'onboarding, prima
  // di aprirlo, così la domanda non dipende da come ci si arriva.
  async offerRestart(): Promise<void> {
    const draft = this.draft();
    if (!draft) return;
    const name = draft.identity.name.trim();
    const index = this.stepIndex();
    const total = ONBOARDING_STEPS.length - 1;
    const where = index === 0 ? this.i18n.t('onboarding.restart.atStart') : this.i18n.t('onboarding.restart.atStep', { n: index, total });
    const restart = await this.confirm.ask({
      title: this.i18n.t('onboarding.restart.title'),
      message: name ? this.i18n.t('onboarding.restart.messageNamed', { name, where }) : this.i18n.t('onboarding.restart.message', { where }),
      cancelLabel: this.i18n.t('onboarding.restart.resume'),
      confirmLabel: this.i18n.t('onboarding.restart.confirm'),
      tone: 'danger',
    });
    if (restart) this.reset();
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
      brandId: state.brandId ?? newBrandId(),
      draft: state.draft ? changeDraftKind(state.draft, kind) : createEmptyDraft(kind, this.i18n.locale()),
    }));
  }

  async removeReference(file: MediaFile): Promise<void> {
    const brandId = this.state().brandId;
    if (brandId && file.path) await this.brands.removeReference(brandId, file.path);
    this.withoutReference(file);
  }

  // Collegato o scollegato nel profilo Zernio del brand che sta nascendo: lo ricorda la bozza, fino alla creazione.
  applyChannel(id: ChannelId, channel: ChannelState): void {
    this.state.update((state) => (state.draft ? { ...state, draft: { ...state.draft, channels: { ...state.draft.channels, [id]: channel } } } : state));
  }

  reset(): void {
    this.state.set(INITIAL);
  }

  private read(key: string): State {
    try {
      const raw = localStorage.getItem(key);
      const state: State = raw ? { ...INITIAL, ...(JSON.parse(raw) as Partial<State>) } : INITIAL;
      if (!state.draft) return state;
      // Una bozza di prima di un canale nuovo (Pinterest) non lo ha: entra non collegato.
      const channels = { ...createEmptyDraft(state.draft.identity.kind).channels, ...state.draft.channels };
      return { ...state, brandId: state.brandId ?? newBrandId(), draft: { ...state.draft, channels } };
    } catch {
      return INITIAL;
    }
  }
}
