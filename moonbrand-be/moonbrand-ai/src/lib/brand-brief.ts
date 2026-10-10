import type { BrandContext } from '@moonbrand/shared/api/contract';
import type { BrandKind } from '@moonbrand/shared/domain/brand';
import { channelName, kindLabel, positioningLabel } from '@moonbrand/shared/domain/catalog';
import { brandLanguage } from '@moonbrand/shared/i18n/locales';

import { languageName } from './language';

// Il brand scritto a parole per i job: chi è, per chi scrive, temi e le istruzioni di chi lo cura.

const PERSON: Record<BrandKind, string> = {
  person: 'prima persona singolare: è un personal brand',
  company: 'prima persona plurale: parla a nome dell’azienda e del team',
  client: 'prima persona plurale, a nome del cliente: chi usa l’app ne cura la presenza',
};

// Obiettivi e pubblici del catalogo sono salvati con l'id: nel prompt vanno con l'etichetta italiana.
const list = (items: readonly string[]) => (items.length > 0 ? items.map((item) => positioningLabel(item)).join(', ') : 'non indicati');

export function describeBrand(brand: BrandContext): string {
  const { identity, positioning } = brand;
  // Manca nei job messi in coda prima che ci fossero.
  const instructions = brand.instructions?.trim() ?? '';
  const who = [
    `Tipo: ${kindLabel(identity.kind)}`,
    `Nome: ${identity.name || '(non indicato)'}`,
    identity.kind === 'person' && identity.role ? `Ruolo: ${identity.role}` : '',
    identity.kind === 'person' && identity.company ? `Azienda: ${identity.company}` : '',
    identity.kind !== 'person' && identity.sector ? `Settore: ${identity.sector}` : '',
    identity.site ? `Sito: ${identity.site}` : '',
    identity.pitch ? `Cosa fa, in una frase: ${identity.pitch}` : '',
    `Persona grammaticale dei post: ${PERSON[identity.kind]}`,
    `Lingua dei post: ${languageName(brandLanguage(identity))}`,
  ];
  const themes = [...brand.themes]
    .sort((a, b) => b.weight - a.weight)
    .map((theme) => `- ${theme.name} (id ${theme.id}, peso ${theme.weight}: più è alto, più spesso esce nel piano)`);
  return [
    '## Chi è',
    ...who.filter(Boolean),
    '',
    '## Per chi scrive e perché',
    `Pubblici: ${list(positioning.audiences)}`,
    `Obiettivi dei post: ${list(positioning.goals)}`,
    `Frequenza: ${positioning.postsPerWeek} post a settimana`,
    `Canali: ${brand.channels.map(channelName).join(', ')}`,
    '',
    '## Temi',
    ...(themes.length > 0 ? themes : ['Nessun tema definito.']),
    '',
    '## Istruzioni del cliente',
    instructions
      ? `Scritte da chi cura il brand: seguile in ogni lavoro, anche dove le regole generali dicono altro.\n\n${instructions}`
      : 'Nessuna: per il tono resta sobrio e concreto.',
  ].join('\n');
}
