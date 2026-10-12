import { createHash } from 'node:crypto';
import { cp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BrandFonts } from '@moonbrand/shared/domain/brand';
import { findTemplate } from '@moonbrand/shared/domain/templates';

import { fontLinks, type FontLinks } from './fonts';

// I template di moonbrand (plugin/templates/<id>, vedi plugin/templates/README.md): il codice copia quello scelto dal brand
// in template/ nella cartella del brand prima di ogni lavoro, con i colori e i font del brand al posto di quelli
// dell'anteprima. Così chi fa un contenuto lo trova lì, già con l'identità del brand, e un cambio vale dal lavoro dopo.
export const TEMPLATES_DIR = fileURLToPath(new URL('../../plugin/templates/', import.meta.url));

export const BRAND_TEMPLATE_DIR = 'template';

// Le variabili dei colori nei layout, nell'ordine della palette del brand: principale, secondario, accento, sfondo.
const COLOR_VARIABLES = ['--principale', '--secondario', '--accento', '--sfondo'];
// Il blocco che dichiara --principale, non uno che lo usa con var(--principale).
export const COLORS_BLOCK = /:root\s*\{[^}]*--principale\s*:[^}]*\}/;
// I font dei titoli e dei testi, in un blocco :root loro: il motore ci mette davanti quelli del brand.
export const FONTS_BLOCK = /:root\s*\{[^}]*--font-titoli\s*:[^}]*\}/;

// Quello da cui dipende la copia: il template, i suoi file, i colori e i font. Uguale a quella già copiata: niente da
// rifare, così il worker non ricarica sullo storage gli stessi file a ogni lavoro.
const STAMP = '.copia';

export function colorsBlock(palette: readonly string[]): string {
  return `:root { ${COLOR_VARIABLES.map((variable, index) => `${variable}: ${palette[index]};`).join(' ')} }`;
}

export function withColors(html: string, palette: readonly string[]): string {
  return palette.length >= COLOR_VARIABLES.length ? html.replace(COLORS_BLOCK, colorsBlock(palette)) : html;
}

// I font del brand davanti a quelli del template, che restano come ripiego; i link di Google Fonts prima di </head>.
export function withFonts(html: string, fonts: FontLinks | null): string {
  const block = fonts && FONTS_BLOCK.exec(html)?.[0];
  if (!fonts || !block) return html;
  const prepend = (css: string, variable: string, family: string | null) =>
    family ? css.replace(new RegExp(`(${variable}\\s*:\\s*)`), `$1'${family}', `) : css;
  const branded = prepend(prepend(block, '--font-titoli', fonts.titles), '--font-testo', fonts.text);
  return html.replace(block, branded).replace(/<\/head>/i, `${fonts.links.join('\n')}\n</head>`);
}

async function stampOf(id: string, source: string, palette: readonly string[], fonts: BrandFonts | null | undefined): Promise<string> {
  const hash = createHash('sha1').update(`${id}:${palette.join(',')}:${fonts ? `${fonts.titles}/${fonts.text}` : ''}`);
  const entries = await readdir(source, { recursive: true, withFileTypes: true });
  for (const entry of entries.filter((item) => item.isFile()).sort((a, b) => a.parentPath.localeCompare(b.parentPath) || a.name.localeCompare(b.name))) {
    const file = path.join(entry.parentPath, entry.name);
    const { size, mtimeMs } = await stat(file);
    hash.update(`${path.relative(source, file)}:${size}:${mtimeMs}`);
  }
  return hash.digest('hex');
}

