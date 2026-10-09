import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { OnboardingDraft, OnboardingDraftSave } from '@moonbrand/shared/api/contract';

import type { BrandDraft, BrandKind, ChannelId, ChannelState, MediaFile, SectionKey } from '@moonbrand/shared/domain/brand';
import { changeDraftKind, createEmptyDraft } from '@moonbrand/shared/domain/catalog';
import { ONBOARDING_SECTION_KEYS } from '@moonbrand/shared/domain/sections';
import { DEFAULT_SUBSCRIPTION_PLAN, type SubscriptionPlanId } from '@moonbrand/shared/domain/subscription';

import { AuthService } from '../../core/auth/auth.service';
import { takeSignupBrand } from '../../core/auth/signup-prefill';
import { BrandsService } from '../../core/brands/brands.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmService } from '../../ui/confirm';
import { DraftStore, EMPTY_DRAFT_STATE, type DraftState } from './draft-store';

export type OnboardingStep = 'intro' | SectionKey | 'plan' | 'summary';

export const ONBOARDING_STEPS: OnboardingStep[] = ['intro', ...ONBOARDING_SECTION_KEYS, 'plan', 'summary'];

// plan: il piano del brand che sta nascendo, che va con lui alla creazione.
interface State extends DraftState {
  stepIndex: number;
  direction: 1 | -1;
  plan: SubscriptionPlanId;
}

const INITIAL: State = { ...EMPTY_DRAFT_STATE, stepIndex: 0, direction: 1, plan: DEFAULT_SUBSCRIPTION_PLAN };

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

// Dopo quanto un cambiamento della bozza va sul server: i passi si scrivono a mano, non serve un salvataggio a ogni tasto.
const SAVE_DELAY_MS = 600;

// La bozza del brand nuovo, passo dopo passo. Sta sul server (una per account), così ogni scheda e ogni dispositivo
// vedono la stessa, e quando il brand nasce sparisce ovunque. Ogni salvataggio parte dalla revisione che la scheda
// conosce: se un'altra scheda ha salvato nel frattempo, o il brand è già nato, il server dice di no e si rilegge.
@Injectable({ providedIn: 'root' })
export class OnboardingStore extends DraftStore<State> {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly brands = inject(BrandsService);
  private readonly i18n = inject(I18nService);
  private readonly confirm = inject(ConfirmService);
  private readonly accountId = computed(() => this.auth.account()?.id ?? null);
  protected readonly state = signal<State>(INITIAL);

  // La bozza è arrivata dal server: prima i passi non si mostrano, per non partire dall'inizio e poi saltare avanti.
  readonly ready = signal(false);
  private loaded: Promise<void> = Promise.resolve();
  // Lo stato com'è sul server e la sua revisione (0: nessuna bozza). Quando lo stato in memoria è un altro, si salva.
  private synced: State = INITIAL;
  private revision = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private saving: Promise<void> = Promise.resolve();

  readonly stepIndex = computed(() => (this.state().draft ? this.state().stepIndex : 0));
  readonly step = computed(() => ONBOARDING_STEPS[this.stepIndex()]);
  readonly direction = computed(() => this.state().direction);
  readonly plan = computed(() => this.state().plan);
  override readonly connectReturn = '/onboarding';

