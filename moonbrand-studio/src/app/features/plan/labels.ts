import type { SlotView } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { BEST_TIMES, bestChannelFor, type SlotStatus } from '@moonbrand/shared/domain/plan';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';
import { isPast, planNow } from '@moonbrand/shared/lib/dates';

// I giorni della settimana in breve, da lunedì, nella lingua di Intl ("it-IT" → lun, mar, …). Il 1° gennaio 2024 è un lunedì.
export function weekdayNames(intl: string): string[] {
  const format = new Intl.DateTimeFormat(intl, { weekday: 'short', timeZone: 'UTC' });
  return Array.from({ length: 7 }, (_, i) => format.format(Date.UTC(2024, 0, 1 + i, 12)));
}

// Il colore di ogni stato, dai token dello studio: grigio da riempire, giallo da preparare, arancio da approvare,
// blu programmata, verde pubblicata.
export const SLOT_TONES: Record<SlotStatus, string> = {
  empty: 'var(--grey-300)',
  toPrepare: 'var(--accent-soft)',
  toApprove: 'var(--accent)',
  scheduled: 'var(--primary)',
  published: 'var(--mint-400)',
};

// Il titolo di un'uscita: il contenuto, l'idea, o il tema che il piano chiede.
export function slotTitle(slot: SlotView, themeName: (id: string | null) => string | null, locale: Locale): string {
  if (slot.content) return slot.content.title;
  if (slot.idea) return slot.idea.title;
  if (slot.contentTitle) return slot.contentTitle;
  const theme = themeName(slot.themeId);
  return theme ? translate(locale, 'plan.needsTheme', { theme }) : translate(locale, 'plan.status.empty');
}

// L'ora per un'uscita nuova in un giorno: quella migliore del canale, o l'ora piena dopo adesso se oggi è già passata.
export function timeFor(channels: readonly ChannelId[], date: string): string {
  const channel = bestChannelFor(channels, date);
  const time = channel ? BEST_TIMES[channel].time : '09:00';
  if (!isPast(date, time)) return time;
  const hour = Number(planNow().time.slice(0, 2)) + 1;
  return hour > 23 ? '23:59' : `${String(hour).padStart(2, '0')}:00`;
}

// Un'uscita si sposta finché non è passata.
export const canMove = (slot: SlotView): boolean => slot.status !== 'published' && !isPast(slot.date, slot.time);
