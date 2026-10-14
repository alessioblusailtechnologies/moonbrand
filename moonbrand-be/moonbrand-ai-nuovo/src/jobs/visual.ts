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

// I font letti dal sito non si passano: la tipografia la detta il riferimento, o il motore grafico se non c'è.
const identity = `## Il brand
${JSON.stringify({ ...brand, channels: chosen, template: undefined, fonts: undefined }, null, 2)}

## Logo e colori
${logo ? `Il logo del brand è ${logo}: in ogni esempio che porta il logo va com'è, passato al motore grafico come primo riferimento.` : 'Il brand non ha un logo: dove serve la firma, il nome del brand in testo.'}
I colori del brand (principale, secondario, accento, sfondo) sono ${brand.palette.join(', ')}: la grafica usa questi colori.`;

const style =
  references.length > 0
    ? `## Lo stile
Le immagini in file-riferimento sono post che il brand vuole seguire: ${references.join(', ')}. Lo stile è quello, e lo vede il motore grafico direttamente: passagliene una o due come riferimento dopo il logo, e nel brief chiedi una composizione nuova in quello stile, con i colori del brand. Non descrivere e non riscrivere il riferimento a parole (tipografia, impaginazione, segni): lo tradiresti. Con guarda controlla solo cosa c'è in ogni file (un post, una foto, un logo), non come è fatto.`
    : `## Lo stile
Il brand non ha caricato riferimenti: lo stile lo scegli tu dal settore, dai pubblici e dalla palette, pulito e professionale, come lo farebbe un grafico per questo brand, e lo descrivi nel brief.`;

const prompt = `Crea ${perChannel === 1 ? 'un esempio' : `${perChannel} esempi`} di post per ${chosen.length === 1 ? 'questo canale' : 'ciascuno di questi canali'}, per un brand che sta entrando su moonbrand: devono far vedere come saranno i suoi post, su un'idea vera e specifica del brand (un prodotto, un servizio, un momento del suo lavoro), non un post di presentazione.
${channels}

${identity}

${style}

${CONTENT_RULES}

Salva ogni esempio come PNG in ${dir} (es. ${dir}/instagram-1.png) e scrivi la didascalia del post come caption, nella lingua dei post del brand.

${languageRules()}`;

await runExamples({ brandDir, dir, channels: chosen, prompt });
