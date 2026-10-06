// I documenti legali stanno su iubenda: qui gli ID delle policy, uno per lingua (in iubenda ogni lingua ha la sua).
// Privacy e termini usano lo stesso ID; i termini si accendono a parte, quando su iubenda sono generati.
// Finché un documento manca, la sua pagina dice che è in preparazione e non va su Google.
//
// Il testo arriva dall'API di iubenda al momento della build e la pagina lo impagina con lo stile del sito:
// quando su iubenda cambia qualcosa (servizi, titolare, aggiornamenti di legge) serve un nuovo deploy.
import { parse } from 'node-html-parser';

import type { Lang } from '../i18n';

export type LegalKind = 'privacy' | 'terms';

export const IUBENDA_POLICY_ID: Record<Lang, string> = {
  it: '17940600',
  // Inglese UK, come il resto del sito (c'è anche una versione US, 65316987).
  en: '62600284',
  fr: '29303698',
};

/** I documenti già generati su iubenda. */
const READY: Record<LegalKind, boolean> = { privacy: true, terms: true };

/** L'ID da mostrare per un documento in una lingua, o null se il documento non è ancora pronto. */
export function iubendaId(kind: LegalKind, lang: Lang): string | null {
  return READY[kind] ? IUBENDA_POLICY_ID[lang] : null;
}

/** La versione pubblica su iubenda, per chi la vuole lì o se l'API non risponde. */
export function iubendaUrl(kind: LegalKind, id: string): string {
  return kind === 'privacy' ? `https://www.iubenda.com/privacy-policy/${id}` : `https://www.iubenda.com/termini-e-condizioni/${id}`;
}

// Quello che di iubenda non serve dentro il sito: il titolo (la pagina ha il suo), le icone dei servizi (link
// firmati che scadono dopo una settimana), il pulsante delle preferenze cookie, il marchio, gli script e i titoli
// nascosti per i lettori di schermo (senza le classi di iubenda resterebbero visibili).
const DROP = ['script', 'style', 'link', 'img', 'figure', 'svg', 'h1', '.iubenda-branding', '.iub-manage-preferences-container', '.sr-only'];

/** Il testo del documento senza la grafica di iubenda, pronto da impaginare; null se l'API non risponde. */
export async function iubendaText(kind: LegalKind, id: string): Promise<string | null> {
  const api = kind === 'privacy' ? 'privacy-policy' : 'terms-and-conditions';
  try {
    const res = await fetch(`https://www.iubenda.com/api/${api}/${id}/no-markup`);
    const body = (await res.json()) as { success?: boolean; content?: string };
    if (!res.ok || !body.success || !body.content) throw new Error(`risposta ${res.status}`);
    const doc = parse(body.content).querySelector('#iub-legalDoc');
    if (!doc) throw new Error('documento senza #iub-legalDoc');
    for (const selector of DROP) doc.querySelectorAll(selector).forEach((el) => el.remove());
    // I link senza indirizzo sono comandi del visualizzatore di iubenda (per esempio "Back to overview"): qui non fanno nulla.
    for (const a of doc.querySelectorAll('a')) {
      if (a.hasAttribute('href')) continue;
      if (a.parentNode?.tagName === 'P' && a.parentNode.text.trim() === a.text.trim()) a.parentNode.remove();
      else a.remove();
    }
    for (const el of doc.querySelectorAll('*')) {
      for (const name of Object.keys(el.attributes)) {
        if (name === 'style' || name === 'class' || name.startsWith('on')) el.removeAttribute(name);
      }
    }
    return doc.innerHTML;
  } catch (err) {
    console.warn(`[iubenda] ${kind} ${id}: testo non disponibile, resta il link (${(err as Error).message})`);
    return null;
  }
}