  constructor() {
    super();
    effect(() => {
      const accountId = this.accountId();
      untracked(() => (this.loaded = this.load(accountId)));
    });
    // Ogni cambiamento va sul server poco dopo.
    effect(() => {
      const state = this.state();
      if (this.ready() && state !== this.synced) untracked(() => this.scheduleSave());
    });
    // Tornando su questa scheda si rilegge: un'altra può aver cambiato la bozza, o creato il brand.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ready() && this.state() === this.synced) void this.reload();
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
    await this.loaded;
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
      draft: state.draft ? changeDraftKind(state.draft, kind) : withSignupBrand(createEmptyDraft(kind, this.i18n.locale())),
    }));
  }

  choosePlan(plan: SubscriptionPlanId): void {
    this.state.update((state) => ({ ...state, plan }));
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

  // Ricomincia, o brand creato: la bozza si butta, anche sul server.
  reset(): void {
    clearTimeout(this.saveTimer);
    this.adopt(INITIAL, 0);
    this.saving = this.saving.then(() =>
      firstValueFrom(this.http.delete('/v1/onboarding/draft')).then(
        () => undefined,
        () => undefined,
      ),
    );
  }

  // Quando la bozza è arrivata dal server.
  whenReady(): Promise<void> {
    return this.loaded;
  }

  // Subito sul server, per esempio prima di andare alla pagina di accesso di un social.
  override persist(): Promise<void> {
    clearTimeout(this.saveTimer);
    this.saving = this.saving.then(() => this.push());
    return this.saving;
  }

  private scheduleSave(): void {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.persist(), SAVE_DELAY_MS);
  }

  private async push(): Promise<void> {
    const state = this.state();
    if (state === this.synced || !this.accountId()) return;
    try {
      const saved = await firstValueFrom(
        this.http.put<OnboardingDraft>('/v1/onboarding/draft', { state, revision: this.revision } satisfies OnboardingDraftSave),
      );
      this.revision = saved.revision;
      this.synced = state;
    } catch (error) {
      // Un'altra scheda ha salvato, o il brand è già nato: vale quello che c'è sul server.
      if (error instanceof HttpErrorResponse && error.status === 409) await this.reload();
    }
  }

  private async load(accountId: string | null): Promise<void> {
    this.ready.set(false);
    clearTimeout(this.saveTimer);
    try {
      if (!accountId) {
        this.adopt(INITIAL, 0);
        return;
      }
      const server = await firstValueFrom(this.http.get<OnboardingDraft>('/v1/onboarding/draft'));
      if (this.accountId() !== accountId) return;
      this.adopt(normalize(server.state), server.revision);
      // La bozza di prima, rimasta nel browser: se sul server non c'è niente, ci va lei.
      const legacy = readLegacy(accountId);
      if (legacy && server.revision === 0) this.state.set(legacy);
    } catch {
      this.adopt(INITIAL, 0);
    } finally {
      if (this.accountId() === accountId) this.ready.set(true);
    }
  }

  private async reload(): Promise<void> {
    try {
      const server = await firstValueFrom(this.http.get<OnboardingDraft>('/v1/onboarding/draft'));
      this.adopt(normalize(server.state), server.revision);
    } catch {
      // Resta quella in memoria: il prossimo salvataggio riprova.
    }
  }

  private adopt(state: State, revision: number): void {
    this.synced = state;
    this.revision = revision;
    this.state.set(state);
  }
}

// Una bozza di prima di un canale nuovo (Pinterest) non lo ha: entra non collegato.
function normalize(raw: unknown): State {
  if (!raw || typeof raw !== 'object') return INITIAL;
  const state: State = { ...INITIAL, ...(raw as Partial<State>) };
  if (!state.draft) return state;
  const channels = { ...createEmptyDraft(state.draft.identity.kind).channels, ...state.draft.channels };
  return { ...state, brandId: state.brandId ?? newBrandId(), draft: { ...state.draft, channels } };
}

// Il primo brand parte con il nome scritto nel form del sito, se c'era.
function withSignupBrand(draft: BrandDraft): BrandDraft {
  return { ...draft, identity: takeSignupBrand(draft.identity) };
}

// Prima la bozza stava nel browser: la si legge una volta, per portarla sul server, e si toglie.
function readLegacy(accountId: string): State | null {
  const key = `moonbrand/onboarding/v1/${accountId}`;
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    const state = raw ? normalize(JSON.parse(raw)) : null;
    return state?.draft ? state : null;
  } catch {
    return null;
  }
}
