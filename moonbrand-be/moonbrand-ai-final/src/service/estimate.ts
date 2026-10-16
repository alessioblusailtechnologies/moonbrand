import type { ContentFormat } from '@moonbrand/shared/domain/content';

// Il consumo stimato di un contenuto, in crediti (1 credito = 1 centesimo di dollaro di costo vero): la mediana e
// l'80° percentile dei lavori che hanno fatto un contenuto di quel formato negli ultimi giorni in questo ambiente, così la
// stima segue modello, prezzi e lavori come sono adesso. Sotto pochi campioni vale la riserva.

export interface CreditRange {
  typical: number;
  high: number;
}

export type CreditEstimates = Record<ContentFormat, CreditRange>;

const ENV = 'MOONBRAND_CREDITS';
export const FORMATS: ContentFormat[] = ['post', 'carousel', 'article', 'video'];
// La riserva, prudente, dalle prove di ottobre 2026 su Opus 5.5.
export const FALLBACK: CreditEstimates = {
  post: { typical: 80, high: 150 },
  carousel: { typical: 150, high: 250 },
  article: { typical: 80, high: 150 },
  video: { typical: 200, high: 400 },
};
export const MIN_SAMPLES = 5;

// Arrotondato alle decine, verso il basso per la mediana e verso l'alto per il massimo.
const credits = (usd: number, round: (value: number) => number) => Math.max(10, round((usd * 100) / 10) * 10);

export function estimatesFrom(samples: { format: string; n: number; typical: number; high: number }[]): CreditEstimates {
  const result = { ...FALLBACK };
  for (const sample of samples) {
    if (!FORMATS.includes(sample.format as ContentFormat) || sample.n < MIN_SAMPLES) continue;
    result[sample.format as ContentFormat] = { typical: credits(sample.typical, Math.floor), high: credits(sample.high, Math.ceil) };
  }
  return result;
}

// Dal worker allo script del job, per variabile d'ambiente: post:80-150,carousel:150-250,...
export function creditsEnv(estimates: CreditEstimates): Record<string, string> {
  return { [ENV]: FORMATS.map((format) => `${format}:${estimates[format].typical}-${estimates[format].high}`).join(',') };
}

export function creditsFromEnv(env: Record<string, string | undefined> = process.env): CreditEstimates {
  const result = { ...FALLBACK };
  for (const item of (env[ENV] ?? '').split(',')) {
    const [format, range] = item.split(':');
    const [typical, high] = (range ?? '').split('-').map(Number);
    if (FORMATS.includes(format as ContentFormat) && typical > 0 && high >= typical) result[format as ContentFormat] = { typical, high };
  }
  return result;
}
