import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type { BrandDraft, BrandKind, Identity } from '@moonbrand/shared/domain/brand';
import { brandLanguage, LOCALE_NAMES, LOCALES } from '@moonbrand/shared/i18n/locales';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';
import { normalizeSite } from '@moonbrand/shared/lib/site';

import { AiJobsService } from '../../../core/ai/ai-jobs.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { StepList } from '../../../ui/step-list';
import { ToastService } from '../../../ui/toast';
import { DraftStore } from '../draft-store';

type TextField = 'name' | 'role' | 'company' | 'sector';

const FIELDS: Record<BrandKind, { key: TextField; label: MessageKey; placeholder: MessageKey }[]> = {
  person: [
    { key: 'name', label: 'onboarding.identity.fields.personName', placeholder: 'onboarding.identity.fields.personNamePlaceholder' },
    { key: 'role', label: 'onboarding.identity.fields.role', placeholder: 'onboarding.identity.fields.rolePlaceholder' },
    { key: 'company', label: 'onboarding.identity.fields.company', placeholder: 'onboarding.identity.fields.companyPlaceholder' },
  ],
  company: [
    { key: 'name', label: 'onboarding.identity.fields.companyName', placeholder: 'onboarding.identity.fields.companyNamePlaceholder' },
    { key: 'sector', label: 'onboarding.identity.fields.sector', placeholder: 'onboarding.identity.fields.companySectorPlaceholder' },
  ],
  client: [
    { key: 'name', label: 'onboarding.identity.fields.clientName', placeholder: 'onboarding.identity.fields.clientNamePlaceholder' },
    { key: 'sector', label: 'onboarding.identity.fields.sector', placeholder: 'onboarding.identity.fields.clientSectorPlaceholder' },
  ],
};

const PITCH: Record<BrandKind, { label: MessageKey; placeholder: MessageKey }> = {
  person: { label: 'onboarding.identity.pitch.person', placeholder: 'onboarding.identity.pitchPlaceholder.person' },
  company: { label: 'onboarding.identity.pitch.company', placeholder: 'onboarding.identity.pitchPlaceholder.company' },
  client: { label: 'onboarding.identity.pitch.client', placeholder: 'onboarding.identity.pitchPlaceholder.client' },
};

const SITE_PLACEHOLDER: Record<BrandKind, string> = { person: 'nodo.it', company: 'fornorinaldi.it', client: 'studioverdi.it' };

@Component({
  selector: 'mb-identity-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [StepList, TranslatePipe],
  template: `
    @let value = identity();
    <div class="field">
      <label for="site">{{ 'onboarding.identity.site' | t }}</label>
      <div class="field-row">
        <input id="site" type="url" autocomplete="url" [placeholder]="sitePlaceholder()" [value]="value.site"
          (input)="update('site', $any($event.target).value)" (keydown.enter)="canRead() && read()" />
        @if (canRead()) {
          <button class="btn btn-secondary btn-sm" type="button" [disabled]="reading()" (click)="read()">
            {{ (reading() ? 'onboarding.identity.reading' : 'onboarding.identity.read') | t }}
          </button>
        }
      </div>
    </div>

    @if (reading()) {
      <div class="panel">
        <p class="strong-sm">{{ 'onboarding.identity.readingSite' | t: { site: site() } }}</p>
        <mb-step-list [steps]="steps()" [waiting]="'onboarding.identity.connecting' | t" />
      </div>
    } @else if (alreadyRead()) {
      <div class="panel read">
        <span class="badge mint">{{ 'onboarding.identity.siteRead' | t }}</span>
        <p class="body ink">{{ store.insights()?.summary }}</p>
      </div>
    }

    @for (field of fields(); track field.key) {
      <div class="field">
        <label [attr.for]="field.key">{{ field.label | t }}</label>
        <input [id]="field.key" type="text" [placeholder]="field.placeholder | t" [value]="value[field.key]"
          (input)="update(field.key, $any($event.target).value)" />
      </div>
    }

    <div class="field">
      <label for="pitch">{{ pitch().label | t }}</label>
      <textarea id="pitch" rows="3" [placeholder]="(reading() ? 'onboarding.identity.pitchWriting' : pitch().placeholder) | t"
        [value]="value.pitch" (input)="update('pitch', $any($event.target).value)"></textarea>
      @if (pitchFromSite()) {
        <span class="hint">{{ 'onboarding.identity.pitchFromSite' | t }}</span>
      }
    </div>

    <div class="field">
      <label id="language">{{ 'brand.language' | t }}</label>
      <div class="segmented" role="radiogroup" aria-labelledby="language">
        @for (option of locales; track option) {
          @let current = option === language();
          <button type="button" role="radio" [class.selected]="current" [attr.aria-checked]="current" (click)="update('language', option)">
            {{ localeNames[option] }}
          </button>
        }
      </div>
      <span class="hint">{{ 'brand.languageHint' | t }}</span>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .read {
      gap: 8px;
    }
  `,
})
export class IdentityStep {
  private readonly ai = inject(AiJobsService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  protected readonly store = inject(DraftStore);
  readonly draft = input.required<BrandDraft>();

  protected readonly reading = signal(false);
  protected readonly steps = signal<AiStep[]>([]);

  protected readonly locales = LOCALES;
  protected readonly localeNames = LOCALE_NAMES;

  protected readonly identity = computed(() => this.draft().identity);
  protected readonly language = computed(() => brandLanguage(this.identity()));
  protected readonly fields = computed(() => FIELDS[this.identity().kind]);
  protected readonly pitch = computed(() => PITCH[this.identity().kind]);
  protected readonly sitePlaceholder = computed(() => SITE_PLACEHOLDER[this.identity().kind]);
  protected readonly site = computed(() => normalizeSite(this.identity().site));
  protected readonly alreadyRead = computed(() => this.store.insights()?.site === this.site());
  protected readonly canRead = computed(() => this.site().includes('.') && !this.alreadyRead());
  protected readonly pitchFromSite = computed(() => {
    const insights = this.store.insights();
    return Boolean(insights?.pitch) && this.identity().pitch === insights?.pitch;
  });

  protected update(key: keyof Identity, text: string): void {
    this.store.patch({ key: 'identity', value: { ...this.identity(), [key]: text } });
  }

  protected async read(): Promise<void> {
    if (this.reading()) return;
    this.reading.set(true);
    this.steps.set([]);
    try {
      const insights = await this.ai.readWebsite(this.identity().site, (steps) => this.steps.set(steps));
      this.store.applyInsights(insights);
      this.toast.show(this.i18n.t('onboarding.identity.readDone'));
    } catch {
      this.toast.show(this.i18n.t('onboarding.identity.readFailed'));
    } finally {
      this.reading.set(false);
    }
  }
}
