import { DEFAULT_LOCALE, type Locale } from '../i18n/locales';
import { sections } from '../i18n/messages/sections';
import { translate } from '../i18n/translate';
import type { BrandDraft, BrandKind, SectionKey } from './brand';
import { currentVoiceCard, isConnected } from './brand';
import { CHANNELS, paletteName, positioningLabel } from './catalog';
import { themeLevelLabel, totalWeight } from './themes';

export type SectionStatus = 'complete' | 'partial' | 'missing';

export const SECTION_KEYS: SectionKey[] = ['identity', 'positioning', 'channels', 'themes', 'voice', 'visual', 'references'];

export const ONBOARDING_SECTION_KEYS: SectionKey[] = SECTION_KEYS.filter((key) => key !== 'references');

export function isSkippable(key: SectionKey): boolean {
  return key === 'voice' || key === 'visual' || key === 'references';
}

export function sectionCopy(key: SectionKey, kind: BrandKind, locale: Locale = DEFAULT_LOCALE) {
  const copy = sections[locale][key];
  return { name: copy.name[kind], title: copy.title[kind], subtitle: copy.subtitle[kind] };
}

export function sectionError(key: SectionKey, draft: BrandDraft, locale: Locale = DEFAULT_LOCALE): string | null {
  const { identity, positioning, channels, themes } = draft;
  const errors = sections[locale].errors;
  switch (key) {
    case 'identity':
      if (!identity.name.trim() || !identity.pitch.trim()) {
        return identity.kind === 'person' ? errors.identityPerson : errors.identityOther;
      }
      return null;
    case 'positioning':
      if (positioning.goals.length === 0) return errors.goal;
      if (positioning.audiences.length === 0) return errors.audience;
      return null;
    case 'channels':
      return CHANNELS.some(({ id }) => channels[id].selected) ? null : errors.channel;
    case 'themes':
      if (themes.length === 0) return errors.theme;
      if (themes.some((theme) => !theme.name.trim())) return errors.themeName;
      if (totalWeight(themes) !== 100) return errors.weights;
      return null;
    default:
      return null;
  }
}

export function sectionStatus(key: SectionKey, draft: BrandDraft): SectionStatus {
  switch (key) {
    case 'identity':
    case 'positioning':
    case 'themes':
      return sectionError(key, draft) ? 'missing' : 'complete';
    case 'channels': {
      const selected = CHANNELS.filter(({ id }) => draft.channels[id].selected);
      if (selected.length === 0) return 'missing';
      return selected.some(({ id }) => isConnected(draft.channels[id])) ? 'complete' : 'partial';
    }
    case 'voice':
      return draft.voice.cards.length > 0 ? 'complete' : 'missing';
    case 'visual':
      return draft.visual.logoUri ? 'complete' : 'partial';
    case 'references': {
      const { profiles, milestones } = draft.references;
      return profiles.length > 0 || milestones.length > 0 ? 'complete' : 'missing';
    }
  }
}

export function identityLine(draft: BrandDraft, locale: Locale = DEFAULT_LOCALE): string {
  const { kind, name, role, company, sector } = draft.identity;
  if (kind !== 'person') return [name, sector].filter(Boolean).join(' · ');
  const job = role && company ? translate(locale, 'sections.summary.roleAt', { role, company }) : role || company;
  return [name, job].filter(Boolean).join(' · ');
}

export function sectionSummary(key: SectionKey, draft: BrandDraft, locale: Locale = DEFAULT_LOCALE): string {
  const summary = sections[locale].summary;
  const t = (name: keyof typeof summary, params: Record<string, string | number>) => translate(locale, `sections.summary.${name}`, params);
  switch (key) {
    case 'identity':
      return identityLine(draft, locale) || summary.toComplete;
    case 'positioning': {
      const { goals, audiences, postsPerWeek } = draft.positioning;
      const label = (value: string) => positioningLabel(value, locale);
      const parts = [goals.map(label).join(', '), audiences.length ? t('forAudiences', { audiences: audiences.map(label).join(', ') }) : ''];
      parts.push(t('postsPerWeek', { n: postsPerWeek }));
      return parts.filter(Boolean).join(' · ');
    }
    case 'channels': {
      const selected = CHANNELS.filter(({ id }) => draft.channels[id].selected);
      if (selected.length === 0) return summary.noChannels;
      return selected.map(({ id, name }) => t(isConnected(draft.channels[id]) ? 'connected' : 'toConnect', { channel: name })).join(' · ');
    }
    case 'themes':
      return draft.themes.length
        ? draft.themes.map((theme) => `${theme.name} (${themeLevelLabel(theme, locale).toLowerCase()})`).join(' · ')
        : summary.noThemes;
    case 'voice': {
      const card = currentVoiceCard(draft.voice);
      return card ? t('voiceCard', { version: card.version, source: card.sourceLabel }) : summary.noVoice;
    }
    case 'visual': {
      const { logoUri, palette, signature, references = [], line } = draft.visual;
      return [
        logoUri ? summary.logo : summary.noLogo,
        paletteName(palette, locale).toLowerCase(),
        references.length > 0 ? t('references', { n: references.length }) : '',
        line ? summary.lineReady : '',
        signature && logoUri ? summary.signature : '',
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'references': {
      const { profiles, sources, milestones } = draft.references;
      const enabled = sources.filter((source) => source.enabled).length;
      return t('sources', { profiles: profiles.length, sources: enabled, dates: milestones.length });
    }
  }
}
