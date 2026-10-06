import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { ContentFormat, SceneSource } from '@moonbrand/shared/domain/content';
import type { ContentState } from '@moonbrand/shared/domain/plan';
import { INTL_LOCALES, type Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

// Formati, stati e fonti nella lingua dell'interfaccia (dizionario contents).
export const formatLabel = (format: ContentFormat, locale: Locale): string => translate(locale, `contents.format.${format}`);

export const statusLabel = (state: ContentState, locale: Locale): string => translate(locale, `contents.status.${state}`);

// Il tono del badge dello stato: verde se è approvato o uscito, arancio se qualcosa non è uscito.
export function stateTone(state: ContentState): 'mint' | 'warn' | null {
  if (state === 'approved' || state === 'published') return 'mint';
  return state === 'partial' || state === 'failed' ? 'warn' : null;
}

export const sourceLabel = (source: SceneSource, locale: Locale): string => translate(locale, `contents.source.${source}`);

export const FORMATS: ContentFormat[] = ['post', 'carousel', 'article', 'video'];

export function formatOptions(locale: Locale): { id: ContentFormat; label: string; hint: string }[] {
  return FORMATS.map((id) => ({ id, label: formatLabel(id, locale), hint: translate(locale, `contents.formatHint.${id}`) }));
}

// «Su LinkedIn e X il carosello non c'è.»; vuoto se tutti i canali reggono il formato.
export function unsupportedLine(format: ContentFormat, channels: string[], locale: Locale): string {
  if (channels.length === 0) return '';
  const list = new Intl.ListFormat(INTL_LOCALES[locale], { type: 'conjunction' }).format(channels);
  return translate(locale, `contents.unsupported.${format}`, { channels: list });
}

// Quanti caratteri del testo si vedono nel feed prima di «…altro»: l'anteprima taglia lì, come il canale. X mostra tutto.
export const FOLD: Record<ChannelId, number | null> = { linkedin: 210, instagram: 125, facebook: 250, tiktok: 80, x: null, pinterest: 100 };

export function cssAspect(aspect: string): string {
  return aspect.replace(':', ' / ');
}