// Copia il template nella cartella del brand (o la svuota se il brand non ne ha) e ci mette i colori e i font del brand.
// Restituisce il testo di TEMPLATE.md, null senza template.
export async function installTemplate(
  brandDir: string,
  id: string | null | undefined,
  palette: readonly string[],
  fonts: BrandFonts | null | undefined = null,
): Promise<string | null> {
  const target = path.join(brandDir, BRAND_TEMPLATE_DIR);
  const template = findTemplate(id);
  if (!template) {
    await rm(target, { recursive: true, force: true });
    return null;
  }
  const source = path.join(TEMPLATES_DIR, template.id);
  const stamp = await stampOf(template.id, source, palette, fonts);
  const guide = path.join(target, 'TEMPLATE.md');
  if ((await readFile(path.join(target, STAMP), 'utf8').catch(() => null)) === stamp) return (await readFile(guide, 'utf8')).trim();

  await rm(target, { recursive: true, force: true });
  // Le foto d'esempio servono solo alle anteprime: nella cartella del brand non vanno.
  await cp(source, target, { recursive: true, filter: (file) => path.relative(source, file).split(path.sep)[0] !== 'esempio' });
  const links = await fontLinks(fonts);
  const layouts = path.join(target, 'layout');
  for (const name of (await readdir(layouts)).filter((file) => file.endsWith('.html'))) {
    const file = path.join(layouts, name);
    await writeFile(file, withFonts(withColors(await readFile(file, 'utf8'), palette), links));
  }
  await writeFile(path.join(target, STAMP), stamp);
  return (await readFile(guide, 'utf8')).trim();
}

// La sezione del CLAUDE.md del brand e del prompt degli esempi. Il template è un riferimento di stile, non un modulo:
// ogni post è una composizione nuova in quello stile, con colori, font, logo e soggetti del brand.
export function templateSection(name: string, guide: string): string {
  return `Il brand ha scelto il template «${name}» di moonbrand al posto delle immagini di riferimento. Il template è un riferimento di stile, non un modulo da riempire: ne prendi impaginazione, tipografia, segni grafici e tono; colori, font, logo e soggetti sono del brand.
I suoi layout sono in ${BRAND_TEMPLATE_DIR}/layout/ (HTML a 1080×1350, già con i colori e i font del brand), le anteprime in ${BRAND_TEMPLATE_DIR}/anteprima/ (nei colori del template: guardale con guarda solo se la descrizione qui sotto non basta). Mostrano come lavora il grafico di questo stile: come impagina un titolo, come taglia una foto, che segni usa e dove, quanto spazio lascia.
Ogni post dei canali curati (Instagram, Facebook, LinkedIn, Pinterest) è una composizione nuova in questo stile, pensata per la sua idea, come la farebbe lo stesso grafico per un post che il template non ha. Non copiare un layout cambiando solo testi e foto: chi guarda non deve riconoscere un template riempito. Puoi partire da un layout come base e cambiarne la composizione (posizione e misura di titolo e foto, quali segni usare, il ritmo), oppure combinare elementi di layout diversi; tieni la griglia, i margini, la tipografia e i segni grafici del sistema. Due post di fila non hanno la stessa composizione. Su TikTok vale la confezione nativa del canale, non il template.
Del brand, sempre:
- I colori: quelli del brand al posto di quelli del template (nei layout ci sono già, nelle variabili). Non serve usarli tutti: scegli quelli che servono al post, ma il post deve avere i colori del brand, non quelli del template. Se un testo non si legge sul suo fondo, scambia i colori del brand o usa bianco o nero.
- I font: quelli del brand (vedi «I font»), già messi nei layout; i font del template restano solo per i dettagli decorativi (una firma scritta a mano, un numero ornamentale). Se con i font del brand un titolo esce dalla sua forma o tocca un altro elemento, riducine la misura.
- Il logo: dove il layout ha l'elemento .logo, metti il file del logo del brand (vedi «Il logo»); il nome in testo solo se il brand non ha un logo.
- Le foto: raccontano il brand (il suo settore, i suoi prodotti, le sue persone, i suoi luoghi). I commenti nei layout descrivono le foto d'esempio del template, non il soggetto da usare; le foto d'esempio non ci sono, metti quelle del brand o generane di nuove sul brand.

${guide}`;
}

export function templateName(id: string | null | undefined): string | null {
  return findTemplate(id)?.name ?? null;
}
