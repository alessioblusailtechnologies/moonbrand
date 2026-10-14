import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';

import type { VisualBrandContext } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName, exampleChannels, examplesPerChannel } from '@moonbrand/shared/domain/catalog';
import { FORMAT_ASPECT } from '@moonbrand/shared/domain/content';

import { logoFile } from '../lib/brand-logo';
import { CONTENT_RULES } from '../lib/content';
import { runExamples } from '../lib/examples';
import { languageRules } from '../lib/language';

// Gli esempi dell'onboarding: un post vero per canale, disegnato dal motore grafico, che fa vedere al brand come saranno
// i suoi post. Senza template: lo stile viene dalle immagini caricate (file-riferimento), o dalla palette e dal settore.

const [brandDir, dir, brandJson] = process.argv.slice(2);
if (!brandDir || !dir || !brandJson) {
  console.error('Uso: npm run visual -- <cartella del brand> <cartella degli esempi> <contesto del brand in JSON>');
  process.exit(1);
}

const brand = JSON.parse(brandJson) as VisualBrandContext;
// Solo i primi canali scelti: gli esempi sono al massimo MAX_EXAMPLES.
const chosen = exampleChannels(brand.channels);
const perChannel = examplesPerChannel(chosen);

// Da zero, ma solo nella cartella di questa generazione: le altre restano come sono.
await rm(path.join(brandDir, dir), { recursive: true, force: true });

// Il logo della bozza l'API lo mette in esempi/ (lo storage non vuole file alla radice); quello del profilo è alla radice.
const draftLogo = await logoFile(path.join(path.resolve(brandDir), 'esempi'));
const logo = (await logoFile(path.resolve(brandDir))) ?? (draftLogo && `esempi/${draftLogo}`);
const IMAGE = /\.(png|jpe?g|webp)$/i;
const references = (await readdir(path.join(brandDir, 'file-riferimento')).catch(() => []))
  .filter((name) => IMAGE.test(name))
  .sort()
  .map((name) => `file-riferimento/${name}`);

const LOOK: Record<ChannelId, string> = {
  instagram: 'editoriale, con la grafica del brand: palette, font, logo',
  facebook: 'come su Instagram, con la grafica del brand',
  linkedin: 'sobrio e leggibile: un titolo chiaro, un concetto o un dato in primo piano, poca decorazione, il logo discreto',
  tiktok: 'nativo, come lo fa chi usa l’app: una foto vera a tutto schermo con una frase scritta come la scrive l’app, niente grafica montata né logo',
  x: 'un messaggio solo, leggibile anche piccolo',
  pinterest: 'un pin verticale da salvare: una foto luminosa che occupa quasi tutto, un titolo grande che dice cosa si trova, il logo piccolo in basso',
};
const channels = chosen.map((channel) => `- ${channelName(channel)} (${channel}), in ${FORMAT_ASPECT.post[channel]}: ${LOOK[channel]}.`).join('\n');

const identity = `## Il brand
${JSON.stringify({ ...brand, channels: chosen, template: undefined }, null, 2)}

## Logo, colori e font
${logo ? `Il logo del brand è ${logo}: in ogni esempio che porta il logo va com'è, passato al motore grafico come primo riferimento.` : 'Il brand non ha un logo: dove serve la firma, il nome del brand con il font dei titoli.'}
I colori del brand (principale, secondario, accento, sfondo) sono ${brand.palette.join(', ')}: la grafica usa questi, non altri colori d'accento.
${brand.fonts ? `I font del brand sono ${brand.fonts.titles} per i titoli e ${brand.fonts.text} per i testi.` : 'Il brand non ha scelto dei font: un carattere coerente con il suo settore.'}`;

const style =
  references.length > 0
    ? `## Lo stile
Le immagini in file-riferimento sono post del brand, o che il brand vuole seguire: ${references.join(', ')}. Guardale tutte con guarda prima di cominciare (palette, tipografia, trattamento delle foto, segni grafici) e passane una o due al motore grafico dopo il logo. Gli esempi devono sembrare fatti dalla stessa mano, con un'idea e una composizione nuove: non copiare un riferimento.`
    : `## Lo stile
Il brand non ha caricato riferimenti: lo stile lo scegli tu dal settore, dai pubblici e dalla palette, pulito e professionale, come lo farebbe un grafico per questo brand.`;

const prompt = `Crea ${perChannel === 1 ? 'un esempio' : `${perChannel} esempi`} di post per ${chosen.length === 1 ? 'questo canale' : 'ciascuno di questi canali'}, per un brand che sta entrando su moonbrand: devono far vedere come saranno i suoi post, su un'idea vera e specifica del brand (un prodotto, un servizio, un momento del suo lavoro), non un post di presentazione.
${channels}

${identity}

${style}

${CONTENT_RULES}

Salva ogni esempio come PNG in ${dir} (es. ${dir}/instagram-1.png) e scrivi la didascalia del post come caption, nella lingua dei post del brand.

${languageRules()}`;

await runExamples({ brandDir, dir, channels: chosen, prompt });
