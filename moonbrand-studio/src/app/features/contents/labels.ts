import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { ContentFormat, ContentStatus, SceneSource } from '@moonbrand/shared/domain/content';
import { INTL_LOCALES, type Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

// Formati, stati e fonti nella lingua dell'interfaccia (dizionario contents).
export const formatLabel = (format: ContentFormat, locale: Locale): string => translate(locale, `contents.format.${format}`);

export const statusLabel = (status: ContentStatus, locale: Locale): string => translate(locale, `contents.status.${status}`);

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
export const FOLD: Record<ChannelId, number | null> = { linkedin: 210, instagram: 125, facebook: 250, tiktok: 80, x: null };

export function cssAspect(aspect: string): string {
  return aspect.replace(':', ' / ');
}
