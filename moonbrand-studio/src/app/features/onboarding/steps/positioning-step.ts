import { ChangeDetectionStrategy, Component, computed, inject, input, signal, type OnInit } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { BrandDraft, BrandKind, Positioning } from '@moonbrand/shared/domain/brand';
import { AUDIENCES, GOALS, positioningLabel } from '@moonbrand/shared/domain/catalog';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { Icon } from '../../../ui/icon';
import { StepList } from '../../../ui/step-list';
import { DraftStore } from '../draft-store';
import { MockAi } from '../mock-ai';
import { positioningSource } from '../positioning-source';

const GOAL_LABEL: Record<BrandKind, MessageKey> = {
  person: 'onboarding.positioning.goals.person',
  company: 'onboarding.positioning.goals.company',
  client: 'onboarding.positioning.goals.client',
};
const AUDIENCE_LABEL: Record<BrandKind, MessageKey> = {
  person: 'onboarding.positioning.audiences.person',
  company: 'onboarding.positioning.audiences.company',
  client: 'onboarding.positioning.audiences.client',
};
const COMMON_NOTE: Record<BrandKind, MessageKey> = {
  person: 'onboarding.positioning.noteCommon.person',
  company: 'onboarding.positioning.noteCommon.company',
  client: 'onboarding.positioning.noteCommon.client',
};

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]);

function frequencyNote(perWeek: number): MessageKey {
  if (perWeek <= 2) return 'onboarding.positioning.frequency.light';
  if (perWeek <= 4) return 'onboarding.positioning.frequency.recommended';
  return 'onboarding.positioning.frequency.high';
}

@Component({
  selector: 'mb-positioning-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, StepList, TranslatePipe],
  template: `
    @let value = positioning();
    @if (loading()) {
      <div class="panel">
        <p class="strong-sm">{{ 'onboarding.positioning.preparing' | t }}</p>
        <mb-step-list [steps]="steps()" [waiting]="'onboarding.positioning.waiting' | t" />
      </div>
    } @else {
      <p class="caption">{{ note() }}</p>
      <section class="group">
        <p class="label">{{ goalLabel() | t }}</p>
        <div class="chips">
          @for (goal of goals(); track goal) {
            <button class="chip" type="button" [class.selected]="value.goals.includes(goal)" (click)="set({ goals: toggle(value.goals, goal) })">
              {{ label(goal) }}
            </button>
          }
        </div>
      </section>
      <section class="group">
        <p class="label">{{ audienceLabel() | t }}</p>
        <div class="chips">
          @for (audience of audiences(); track audience) {
            <button class="chip" type="button" [class.selected]="value.audiences.includes(audience)"
              (click)="set({ audiences: toggle(value.audiences, audience) })">
              {{ label(audience) }}
            </button>
          }
        </div>
        @if (adding()) {
          <div class="row">
            <input class="sunken grow" [placeholder]="'onboarding.positioning.audiencePlaceholder' | t"
              [attr.aria-label]="'onboarding.positioning.newAudience' | t" [value]="custom()"
              (input)="custom.set($any($event.target).value)" (keydown.enter)="addAudience()" />
            <button class="btn btn-primary btn-sm" type="button" [disabled]="!custom().trim()" (click)="addAudience()">{{ 'common.add' | t }}</button>
          </div>
        } @else {
          <button class="link-btn" type="button" (click)="adding.set(true)">{{ 'onboarding.positioning.addAudience' | t }}</button>
        }
      </section>
    }

    <section class="panel">
      <p class="label">{{ 'onboarding.positioning.howOften' | t }}</p>
      <div class="stepper">
        <button class="icon-btn outline" type="button" [attr.aria-label]="'onboarding.positioning.fewer' | t" [disabled]="value.postsPerWeek <= 1"
          (click)="set({ postsPerWeek: value.postsPerWeek - 1 })">
          <mb-icon name="minus" />
        </button>
        <div class="stepper-value">
          <p class="heading">{{ 'onboarding.positioning.perWeek' | t: { n: value.postsPerWeek } }}</p>
          <p class="caption">{{ frequencyNote(value.postsPerWeek) | t }}</p>
        </div>
        <button class="icon-btn outline" type="button" [attr.aria-label]="'onboarding.positioning.more' | t" [disabled]="value.postsPerWeek >= 7"
          (click)="set({ postsPerWeek: value.postsPerWeek + 1 })">
          <mb-icon name="plus" />
        </button>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .group {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }
    .group .row {
      width: 100%;
    }
    .stepper {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .stepper-value {
      flex: 1;
      text-align: center;
    }
  `,
})
export class PositioningStep implements OnInit {
  private readonly ai = inject(MockAi);
  private readonly store = inject(DraftStore);
  private readonly i18n = inject(I18nService);
  readonly draft = input.required<BrandDraft>();

