import { rm } from 'node:fs/promises';
import path from 'node:path';

import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import { channelName, exampleChannels, examplesPerChannel } from '@moonbrand/shared/domain/catalog';

import { logoFile } from '../lib/brand-logo';
import { channelLooks, runExamples, workDir } from '../lib/examples';
import { fontsLine } from '../lib/fonts';
import { languageRules } from '../lib/language';
import { installTemplate, templateName, templateSection } from '../lib/templates';

const [brandDir, dir, brandJson] = process.argv.slice(2);
if (!brandDir || !dir || !brandJson) {
  console.error('Uso: npm run visual -- <cartella del brand> <cartella degli esempi> <contesto del brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as VisualBrandContext;
// Solo i primi canali scelti: gli esempi sono al massimo MAX_EXAMPLES.
const chosen = exampleChannels(brand.channels);
const channels = chosen.map((id) => `${channelName(id)} (${id})`).join(', ');
const perChannel = examplesPerChannel(chosen);

// Da zero, ma solo nella cartella di questa generazione: le altre restano come sono.
await rm(path.join(brandDir, dir), { recursive: true, force: true });

// Con un template gli esempi nascono dai suoi layout, nei colori del brand; senza, dalle immagini di riferimento.
const template = await installTemplate(brandDir, brand.template, brand.palette, brand.fonts);
const name = templateName(brand.template);
const source =
  template && name
    ? `Lo stile è quello del template del brand: per i canali curati ogni esempio è una composizione nuova in quello stile, diversa dalle altre e da ogni layout del template, non un layout con i testi cambiati.

## Il template
${templateSection(name, template)}
`
    : 'Ispirati alle immagini di riferimento nella cartella file-riferimento.';

// L'identità del brand vale in ogni esempio, con o senza template: il logo vero (l'API lo mette nella cartella) e i font.
const logo = await logoFile(path.resolve(brandDir));
const fonts = fontsLine(brand.fonts);
const identity = `## Il logo
${logo ? `Il logo del brand è ${logo}, nella cartella del brand: dove un post porta il logo, mettilo com'è con <img> (percorso relativo dalla pagina), senza ridisegnarlo, ricolorarlo o ritagliarlo.` : 'Il brand non ha un logo: dove serve la firma, scrivi il nome del brand con il font dei titoli.'}

## I colori
I colori del brand (principale, secondario, accento, sfondo) sono ${brand.palette.join(', ')}: la grafica usa questi, non altri colori d'accento.
${fonts ? `
## I font
${fonts}
` : ''}`;

const prompt = `Crea ${perChannel === 1 ? 'un esempio' : `${perChannel} esempi`} di post per ${chosen.length === 1 ? 'il canale' : 'ciascuno di questi canali'}: ${channels}.

${identity}
${source}
Salva ogni esempio come immagine nella cartella ${dir}.
Ogni esempio deve sembrare nato sul suo canale, restando riconoscibile come del brand: stesso brand, confezione del canale.
${await channelLooks(chosen)}
Tieni i file di lavoro (HTML, script, foto intermedie) nella cartella ${workDir(dir)}.

${languageRules()}

Il brand:
${JSON.stringify({ ...brand, channels: chosen }, null, 2)}`;

await runExamples({ brandDir, dir, channels: chosen, prompt });
