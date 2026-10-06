import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { BrandKind, ChannelId, ChannelState, SectionKey } from '@moonbrand/shared/domain/brand';
import { isSkippable, sectionCopy, sectionError } from '@moonbrand/shared/domain/sections';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import { AiJobsService } from '../../core/ai/ai-jobs.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandsService } from '../../core/brands/brands.service';
import { ChannelConnectionService } from '../../core/brands/channel-connection';
import { errorMessage } from '../../core/errors';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon } from '../../ui/icon';
import { Logo } from '../../ui/logo';
import { lockPageScroll } from '../../ui/scroll-lock';
import { StepList } from '../../ui/step-list';
import { ToastService } from '../../ui/toast';
import { ChannelChoiceDialog } from '../profile/channel-choice';
import { DraftStore } from './draft-store';
import { ONBOARDING_STEPS, OnboardingStore, type OnboardingStep } from './onboarding.store';
import { ChannelsStep } from './steps/channels-step';
import { IdentityStep } from './steps/identity-step';
import { IntroStep } from './steps/intro-step';
import { PositioningStep } from './steps/positioning-step';
import { SummaryStep } from './steps/summary-step';
import { ThemesStep } from './steps/themes-step';
import { VisualStep } from './steps/visual-step';
import { VoiceStep } from './steps/voice-step';

function stepCopy(step: OnboardingStep, kind: BrandKind, name: string, locale: Locale) {
  if (step === 'intro') {
    return { title: translate(locale, 'onboarding.intro.title'), subtitle: translate(locale, 'onboarding.intro.subtitle') };
  }
  if (step === 'summary') {
    const firstName = name.trim().split(/\s+/)[0];
    return {
      title:
        kind === 'person' && firstName
          ? translate(locale, 'onboarding.summary.titleNamed', { name: firstName })
          : translate(locale, 'onboarding.summary.title'),
      subtitle: translate(locale, 'onboarding.summary.subtitle'),
    };
  }
  return sectionCopy(step, kind, locale);
}

@Component({
  selector: 'mb-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Icon,
    Logo,
    StepList,
    TranslatePipe,
    IntroStep,
    IdentityStep,
    PositioningStep,
    ChannelsStep,
    ThemesStep,
    VoiceStep,
    VisualStep,
    SummaryStep,
    ChannelChoiceDialog,
  ],
  // I passi scrivono nella bozza del brand nuovo.
  providers: [{ provide: DraftStore, useExisting: OnboardingStore }],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
})
export class Onboarding {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly ai = inject(AiJobsService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(OnboardingStore);
  protected readonly brands = inject(BrandsService);
  protected readonly connection = inject(ChannelConnectionService);

  protected readonly creating = signal(false);
  // Dopo la creazione: i passaggi di stile e prime idee, finché non sono finiti.
  protected readonly preparing = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly total = ONBOARDING_STEPS.length - 1;
  protected readonly segments = ONBOARDING_STEPS.slice(1).map((_, i) => i + 1);

  protected readonly copy = computed(() => {
    const draft = this.store.draft();
    return stepCopy(this.store.step(), draft?.identity.kind ?? 'person', draft?.identity.name ?? '', this.i18n.locale());
  });

  protected readonly barLabel = computed(() => {
    if (this.preparing()) return this.i18n.t('onboarding.almostReady');
    if (this.store.step() === 'intro') return this.i18n.t('onboarding.setup');
    return this.i18n.t('onboarding.stepOf', { n: this.store.stepIndex(), total: this.total });
  });

  protected readonly sectionStep = computed<SectionKey | null>(() => {
    const step = this.store.step();
    return step === 'intro' || step === 'summary' ? null : step;
  });

  protected readonly error = computed(() => {
    const key = this.sectionStep();
    const draft = this.store.draft();
    return key && draft ? sectionError(key, draft, this.i18n.locale()) : null;
  });

  protected readonly skippable = computed(() => {
    const key = this.sectionStep();
    return key !== null && isSkippable(key);
  });

  protected readonly canClose = computed(() => this.brands.brands().length > 0);

  constructor() {
    lockPageScroll();
    void this.brands.ensureLoaded();
    // Il ritorno dalla pagina di accesso di un social, collegato dal passo dei canali.
    if (this.connection.finish(inject(ActivatedRoute).snapshot.queryParamMap, this.connected)) {
      void this.router.navigate([], { queryParams: {}, replaceUrl: true });
    }
  }

  protected readonly connected = (brandId: string, channel: ChannelId, state: ChannelState) => {
    if (brandId === this.store.brandId()) this.store.applyChannel(channel, state);
  };

  protected primaryLabel(): string {
    const step = this.store.step();
    if (step === 'intro') return this.i18n.t('onboarding.primary.start');
    if (step === 'summary') return this.i18n.t(this.creating() ? 'onboarding.primary.creating' : 'onboarding.primary.create');
    return this.i18n.t('common.continue');
  }

  protected primary(): void {
    const step = this.store.step();
    if (step === 'intro') {
      if (!this.store.draft()) {
        this.toast.show(this.i18n.t('onboarding.chooseKind'));
        return;
      }
      this.store.next();
      return;
    }
    if (step === 'summary') {
      void this.create();
      return;
    }
    const error = this.error();
    if (error) {
      this.toast.show(error);
      return;
    }
    this.store.next();
  }

  protected skip(): void {
    this.toast.show(this.i18n.t('onboarding.skipped'));
    this.store.next();
  }

  protected close(): void {
    void this.router.navigateByUrl('/');
  }

  protected async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/login');
  }

  private async create(): Promise<void> {
    const draft = this.store.draft();
    const brandId = this.store.brandId();
    if (!draft || !brandId || this.creating()) return;
    this.creating.set(true);
    let jobs: string[];
    try {
      jobs = (await this.brands.create(brandId, draft, this.store.selectedExamples())).setupJobs;
      this.store.reset();
    } catch (error) {
      this.toast.show(errorMessage(error, this.i18n.t('onboarding.createFailed')));
      this.creating.set(false);
      return;
    }
    await this.prepare(jobs);
    await this.router.navigateByUrl('/assistente');
  }

  // Il brand esiste già: si resta qui finché stile e prime idee sono pronti, poi si apre la chat. Se un lavoro non riesce
  // si va avanti lo stesso: lo stile si rilegge al primo contenuto, le idee si chiedono dalla sezione Idee.
  private async prepare(jobs: string[]): Promise<void> {
    this.preparing.set(true);
    const steps = new Map<string, AiStep[]>(jobs.map((id) => [id, []]));
    const failures = await Promise.all(
      jobs.map((id) =>
        this.ai
          .follow(id, (current) => {
            steps.set(id, current);
            this.steps.set([...steps.values()].flat());
          })
          .then(
            () => false,
            () => true,
          ),
      ),
    );
    if (failures.some(Boolean)) this.toast.show(this.i18n.t('onboarding.partlyFailed'));
  }
}
