import type pg from 'pg';

import type { WelcomeJobInput } from '@moonbrand/shared/api/contract';
import { DAY_PARTS, WELCOME_ICONS, type Greeting, type WelcomeSuggestion } from '@moonbrand/shared/domain/welcome';

// Quanti saluti per fascia oraria e quanti spunti scrive il job welcome, e quanto possono essere lunghi.
export const GREETINGS_PER_PART = 4;
export const SUGGESTIONS = 4;
const MAX_GREETING = 70;
const MAX_LABEL = 80;
const MAX_DRAFT = 400;

// Le parole che indovinano il genere di chi legge: il prompt le vieta, ma se ne scappa una il saluto si scarta.
const GENDERED =
  /(?<!\p{L})(bentornat[oa]|bentrovat[oa]|benvenut[oa]|svegli[oae]|stanc[oa]|pront[oa]|caric[oa]|bienvenue?|fatigu[ée]e?|pr[eê]te?|r[ée]veill[ée]e?)(?!\p{L})/iu;
const EMOJI = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u{FE0F}\u{200D}\u{20E3}]/gu;

// Il testo come si mostra: senza emoji, senza virgolette intorno, su una riga. Vuoto se è troppo lungo.
function cleanText(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  const value = text
    .replace(EMOJI, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"“]+|[»"”]+$/g, '')
    .trim();
  return value.length <= max ? value : '';
}

interface RawWelcome {
  greetings: { part: string; text: string }[];
  suggestions: { icon: string; label: string; draft: string }[];
}

// Il benvenuto del job va nel brand, al posto di quello di prima, con le regole che il modello potrebbe non rispettare:
// niente emoji, lunghezze, doppioni, parole che indovinano il genere. Se nel frattempo è finito un job chiesto dopo,
// vale quello.
export async function saveWelcome(pool: pg.Pool, jobId: string, input: WelcomeJobInput, result: unknown): Promise<void> {
  const raw = result as RawWelcome;
  const seen = new Set<string>();
  const perPart = new Map<string, number>();
  const greetings: Greeting[] = [];
  for (const item of raw.greetings) {
    const text = cleanText(item.text, MAX_GREETING);
    const part = DAY_PARTS.find((value) => value === item.part);
    if (!text || !part || GENDERED.test(text) || seen.has(text.toLowerCase()) || (perPart.get(part) ?? 0) >= GREETINGS_PER_PART) continue;
    seen.add(text.toLowerCase());
    perPart.set(part, (perPart.get(part) ?? 0) + 1);
    greetings.push({ part, text });
  }
  const suggestions: WelcomeSuggestion[] = [];
  for (const item of raw.suggestions) {
    const label = cleanText(item.label, MAX_LABEL);
    const draft = cleanText(item.draft, MAX_DRAFT);
    const icon = WELCOME_ICONS.find((value) => value === item.icon) ?? 'sparkle';
    if (!label || !draft || suggestions.some((other) => other.label === label)) continue;
    suggestions.push({ icon, label, draft: /\s$/.test(item.draft) ? `${draft} ` : draft });
  }
  if (suggestions.length > SUGGESTIONS) suggestions.length = SUGGESTIONS;
  if (greetings.length === 0 && suggestions.length === 0) throw new Error('Nessun saluto e nessuno spunto utilizzabile.');

  await pool.query(
    `insert into presenza.brand_welcome (brand_id, account_id, day, fingerprint, greetings, suggestions, job_created_at)
     select $1, account_id, $2::date, $3, $4::jsonb, $5::jsonb, created_at from presenza.ai_jobs where id = $6
     on conflict (brand_id) do update set
       account_id = excluded.account_id, day = excluded.day, fingerprint = excluded.fingerprint, greetings = excluded.greetings,
       suggestions = excluded.suggestions, job_created_at = excluded.job_created_at, generated_at = now()
     where presenza.brand_welcome.job_created_at < excluded.job_created_at`,
    [input.brandId, input.day, input.fingerprint, JSON.stringify(greetings), JSON.stringify(suggestions), jobId],
  );
}
