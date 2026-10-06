// I documenti legali stanno su iubenda: qui gli ID delle policy, uno per lingua (in iubenda ogni lingua ha la sua).
// Finché un ID manca, la pagina dice che il documento è in preparazione e non va su Google.
import type { Lang } from '../i18n';

export const IUBENDA_POLICY_ID: Record<Lang, string | null> = {
  it: null,
  en: null,
  fr: null,
};

export function iubendaUrl(kind: 'privacy' | 'terms', id: string): string {
  return kind === 'privacy' ? `https://www.iubenda.com/privacy-policy/${id}` : `https://www.iubenda.com/termini-e-condizioni/${id}`;
}