  protected readonly toggle = toggle;
  protected readonly frequencyNote = frequencyNote;
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly steps = signal<AiStep[]>([]);
  protected readonly adding = signal(false);
  protected readonly custom = signal('');

  protected readonly positioning = computed(() => this.draft().positioning);
  private readonly kind = computed(() => this.draft().identity.kind);
  protected readonly goalLabel = computed(() => GOAL_LABEL[this.kind()]);
  protected readonly audienceLabel = computed(() => AUDIENCE_LABEL[this.kind()]);
  private readonly source = computed(() => positioningSource(this.draft().identity, this.store.insights()));
  private readonly ideas = computed(() => {
    const source = this.source();
    const stored = this.store.positioningIdeas();
    return source && stored?.key === source.key ? stored.ideas : null;
  });

  protected readonly goals = computed(() => [...new Set([...(this.ideas()?.goals ?? GOALS[this.kind()]), ...this.positioning().goals])]);
  protected readonly audiences = computed(() => [
    ...new Set([
      ...(this.ideas()?.audiences ?? [...AUDIENCES[this.kind()], ...(this.store.insights()?.audiences ?? [])]),
      ...this.positioning().audiences,
    ]),
  ]);

  protected readonly note = computed(() => {
    if (this.ideas()) {
      const site = this.source()?.site;
      return site ? this.i18n.t('onboarding.positioning.noteSite', { site: site.site }) : this.i18n.t('onboarding.positioning.noteWritten');
    }
    if (this.failed()) return this.i18n.t('onboarding.positioning.noteFailed');
    return this.i18n.t(COMMON_NOTE[this.kind()]);
  });

  ngOnInit(): void {
    const source = this.source();
    if (!source || this.ideas()) return;
    const site = source.site;
    if (site?.goals?.length && site.audiences.length) {
      const picked = { goals: site.goals.slice(0, 2), audiences: site.audiences.slice(0, 2) };
      this.store.applyPositioningIdeas(source.key, { goals: site.goals, audiences: site.audiences, picked });
      return;
    }
    this.loading.set(true);
    this.ai
      .suggestPositioning(this.draft().identity, source.site, this.i18n.locale(), (steps) => this.steps.set(steps))
      .then((ideas) => this.store.applyPositioningIdeas(source.key, ideas))
      .catch(() => this.failed.set(true))
      .finally(() => this.loading.set(false));
  }

  // Obiettivi e pubblici del catalogo sono salvati come id: si mostrano con l'etichetta, il testo libero com'è.
  protected label(value: string): string {
    return positioningLabel(value, this.i18n.locale());
  }

  protected set(patch: Partial<Positioning>): void {
    this.store.patch({ key: 'positioning', value: { ...this.positioning(), ...patch } });
  }

  protected addAudience(): void {
    const label = this.custom().trim();
    if (!label) return;
    if (!this.positioning().audiences.includes(label)) this.set({ audiences: [...this.positioning().audiences, label] });
    this.custom.set('');
    this.adding.set(false);
  }
}
