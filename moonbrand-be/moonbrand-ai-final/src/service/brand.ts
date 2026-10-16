import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BrandContext } from '@moonbrand/shared/api/contract';
import type { BrandKind } from '@moonbrand/shared/domain/brand';
import { categoryLabel, channelName, kindLabel, positioningLabel } from '@moonbrand/shared/domain/catalog';
import { SLOT_STATUS_LABELS } from '@moonbrand/shared/domain/plan';
import { brandLanguage } from '@moonbrand/shared/i18n/locales';
import { formatWeekdayShort, planNow } from '@moonbrand/shared/lib/dates';

import { languageName } from './language';

// La cartella del brand: il CLAUDE.md che la descrive e il file del logo. Chi apre Claude lì dentro sa già chi è il
// brand, cosa ha (logo, colori, riferimenti) e dove sono le cose. Il CLAUDE.md lo scrive moonbrand dal profilo del brand
// prima di ogni lavoro, Claude non lo modifica; la memoria che Claude Code si tiene sul brand resta sua.

const PERSON: Record<BrandKind, string> = {
  person: 'prima persona singolare: è un personal brand',
  company: 'prima persona plurale: parla a nome dell’azienda e del team',
  client: 'prima persona plurale, a nome del cliente: chi usa l’app ne cura la presenza',
};

// Le cartelle che un brand può non avere: senza riferimenti caricati, senza allegati in chat. «La cartella» elenca solo
// quelle che ci sono: un agente che cerca una cartella che non c'è fa fallire il comando.
const REFERENCE_FOLDERS = { 'riferimenti-da-seguire': 'i post scelti come esempio dello stile del brand', 'file-riferimento': 'logo, foto e materiali caricati per il brand' };

const list = (items: readonly string[]) => (items.length > 0 ? items.map((item) => positioningLabel(item)).join(', ') : 'non indicati');

// Il brand a parole: chi è, per chi scrive, temi e le istruzioni di chi lo cura.
export function describeBrand(brand: BrandContext): string {
  const { identity, positioning } = brand;
  const instructions = brand.instructions?.trim() ?? '';
  const who = [
    `Tipo: ${kindLabel(identity.kind)}`,
    `Nome: ${identity.name || '(non indicato)'}`,
    identity.kind === 'person' && identity.role ? `Ruolo: ${identity.role}` : '',
    identity.kind === 'person' && identity.company ? `Azienda: ${identity.company}` : '',
    identity.kind !== 'person' && identity.sector ? `Settore: ${identity.sector}` : '',
    identity.category ? `Categoria: ${categoryLabel(identity.category)}` : '',
    identity.site ? `Sito: ${identity.site}` : '',
    identity.pitch ? `Cosa fa, in una frase: ${identity.pitch}` : '',
    `Persona grammaticale dei post: ${PERSON[identity.kind]}`,
    `Lingua dei post: ${languageName(brandLanguage(identity))}`,
  ];
  const themes = [...brand.themes].sort((a, b) => b.weight - a.weight).map((theme) => `- ${theme.name} (id ${theme.id}, peso ${theme.weight}: più è alto, più spesso esce nel piano)`);
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
    instructions ? `Scritte da chi cura il brand: seguile in ogni lavoro, anche dove le regole generali dicono altro.\n\n${instructions}` : 'Nessuna: per il tono resta sobrio e concreto.',
  ].join('\n');
}

