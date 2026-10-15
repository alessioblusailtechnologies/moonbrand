import { readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BrandContext } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { SLOT_STATUS_LABELS } from '@moonbrand/shared/domain/plan';
import { formatWeekdayShort, planNow } from '@moonbrand/shared/lib/dates';

import { describeBrand } from './brand-brief';
import { logoFile } from './brand-logo';

// Il CLAUDE.md della cartella del brand, corto: chi è il brand, cosa ha (logo, colori, riferimenti),
// cosa ha fatto di recente e cosa esce nei prossimi giorni. Le regole di lavoro stanno nei prompt dei job, non qui.
// Si riscrive prima di ogni job dal brand com'è sul DB.
export function brandBrief(brand: BrandContext, logo: string | null, folders: ReadonlySet<string>): string {
  const name = brand.identity.name || 'Brand';
  const logoSection = logo
    ? `Il logo del brand è ${logo}, nella cartella del brand: in ogni grafica va com'è, con <img>. Non ridisegnarlo.`
    : `Il brand non ha un logo: dove serve la firma, il nome del brand scritto con il font dei titoli.`;
  const palette = brand.palette.length > 0 ? `I colori del brand (principale, secondario, accento, sfondo): ${brand.palette.join(', ')}.` : 'Il brand non ha scelto una palette.';
  // I font letti dal sito e la guida di stile scritta a parole non entrano: lo stile lo legge Claude dai riferimenti con
  // guarda, o lo sceglie da solo.
  const references = [
    folders.has('riferimenti-da-seguire') && 'riferimenti-da-seguire/ (i post scelti come esempio dello stile)',
    folders.has('file-riferimento') && 'file-riferimento/ (logo, foto e materiali caricati)',
  ].filter(Boolean);
  const style =
    references.length > 0
      ? `
## Lo stile
Le immagini di riferimento del brand sono in ${references.join(' e ')}. guardale con guarda e segui il loro stile.
`
      : `
## Lo stile
Il brand non ha immagini di riferimento: lo stile lo scegli tu dal settore e dalla palette.
`;
  const layouts = brand.layouts ?? [];
  const recent =
    layouts.length > 0
      ? `
## Le impaginazioni degli ultimi contenuti
Dal più recente: la prossima grafica ha una composizione diversa da queste.

${layouts.map((item) => `- ${item.title} (${item.format}): ${item.layout}`).join('\n')}
`
      : '';
  const planned = brand.plan ?? [];
  const plan = `
## Il piano
Oggi è ${formatWeekdayShort(planNow().date)} (${planNow().date}), ora di Roma. ${
    planned.length > 0
      ? `Le uscite dei prossimi 14 giorni, con l'id che serve ai tool del piano:

${planned
  .map(
    (slot) =>
      `- ${formatWeekdayShort(slot.date)} ${slot.time} · ${slot.channels.map(channelName).join(', ')} · ${SLOT_STATUS_LABELS[slot.status]}` +
      `${slot.title ? ` · «${slot.title}»` : ''}${slot.theme ? ` · tema ${slot.theme}` : ''} (id ${slot.id})`,
  )
  .join('\n')}`
      : 'Nei prossimi 14 giorni non ci sono uscite.'
  }
`;
  return `# ${name}

La cartella del brand ${name} su moonbrand. Questo file lo scrive moonbrand dal profilo del brand: non modificarlo, si riscrive a ogni lavoro.

${describeBrand(brand)}

## Logo e colori
${logoSection}
${palette}
${style}${recent}${plan}
## La cartella
${logo ? `- ${logo}: il logo del brand.\n` : ''}${folders.has('riferimenti-da-seguire') ? '- riferimenti-da-seguire/: i post scelti come esempio dello stile del brand.\n' : ''}${
    folders.has('file-riferimento') ? '- file-riferimento/: i file caricati per il brand (logo, foto, materiali).\n' : ''
  }${folders.has('allegati') ? '- allegati/: le foto e i video mandati nella chat.\n' : ''}- contenuti/<id>/: i contenuti salvati, con le immagini finali.
- chat/<id>/: la cartella di lavoro di ogni conversazione.
`;
}

export async function writeBrandBrief(brandDir: string, brand: BrandContext): Promise<void> {
  const entries = await readdir(brandDir, { withFileTypes: true }).catch(() => []);
  const folders = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  await writeFile(path.join(brandDir, 'CLAUDE.md'), brandBrief(brand, await logoFile(brandDir), folders));
}
