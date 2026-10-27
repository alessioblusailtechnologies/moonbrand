import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { Identity, Positioning, Theme } from '@moonbrand/shared/domain/brand';
import { matchLocale } from '@moonbrand/shared/i18n/locales';

import { logoFile } from '../../lib/brand-logo';
import { languageName } from '../../lib/language';
import { MOONBRAND } from './moonbrand';

// La cartella del brand a fine onboarding, senza Claude: il CLAUDE.md con i dati del brand, scritto una volta sola e poi
// mai più toccato, le istruzioni personalizzate in istruzioni-personalizzate.md e i riferimenti caricati dall'utente in
// riferimenti/. Istruzioni e riferimenti si riscrivono a ogni giro: l'utente li cambia anche dopo, il CLAUDE.md dice
// solo dove sono. Con AI_ENGINE=v2 l'API carica i riferimenti direttamente in riferimenti/; quelli dei brand nati prima,
// in file-riferimento/, qui si copiano. Il logo (logo.<estensione>) lo scrive il worker.
// Il worker legge i messaggi dell'SDK di Claude: lo script scrive solo quello finale, con il risultato.

export interface FolderBrand {
  identity: Identity;
  positioning: Positioning;
  themes: Theme[];
  instructions: string;
  palette: string[];
  // I percorsi dei riferimenti nella cartella del brand, come li ha salvati l'API (file-riferimento/<nome>).
  references: string[];
}

const REFERENCES = 'riferimenti';
const INSTRUCTIONS = 'istruzioni-personalizzate.md';

const [brandDir, brandJson] = process.argv.slice(2);
if (!brandDir || !brandJson) {
  console.error('Uso: npm run cartella -- <cartella del brand> <brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as FolderBrand;
const exists = (file: string) => access(file).then(
  () => true,
  () => false,
);
const list = (items: string[]) => items.map((item) => `- ${item}`).join('\n');

function guide(logo: string | null): string {
  const { identity, positioning } = brand;
  const language = matchLocale(identity.language) ?? 'it';
  const [primary, secondary, accent, background] = brand.palette;
  const sections = [
    MOONBRAND,
    `# Il brand: ${identity.name || 'senza nome'}`,
    identity.pitch,
    [
      identity.sector && `- Settore: ${identity.sector}`,
      identity.site && `- Sito: ${identity.site}`,
      `- Lingua dei post: ${languageName(language)}`,
    ]
      .filter(Boolean)
      .join('\n'),
    `## Obiettivi\n${list(positioning.goals)}`,
    `## Pubblico\n${list(positioning.audiences)}`,
    `## Temi, dal più importante\n${list([...brand.themes].sort((a, b) => b.weight - a.weight).map((theme) => theme.name))}`,
    `## Palette\n- Principale ${primary}\n- Secondario ${secondary}\n- Accento ${accent}\n- Sfondo ${background}`,
    `## Logo\n${logo ? `Il logo è ${logo}: usalo com'è, senza ridisegnarlo.` : 'Il brand non ha un logo: dove serve, il nome del brand in testo.'}`,
    `## Riferimenti\nLe immagini che il brand ha scelto come esempio dello stile che vuole sono in ${REFERENCES}/, se ne ha caricate.`,
    `## Istruzioni personalizzate\nQuelle che il brand ha scritto sono in ${INSTRUCTIONS}: seguile sempre.`,
  ];
  return sections.filter(Boolean).join('\n\n') + '\n';
}

await mkdir(brandDir, { recursive: true });

// I riferimenti si copiano ogni volta: l'utente può cambiarli anche dopo l'onboarding.
let copied = 0;
if (brand.references.length > 0) await mkdir(path.join(brandDir, REFERENCES), { recursive: true });
for (const reference of brand.references) {
  const source = path.join(brandDir, reference);
  if (!(await exists(source))) continue;
  // Con AI_ENGINE=v2 l'API li carica già in riferimenti/; quelli in file-riferimento/ sono dei brand nati prima.
  if (path.dirname(reference) !== REFERENCES) await copyFile(source, path.join(brandDir, REFERENCES, path.basename(reference)));
  copied += 1;
}

// Vuoto se il brand non ne ha: il file c'è sempre, come dice il CLAUDE.md.
const instructions = brand.instructions.trim();
await writeFile(path.join(brandDir, INSTRUCTIONS), instructions ? `${instructions}\n` : '');

const claudeMd = path.join(brandDir, 'CLAUDE.md');
const written = !(await exists(claudeMd));
if (written) await writeFile(claudeMd, guide(await logoFile(brandDir)));

console.log(
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    structured_output: { claudeMd: written, instructions: instructions.length > 0, references: copied },
    total_cost_usd: 0,
  }),
);
