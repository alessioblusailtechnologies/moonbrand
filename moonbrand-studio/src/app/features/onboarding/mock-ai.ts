import { Injectable } from '@angular/core';

import {
  contextStep,
  createStepLog,
  pickedDetail,
  positioningSteps,
  themesSteps,
  voiceSteps,
  type OnAiSteps,
  type PositioningIdeas,
  type WebsiteInsights,
} from '@moonbrand/shared/ai/steps';
import type { BrandKind, ChannelId, Identity, VoiceCard, VoiceSource } from '@moonbrand/shared/domain/brand';
import { AUDIENCES, channelName, GOALS, positioningLabel } from '@moonbrand/shared/domain/catalog';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate, type MessageKey } from '@moonbrand/shared/i18n/translate';
import { createRng, pick, sample, seedFromString } from '@moonbrand/shared/lib/random';

export interface VoiceSample {
  source: VoiceSource;
  texts?: string;
  channel?: ChannelId;
}

export type VoiceAnalysis = Omit<VoiceCard, 'version' | 'createdAt'>;

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

const REGISTERS: Record<Group, string[]> = {
  person: [
    'Diretto e concreto, in prima persona. Nessuna domanda retorica in apertura.',
    'Riflessivo ma pratico: parti da un episodio vissuto e arrivi a una regola.',
    'Tecnico senza gergo, prima persona plurale quando parli del team.',
  ],
  business: [
    'Caldo ma preciso, prima persona plurale. Il prodotto si racconta attraverso chi lo usa.',
    'Essenziale e rassicurante: poche promesse, molti dettagli verificabili.',
    'Colloquiale e vicino, come al banco con un cliente abituale.',
  ],
};

const RHYTHM_SHORT = 'Frasi corte, un concetto per paragrafo, tre o quattro blocchi. Chiudi su un fatto, non su un invito.';
const RHYTHM_LONG = 'Periodi ampi e argomentati, con un esempio concreto a metà. Chiudi riprendendo l’apertura.';

const LEXICON: Record<Group, string> = {
  person: '«in produzione», «processo», «margine», numeri sempre in cifre.',
  business: '«fatto a mano», «ogni mattina», «su misura», prezzi e quantità sempre in cifre.',
};

const AVOID_BASE = '«rivoluzionario», «game changer», «unlockare»';

const STOPWORDS = new Set([
  'abbiamo', 'allora', 'ancora', 'essere', 'invece', 'nostra', 'nostri', 'nostro', 'perché',
  'proprio', 'quando', 'quella', 'quello', 'questa', 'questo', 'sempre', 'vostro', 'qualcosa',
]);

const NUMBER_WORDS = ['zero', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci'];

function countLabel(count: number, singular: string, plural: string): string {
  return `${count <= 10 ? NUMBER_WORDS[count] : count} ${count === 1 ? singular : plural}`;
}

function frequentWords(text: string): string[] {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().match(/[a-zàèéìòù]{7,}/g) ?? []) {
    if (!STOPWORDS.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 3)
    .map(([word]) => word);
}

function analyzeTexts(text: string, group: Group): Pick<VoiceAnalysis, 'rhythm' | 'lexicon' | 'avoid'> {
  const sentences = text.split(/[.!?]+\s/).filter((sentence) => sentence.trim());
  const words = text.split(/\s+/).filter(Boolean).length;
  const averageLength = words / Math.max(1, sentences.length);
  const hasEmoji = /\p{Extended_Pictographic}/u.test(text);
  const top = frequentWords(text);
  return {
    rhythm: averageLength <= 16 ? RHYTHM_SHORT : RHYTHM_LONG,
    lexicon: top.length >= 2 ? `${top.map((word) => `«${word}»`).join(', ')}, numeri sempre in cifre.` : LEXICON[group],
    avoid: `${[AVOID_BASE, hasEmoji ? '' : 'emoji', text.includes('!') ? '' : 'esclamativi'].filter(Boolean).join(', ')}.`,
  };
}

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

  async analyzeVoice(voiceSample: VoiceSample, identity: Identity, locale: Locale, onSteps?: OnAiSteps): Promise<VoiceAnalysis> {
    const group = groupOf(identity.kind);
    const rng = createRng(seedFromString(`${identity.name}|${voiceSample.source}|${voiceSample.texts ?? ''}`));
    const log = createStepLog(onSteps);
    const labels = voiceSteps(locale);
    log.start('read', labels.read(voiceSample.source));
    log.finish('read');
    log.start('rhythm', labels.rhythm);
    log.finish('rhythm');
    log.start('card', labels.card);
    log.finish('card');
    const register = pick(rng, REGISTERS[group]);

    if (voiceSample.source === 'pasted' && voiceSample.texts) {
      const count = voiceSample.texts.split(/\n\s*\n/).filter((text) => text.trim()).length;
      return {
        source: 'pasted',
        sourceLabel: countLabel(count, 'testo incollato', 'testi incollati'),
        register,
        ...analyzeTexts(voiceSample.texts, group),
      };
    }
    if (voiceSample.source === 'history') {
      return {
        source: 'history',
        sourceLabel: `${18 + Math.floor(rng() * 30)} post di ${channelName(voiceSample.channel ?? 'linkedin')}`,
        register,
        rhythm: pick(rng, [RHYTHM_SHORT, RHYTHM_LONG]),
        lexicon: LEXICON[group],
        avoid: `${AVOID_BASE}, emoji, esclamativi.`,
      };
    }
    return {
      source: 'recording',
      sourceLabel: 'un minuto registrato',
      register,
      rhythm: RHYTHM_SHORT,
      lexicon: LEXICON[group],
      avoid: `${AVOID_BASE}, frasi fatte da comunicato stampa.`,
    };
  }
}