export function brandGuide(brand: BrandContext, logo: string | null, folders: ReadonlySet<string>): string {
  const name = brand.identity.name || 'Brand';
  const logoLine = logo
    ? `Il logo del brand è ${logo}, nella cartella del brand: in ogni grafica va com’è, con <img>. Non ridisegnarlo.`
    : `Il brand non ha un logo: dove serve la firma, il nome del brand scritto in testo.`;
  const palette = brand.palette.length > 0 ? `I colori del brand (principale, secondario, accento, sfondo): ${brand.palette.join(', ')}.` : 'Il brand non ha scelto una palette.';
  const references = Object.entries(REFERENCE_FOLDERS).filter(([folder]) => folders.has(folder));
  const style =
    references.length > 0
      ? `Le immagini di riferimento del brand sono in ${references.map(([folder, what]) => `${folder}/ (${what})`).join(' e ')}: guardale con guarda e segui il loro stile.`
      : 'Il brand non ha immagini di riferimento: lo stile lo scegli tu dal settore e dai colori.';
  const layouts = brand.layouts ?? [];
  const recent =
    layouts.length > 0
      ? `
## Gli ultimi contenuti
Dal più recente, com’erano impaginati: il prossimo ha una composizione diversa.

${layouts.map((item) => `- ${item.title} (${item.format}): ${item.layout}`).join('\n')}
`
      : '';
  const planned = brand.plan ?? [];
  const plan = `
## Il piano
Oggi è ${formatWeekdayShort(planNow().date)} (${planNow().date}), ora di Roma. ${
    planned.length > 0
      ? `Le uscite dei prossimi 14 giorni, con l’id che serve ai tool del piano:

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
  const folderLines = [
    logo && `- ${logo}: il logo del brand.`,
    ...references.map(([folder, what]) => `- ${folder}/: ${what}.`),
    folders.has('allegati') && '- allegati/: le foto e i video mandati nella chat.',
    '- contenuti/<id>/: i contenuti salvati, con le immagini e i video finali.',
    '- chat/<id>/: la cartella di lavoro di ogni conversazione.',
    '- video/: il progetto Remotion dei video del brand (vedi video/README.md).',
  ].filter(Boolean);
  return `# ${name}

La cartella del brand ${name} su moonbrand. Questo file lo scrive moonbrand dal profilo del brand: non modificarlo, si riscrive a ogni lavoro.

${describeBrand(brand)}

## Logo, colori e riferimenti
${logoLine}
${palette}
${style}
${recent}${plan}
## La cartella
${folderLines.join('\n')}
`;
}

export async function writeBrandGuide(brandDir: string, brand: BrandContext): Promise<void> {
  const entries = await readdir(brandDir, { withFileTypes: true }).catch(() => []);
  const folders = new Set(entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));
  await writeFile(path.join(brandDir, 'CLAUDE.md'), brandGuide(brand, await logoFile(brandDir), folders));
}

// Il logo del brand sta sul DB come data URI: nella cartella del brand diventa logo.<estensione>, così chi fa una grafica
// lo mette com'è invece di ridisegnarlo. Si riscrive prima di ogni lavoro, solo se è cambiato; senza logo il file si toglie.
const EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/svg+xml': '.svg' };
const LOGO = /^logo\.(png|jpg|webp|svg)$/;

function decodeLogo(uri: string): { extension: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+)((?:;[^;,]+)*),(.*)$/s.exec(uri);
  const extension = match && EXTENSIONS[match[1]!.toLowerCase()];
  if (!match || !extension) return null;
  const bytes = match[2]!.includes(';base64') ? Buffer.from(match[3]!, 'base64') : Buffer.from(decodeURIComponent(match[3]!));
  return bytes.length > 0 ? { extension, bytes } : null;
}

export async function logoFile(brandDir: string): Promise<string | null> {
  const names = await readdir(brandDir).catch(() => [] as string[]);
  return names.find((name) => LOGO.test(name)) ?? null;
}

// logoUri: il logo com'è sul DB, null se il brand non ce l'ha; undefined se il brand non è ancora sul DB (onboarding).
export async function writeLogoFile(brandDir: string, logoUri: string | null | undefined): Promise<void> {
  if (logoUri === undefined) return;
  const logo = logoUri ? decodeLogo(logoUri) : null;
  const current = await logoFile(brandDir);
  const target = logo && `logo${logo.extension}`;
  if (current && current !== target) await rm(path.join(brandDir, current), { force: true });
  if (!logo || !target) return;
  const before = current === target ? await readFile(path.join(brandDir, target)).catch(() => null) : null;
  if (!before?.equals(logo.bytes)) await writeFile(path.join(brandDir, target), logo.bytes);
}
