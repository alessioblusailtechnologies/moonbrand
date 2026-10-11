import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findTemplate } from '@moonbrand/shared/domain/templates';

import { COLORS_BLOCK, TEMPLATES_DIR } from '../lib/templates';
import { createRenderer, launchChrome } from '../tools/grafica';

// Le anteprime di un template: ogni layout reso in JPEG con lo stesso Chrome e gli stessi controlli dei contenuti, in
// anteprima/ accanto ai layout (le guarda l'agente) e in public/templates/<id>/ dello studio (le guarda chi sceglie).
// I controlli «da correggere» e «da valutare» si stampano: un template li deve passare tutti, come un contenuto.

const MAX_GUIDE = 2500;
// Nello studio le anteprime si vedono piccole: a metà misura pesano un quarto.
const STUDIO_SIZE = { width: 540, height: 675 };
const COLOR_VARIABLES = ['--accento', '--principale', '--secondario', '--sfondo'].join(' ');

const STUDIO_DIR = fileURLToPath(new URL('../../../../moonbrand-studio/public/templates/', import.meta.url));

const [id] = process.argv.slice(2);
const template = findTemplate(id);
if (!template) {
  console.error('Uso: npm run template-anteprime -- <id del template, da moonbrand-shared/src/domain/templates.ts>');
  process.exit(1);
}

const root = path.join(TEMPLATES_DIR, template.id);
const layouts = (await readdir(path.join(root, 'layout'))).filter((name) => name.endsWith('.html')).map((name) => name.replace(/\.html$/, ''));
const missing = template.layouts.filter((name) => !layouts.includes(name));
if (missing.length > 0) console.warn(`Mancano i layout del catalogo: ${missing.join(', ')}.`);

// Il contratto del README che il render non vede: la lunghezza di TEMPLATE.md e il blocco dei colori che il motore sostituisce.
// I caratteri si contano come li legge una persona: senza i ritorni a capo di Windows.
const guide = [...(await readFile(path.join(root, 'TEMPLATE.md'), 'utf8').catch(() => '')).replace(/\r\n/g, '\n').trim()];
if (guide.length === 0) console.warn('Manca TEMPLATE.md.');
else if (guide.length > MAX_GUIDE) console.warn(`TEMPLATE.md è di ${guide.length} caratteri: al massimo ${MAX_GUIDE}.`);
for (const name of layouts) {
  const block = COLORS_BLOCK.exec(await readFile(path.join(root, 'layout', `${name}.html`), 'utf8'))?.[0] ?? '';
  const variables = [...block.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]).sort().join(' ');
  if (variables !== COLOR_VARIABLES) console.warn(`${name}: il blocco :root dei colori deve avere solo ${COLOR_VARIABLES} (ha: ${variables || 'niente'}).`);
}

await rm(path.join(root, 'anteprima'), { recursive: true, force: true });
await mkdir(path.join(root, 'anteprima'), { recursive: true });
const studio = path.join(STUDIO_DIR, template.id);
await rm(studio, { recursive: true, force: true });
await mkdir(studio, { recursive: true });

const { render, close } = createRenderer(root);
try {
  const reports = await Promise.all(
    layouts.map((name) => render(`layout/${name}.html`, `anteprima/${name}.jpg`, '4:5').catch((error: unknown) => `Non riuscita ${name}: ${String(error)}`)),
  );
  console.log(reports.join('\n\n'));
  const done = layouts.filter((_, index) => reports[index].startsWith('Salvata'));
  const browser = await launchChrome();
  try {
    const page = await browser.newPage();
    await page.setViewport(STUDIO_SIZE);
    for (const name of template.layouts.filter((layout) => done.includes(layout))) {
      const data = (await readFile(path.join(root, 'anteprima', `${name}.jpg`))).toString('base64');
      await page.setContent(`<body style="margin:0"><img src="data:image/jpeg;base64,${data}" style="display:block;width:100%;height:100%"></body>`);
      await page.evaluate('document.images[0].decode()');
      await writeFile(path.join(studio, `${name}.jpg`), await page.screenshot({ type: 'jpeg', quality: 82 }));
    }
  } finally {
    await browser.close();
  }
} finally {
  await close();
}
