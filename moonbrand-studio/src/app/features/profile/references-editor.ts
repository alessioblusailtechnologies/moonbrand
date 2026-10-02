import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { BrandDraft, Milestone, References } from '@moonbrand/shared/domain/brand';
import { sourceLabel } from '@moonbrand/shared/domain/catalog';

import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Icon } from '../../ui/icon';
import { DraftStore } from '../onboarding/draft-store';

// I limiti dell'API.
const MAX_PROFILES = 50;
const MAX_MILESTONES = 50;

function milestoneId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

@Component({
  selector: 'mb-references-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslatePipe],
  template: `
    <section class="panel">
      <div class="head">
        <p class="label">{{ 'profile.references.profilesTitle' | t }}</p>
        <p class="caption">{{ 'profile.references.profilesHint' | t }}</p>
      </div>
      @for (profile of references().profiles; track $index; let i = $index) {
        <div class="row">
          <input class="sunken grow" maxlength="300" [placeholder]="'profile.references.profilePlaceholder' | t"
            [attr.aria-label]="'profile.references.profileLabel' | t: { n: i + 1 }"
            [value]="profile" (input)="setProfile(i, $any($event.target).value)" />
          <button class="icon-btn" type="button" [attr.aria-label]="'profile.references.removeProfile' | t: { n: i + 1 }" (click)="removeProfile(i)">
            <mb-icon name="x" [size]="16" />
          </button>
        </div>
      }
      @if (references().profiles.length < maxProfiles) {
        <button class="link-btn align-start" type="button" (click)="addProfile()">{{ 'profile.references.addProfile' | t }}</button>
      }
    </section>

    <section class="panel">
      <div class="head">
        <p class="label">{{ 'profile.references.sourcesTitle' | t }}</p>
        <p class="caption">{{ 'profile.references.sourcesHint' | t }}</p>
      </div>
      <div class="chips">
        @for (source of references().sources; track source.id ?? source.label; let i = $index) {
          <button class="chip" type="button" role="checkbox" [attr.aria-checked]="source.enabled" [class.selected]="source.enabled"
            (click)="toggleSource(i)">
            {{ sourceLabel(source, draft().identity.kind, i18n.locale()) }}
          </button>
        }
      </div>
    </section>

    <section class="panel">
      <div class="head">
        <p class="label">{{ 'profile.references.milestonesTitle' | t }}</p>
        <p class="caption">{{ 'profile.references.milestonesHint' | t }}</p>
      </div>
      @for (milestone of references().milestones; track milestone.id; let i = $index) {
        <div class="row">
          <input class="sunken grow" maxlength="200" [placeholder]="'profile.references.milestonePlaceholder' | t"
            [attr.aria-label]="'profile.references.milestoneWhat' | t: { n: i + 1 }"
            [value]="milestone.label" (input)="setMilestone(i, { label: $any($event.target).value })" />
          <input class="sunken date" type="date" [attr.aria-label]="'profile.references.milestoneWhen' | t: { n: i + 1 }" [value]="milestone.date"
            (change)="setDate(i, $any($event.target).value)" />
          <button class="icon-btn" type="button" [attr.aria-label]="'profile.references.removeMilestone' | t: { n: i + 1 }" (click)="removeMilestone(i)">
            <mb-icon name="x" [size]="16" />
          </button>
        </div>
      }
      @if (references().milestones.length < maxMilestones) {
        <button class="link-btn align-start" type="button" (click)="addMilestone()">{{ 'profile.references.addMilestone' | t }}</button>
      }
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .head {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row {
      gap: 8px;
    }
    .date {
      flex: none;
      width: 160px;
    }
    .align-start {
      align-self: flex-start;
    }
  `,
})
export class ReferencesEditor {
  private readonly store = inject(DraftStore);
  protected readonly i18n = inject(I18nService);
  protected readonly sourceLabel = sourceLabel;
  readonly draft = input.required<BrandDraft>();

  protected readonly maxProfiles = MAX_PROFILES;
  protected readonly maxMilestones = MAX_MILESTONES;
  protected readonly references = computed(() => this.draft().references);

  private set(patch: Partial<References>): void {
    const current = this.store.draft()?.references ?? this.references();
    this.store.patch({ key: 'references', value: { ...current, ...patch } });
  }

  protected addProfile(): void {
    this.set({ profiles: [...this.references().profiles, ''] });
  }

  protected setProfile(index: number, value: string): void {
    this.set({ profiles: this.references().profiles.map((profile, i) => (i === index ? value : profile)) });
  }

  protected removeProfile(index: number): void {
    this.set({ profiles: this.references().profiles.filter((_, i) => i !== index) });
  }

  protected toggleSource(index: number): void {
    this.set({ sources: this.references().sources.map((source, i) => (i === index ? { ...source, enabled: !source.enabled } : source)) });
  }

  protected addMilestone(): void {
    const today = new Date().toISOString().slice(0, 10);
    this.set({ milestones: [...this.references().milestones, { id: milestoneId(), label: '', date: today }] });
  }

  protected setMilestone(index: number, patch: Partial<Milestone>): void {
    this.set({ milestones: this.references().milestones.map((milestone, i) => (i === index ? { ...milestone, ...patch } : milestone)) });
  }

  // Una data cancellata a mano non si salva: resta quella di prima.
  protected setDate(index: number, date: string): void {
    if (date) this.setMilestone(index, { date });
  }

  protected removeMilestone(index: number): void {
    this.set({ milestones: this.references().milestones.filter((_, i) => i !== index) });
  }
}
