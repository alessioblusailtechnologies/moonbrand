// I documenti legali stanno su iubenda: qui gli ID delle policy, uno per lingua (in iubenda ogni lingua ha la sua).
// Privacy e termini usano lo stesso ID; i termini si accendono a parte, quando su iubenda sono generati.
// Finché un documento manca, la sua pagina dice che è in preparazione e non va su Google.
import type { Lang } from '../i18n';

export type LegalKind = 'privacy' | 'terms';

export const IUBENDA_POLICY_ID: Record<Lang, string> = {
  it: '17940600',
  // Inglese UK, come il resto del sito (c'è anche una versione US, 65316987).
  en: '62600284',
  fr: '29303698',
};

/** I documenti già generati su iubenda. */
const READY: Record<LegalKind, boolean> = { privacy: true, terms: false };

/** L'ID da mostrare per un documento in una lingua, o null se il documento non è ancora pronto. */
export function iubendaId(kind: LegalKind, lang: Lang): string | null {
  return READY[kind] ? IUBENDA_POLICY_ID[lang] : null;
}

export function iubendaUrl(kind: LegalKind, id: string): string {
  return kind === 'privacy' ? `https://www.iubenda.com/privacy-policy/${id}` : `https://www.iubenda.com/termini-e-condizioni/${id}`;
}
