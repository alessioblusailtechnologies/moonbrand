import { Injectable } from '@angular/core';

import {
  contextStep,
  createStepLog,
  pickedDetail,
  positioningSteps,
  themesSteps,
  type OnAiSteps,
  type PositioningIdeas,
  type WebsiteInsights,
} from '@moonbrand/shared/ai/steps';
import type { BrandKind, Identity } from '@moonbrand/shared/domain/brand';
import { AUDIENCES, GOALS, positioningLabel } from '@moonbrand/shared/domain/catalog';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate, type MessageKey } from '@moonbrand/shared/i18n/translate';
import { createRng, sample, seedFromString } from '@moonbrand/shared/lib/random';

type Group = 'person' | 'business';

const groupOf = (kind: BrandKind): Group => (kind === 'person' ? 'person' : 'business');


// Temi e pubblici in più proposti dall'onboarding: diventano testo del brand nella lingua di chi lo crea.
const THEMES: Record<Group, MessageKey[]> = {
  person: [
    'onboarding.mock.themes.person.cases',
    'onboarding.mock.themes.person.mistakes',
    'onboarding.mock.themes.person.sector',
    'onboarding.mock.themes.person.backstage',
    'onboarding.mock.themes.person.hiring',
    'onboarding.mock.themes.person.pricing',
    'onboarding.mock.themes.person.tools',
    'onboarding.mock.themes.person.clients',
  ],
  business: [
    'onboarding.mock.themes.business.product',
    'onboarding.mock.themes.business.clients',
    'onboarding.mock.themes.business.backstage',
    'onboarding.mock.themes.business.team',
    'onboarding.mock.themes.business.tips',
    'onboarding.mock.themes.business.news',
    'onboarding.mock.themes.business.supply',
    'onboarding.mock.themes.business.numbers',
  ],
};

const EXTRA_AUDIENCES: Record<Group, MessageKey[]> = {
  person: ['onboarding.mock.audiences.person.it', 'onboarding.mock.audiences.person.consultants', 'onboarding.mock.audiences.person.manufacturing'],
  business: [
    'onboarding.mock.audiences.business.families',
    'onboarding.mock.audiences.business.young',
    'onboarding.mock.audiences.business.architects',
    'onboarding.mock.audiences.business.restaurants',
  ],
};

@Injectable({ providedIn: 'root' })
export class MockAi {
  async suggestThemes(identity: Identity, locale: Locale, onSteps?: OnAiSteps): Promise<string[]> {
    const group = groupOf(identity.kind);
    const rng = createRng(seedFromString(`${identity.pitch}|${group}`));
    const log = createStepLog(onSteps);
    const labels = themesSteps(locale);
    log.start('read', labels.read, identity.pitch.slice(0, 90));
    log.finish('read');
    log.start('pick', labels.pick);
    const themes = sample(rng, THEMES[group], 4).map((key) => translate(locale, key));
    log.finish('pick', { detail: pickedDetail(themes.length, themes.slice(0, 2), locale) });
    return themes;
  }

  async suggestPositioning(identity: Identity, site: WebsiteInsights | null, locale: Locale, onSteps?: OnAiSteps): Promise<PositioningIdeas> {
    const group = groupOf(identity.kind);
    const rng = createRng(seedFromString(`${identity.pitch}|${site?.site ?? ''}|${identity.kind}`));
    const log = createStepLog(onSteps);
    const labels = positioningSteps(identity.kind, locale);
    const start = contextStep(site?.site ?? null, site?.pitch || identity.pitch, locale);
    // Obiettivi e pubblici del catalogo sono id: nei passaggi si leggono con l'etichetta.
    const picked = (values: string[]) => pickedDetail(values.length, values.slice(0, 2).map((value) => positioningLabel(value, locale)), locale);
    log.start('context', start.label, start.detail);
    log.finish('context');

    log.start('goals', labels.goals);
    const goals = sample(rng, GOALS[identity.kind], 5);
    log.finish('goals', { detail: picked(goals) });

    log.start('audiences', labels.audiences);
    const extra = EXTRA_AUDIENCES[group].map((key) => translate(locale, key));
    const audiences = [...new Set([...(site?.audiences ?? []), ...sample(rng, [...AUDIENCES[identity.kind], ...extra], 6)])].slice(0, 6);
    log.finish('audiences', { detail: picked(audiences) });

    return { goals, audiences, picked: { goals: goals.slice(0, 2), audiences: audiences.slice(0, 2) } };
  }
}
