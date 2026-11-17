import type { AdCampaignType, AdKeyword, KeywordMatch } from '@moonbrand/shared/domain/ads';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

// I numeri delle campagne nella lingua dell'interfaccia: un trattino quando Google non ne ha ancora dati.

export const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(date);
export const daysAgo = (days: number) => day(new Date(Date.now() - days * 86_400_000));

export function money(locale: string, value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency: currency ?? 'EUR', maximumFractionDigits: value % 1 ? 2 : 0 }).format(value);
}

export function count(locale: string, value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

// ratio: 0.42 → 42%; altrimenti il valore è già in percentuale.
export function percent(locale: string, value: number | null | undefined, ratio = false): string {
  if (value === null || value === undefined) return '—';
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(ratio ? value * 100 : value)}%`;
}

export function shortDate(locale: string, value: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`));
}

export const TYPE_KEYS: Record<AdCampaignType, MessageKey> = {
  search: 'adsManage.types.search',
  display: 'adsManage.types.display',
  pmax: 'adsManage.types.pmax',
  demand_gen: 'adsManage.types.demand_gen',
};

export const MATCH_KEYS: Record<KeywordMatch, MessageKey> = {
  broad: 'adsManage.match.broad',
  phrase: 'adsManage.match.phrase',
  exact: 'adsManage.match.exact',
};

// Una riga per parola chiave, con i segni di Google: "frase", [esatta], niente per la generica.
export function parseKeywords(text: string, match: KeywordMatch): AdKeyword[] {
  const seen = new Set<string>();
  const out: AdKeyword[] = [];
  for (const line of text.split(/\n|,/)) {
    const raw = line.trim();
    if (!raw) continue;
    let kind = match;
    if (/^\[.*\]$/.test(raw)) kind = 'exact';
    else if (/^".*"$/.test(raw)) kind = 'phrase';
    const value = raw.replace(/^["[+]+|["\]]+$/g, '').trim().slice(0, 80);
    const key = `${value.toLowerCase()}|${kind}`;
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push({ text: value, match: kind });
  }
  return out;
}

// Un file scelto dal dispositivo come data URI, per caricarlo.
export function readDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
