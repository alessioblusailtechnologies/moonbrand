import { DEFAULT_LOCALE, INTL_LOCALES, type Locale } from '../i18n/locales';

// Le date del piano sono stringhe YYYY-MM-DD e gli orari HH:mm, nell'ora di Roma: come in social-app, con cui moonbrand
// condivide le uscite. Il fuso per brand arriverà con la pubblicazione vera.
export const PLAN_TIME_ZONE = 'Europe/Rome';

// I formati si fanno una volta per lingua; di base l'italiano, che è quello dei prompt del motore.
const FORMATS = {
  longDay: { day: 'numeric', month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short', day: 'numeric', month: 'short' },
  weekdayLong: { weekday: 'long', day: 'numeric', month: 'long' },
  monthName: { month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
} satisfies Record<string, Intl.DateTimeFormatOptions>;
const formatters = new Map<string, Intl.DateTimeFormat>();

function inRome(format: keyof typeof FORMATS, locale: Locale): Intl.DateTimeFormat {
  const key = `${locale} ${format}`;
  let formatter = formatters.get(key);
  if (!formatter) formatters.set(key, (formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], { ...FORMATS[format], timeZone: PLAN_TIME_ZONE })));
  return formatter;
}
// sv-SE scrive le date come YYYY-MM-DD HH:mm:ss.
const romeClock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: PLAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Adesso a Roma, qualunque sia il fuso del processo o del browser.
export function planNow(now = new Date()): { date: string; time: string } {
  const [date, time] = romeClock.format(now).split(' ');
  return { date, time: time.slice(0, 5) };
}

export function today(): string {
  return planNow().date;
}

// Per contare i giorni la data si legge a mezzogiorno UTC: nessun cambio d'ora la sposta.
function fromDay(day: string): Date {
  return new Date(`${day.slice(0, 10)}T12:00:00Z`);
}

function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, amount: number): string {
  const date = fromDay(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return toDay(date);
}

// 1 = lunedì … 7 = domenica.
export function weekdayIndex(day: string): number {
  return ((fromDay(day).getUTCDay() + 6) % 7) + 1;
}

export function startOfWeek(day: string): string {
  return addDays(day, 1 - weekdayIndex(day));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function addMonths(day: string, amount: number): string {
  const date = fromDay(startOfMonth(day));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return toDay(date);
}

export const isDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && toDay(fromDay(value)) === value;
export const isTime = (value: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

// Un giorno e un'ora già passati, a Roma.
export function isPast(date: string, time: string, now = planNow()): boolean {
  return `${date}T${time}` < `${now.date}T${now.time}`;
}

// I formati leggono la data a mezzogiorno UTC nel fuso di Roma: il giorno resta quello.
// "2026-10-03" → "3 ottobre 2026"
export const formatDay = (day: string, locale: Locale = DEFAULT_LOCALE): string => inRome('longDay', locale).format(fromDay(day));
// "2026-10-01" → "gio 1 ott"
export const formatWeekdayShort = (day: string, locale: Locale = DEFAULT_LOCALE): string => inRome('weekdayShort', locale).format(fromDay(day));
// "2026-10-01" → "giovedì 1 ottobre"
export const formatWeekdayLong = (day: string, locale: Locale = DEFAULT_LOCALE): string => inRome('weekdayLong', locale).format(fromDay(day));
// "2026-10-01" → "ottobre 2026"
export const formatMonth = (day: string, locale: Locale = DEFAULT_LOCALE): string => inRome('monthYear', locale).format(fromDay(day));

// "14 – 20 settembre" oppure "28 settembre – 4 ottobre"
export function formatRange(from: string, to: string, locale: Locale = DEFAULT_LOCALE): string {
  const [startMonth, endMonth] = [from, to].map((day) => inRome('monthName', locale).format(fromDay(day)));
  const [start, end] = [from, to].map((day) => Number(day.slice(8, 10)));
  return startMonth === endMonth ? `${start} – ${end} ${endMonth}` : `${start} ${startMonth} – ${end} ${endMonth}`;
}
