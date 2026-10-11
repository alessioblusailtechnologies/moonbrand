import { createHash } from 'node:crypto';
import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findTemplate } from '@moonbrand/shared/domain/templates';

// I template di moonbrand (plugin/templates/<id>, vedi plugin/templates/README.md): il codice copia quello scelto dal brand
// in template/ nella cartella del brand prima di ogni lavoro, con i colori del brand al posto di quelli dell'anteprima.
// Così chi fa un contenuto lo trova lì, già nei colori giusti, e un cambio di template vale dal lavoro dopo.
export const TEMPLATES_DIR = fileURLToPath(new URL('../../plugin/templates/', import.meta.url));

export const BRAND_TEMPLATE_DIR = 'template';

// Le variabili dei colori nei layout, nell'ordine della palette del brand: principale, secondario, accento, sfondo.
const COLOR_VARIABLES = ['--principale', '--secondario', '--accento', '--sfondo'];
// Il blocco che dichiara --principale, non uno che lo usa con var(--principale).
export const COLORS_BLOCK = /:root\s*\{[^}]*--principale\s*:[^}]*\}/;

// Quello da cui dipende la copia: il template, i suoi file e i colori. Uguale a quella già copiata: niente da rifare,
// così il worker non ricarica sullo storage gli stessi file a ogni lavoro.
const STAMP = '.copia';

export function colorsBlock(palette: readonly string[]): string {
  return `:root { ${COLOR_VARIABLES.map((variable, index) => `${variable}: ${palette[index]};`).join(' ')} }`;
}

export function withColors(html: string, palette: readonly string[]): string {
  return palette.length >= COLOR_VARIABLES.length ? html.replace(COLORS_BLOCK, colorsBlock(palette)) : html;
}

async function stampOf(id: string, source: string, palette: readonly string[]): Promise<string> {
  const hash = createHash('sha1').update(`${id}:${palette.join(',')}`);
  const entries = await readdir(source, { recursive: true, withFileTypes: true });
  for (const entry of entries.filter((item) => item.isFile()).sort((a, b) => a.parentPath.localeCompare(b.parentPath) || a.name.localeCompare(b.name))) {
    const file = path.join(entry.parentPath, entry.name);
    const { size, mtimeMs } = await stat(file);
    hash.update(`${path.relative(source, file)}:${size}:${mtimeMs}`);
  }
  return hash.digest('hex');
}

// Copia il template nella cartella del brand (o la svuota se il brand non ne ha) e ci mette i colori del brand.
// Restituisce il testo di TEMPLATE.md, null senza template.
export async function installTemplate(brandDir: string, id: string | null | undefined, palette: readonly string[]): Promise<string | null> {
  const target = path.join(brandDir, BRAND_TEMPLATE_DIR);
  const template = findTemplate(id);
  if (!template) {
    await rm(target, { recursive: true, force: true });
    return null;
  }
  const source = path.join(TEMPLATES_DIR, template.id);
  const stamp = await stampOf(template.id, source, palette);
  const guide = path.join(target, 'TEMPLATE.md');
  if ((await readFile(path.join(target, STAMP), 'utf8').catch(() => null)) === stamp) return (await readFile(guide, 'utf8')).trim();

  await rm(target, { recursive: true, force: true });
  // Le foto d'esempio servono solo alle anteprime: nella cartella del brand non vanno.
  await cp(source, target, { recursive: true, filter: (file) => path.relative(source, file).split(path.sep)[0] !== 'esempio' });
  const layouts = path.join(target, 'layout');
  for (const name of (await readdir(layouts)).filter((file) => file.endsWith('.html'))) {
    const file = path.join(layouts, name);
    await writeFile(file, withColors(await readFile(file, 'utf8'), palette));
  }
  await writeFile(path.join(target, STAMP), stamp);
  return (await readFile(guide, 'utf8')).trim();
}

// La sezione del CLAUDE.md del brand e del prompt degli esempi: il template è il sistema grafico del brand.
export function templateSection(name: string, guide: string): string {
  return `Il brand ha scelto il template «${name}» di moonbrand al posto delle immagini di riferimento: è il suo sistema grafico.
I layout sono in ${BRAND_TEMPLATE_DIR}/layout/ (HTML a 1080×1350, già con i colori del brand), le anteprime in ${BRAND_TEMPLATE_DIR}/anteprima/ (guardale con guarda solo se la descrizione qui sotto non basta).
Per i post e le slide dei canali curati (Instagram, Facebook, LinkedIn, Pinterest) parti dal layout che serve all'idea: copialo nella cartella di lavoro, cambia testi e foto (le foto d'esempio dei layout non ci sono: metti quelle del brand o generane di nuove), adatta la proporzione se il formato è un altro. Tieni impaginazione, font, griglia, margini e segni grafici del template, anche quelli che il mestiere elenca tra i segni dell'AI: vengono da un template di un grafico vero e sono lo stile del brand (renderizza li segnala tra quelli da valutare: lasciali). Cambia testi e foto per servire l'idea, e alterna i layout tra un contenuto e l'altro. I colori sono quelli del brand messi al posto di quelli del template: se un testo o un numero non si legge bene sul suo fondo (accento troppo chiaro sullo sfondo, principale troppo scuro sulla foto), scambia i colori o usa bianco o nero. Su TikTok vale la confezione nativa del canale, non il template.

${guide}`;
}

export function templateName(id: string | null | undefined): string | null {
  return findTemplate(id)?.name ?? null;
}
