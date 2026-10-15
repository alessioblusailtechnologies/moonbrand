import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { FORMAT_ASPECT, formatAspects, hasDocument, type ContentFormat } from '@moonbrand/shared/domain/content';

import { photoTools } from '../tools/foto';
import { graphicsTools } from '../tools/renderizza';
import { visionTools } from '../tools/vista';
import { MODEL } from './model';

// Le regole per scrivere e disegnare un contenuto stanno qui, nel prompt: niente skill. Un contenuto ha un testo per
// canale e le sue immagini, fatte da Claude in HTML e CSS ed esportate in PNG (tool renderizza); le foto dentro le
// grafiche le fa il modello di immagini (tool foto).

export const SLIDES = { min: 5, max: 7 };

export function contentDir(contentId: string): string {
  return `contenuti/${contentId}`;
}

// I file che servono, nelle proporzioni dei canali (FORMAT_ASPECT): una copertina per proporzione nel post e nell'articolo,
// un giro di slide per proporzione nel carosello. Due canali nella stessa proporzione con confezioni diverse (TikTok accanto a
// Instagram) hanno ciascuno i suoi file: quelli fatti apposta per un canale si salvano con channel.
export function neededFiles(format: ContentFormat, channels: readonly ChannelId[]): string {
  const aspects = formatAspects(format, channels);
  const own = shareAspect(format, channels)
    ? '. Se due canali nella stessa proporzione vogliono confezioni diverse (TikTok nativo accanto a Instagram editoriale), i file di quello con la sua confezione hanno channel'
    : '';
  if (format === 'carousel') {
    const rounds = aspects.length > 1 ? `, un giro per proporzione (${aspects.join(', ')}) con gli stessi index` : ` in ${aspects[0]}`;
    const pdf = hasDocument(format, channels) ? '. Per LinkedIn moonbrand riunisce da solo le slide 4:5 in un documento PDF: non farlo tu' : '';
    return `le slide del carosello, da ${SLIDES.min} a ${SLIDES.max}${rounds} (role «slide», index da 0)${pdf}${own}`;
  }
  const what = format === 'article' ? 'la copertina dell’articolo' : 'la copertina del post';
  return `${what} in ${aspects.join(', ')}: una per proporzione (role «cover», index da 0)${own}`;
}

// Se almeno due canali escono nella stessa proporzione.
const shareAspect = (format: ContentFormat, channels: readonly ChannelId[]) =>
  formatAspects(format, channels).length < channels.filter((channel) => FORMAT_ASPECT[format][channel]).length;

export const channelList = (channels: readonly ChannelId[]) => channels.map((channel) => `${channelName(channel)} (${channel})`).join(', ');

// Come si scrive e si disegna un contenuto: valgono per i job e per la chat.
export const CONTENT_RULES = `## Come si scrive
- Nella lingua dei post del brand (CLAUDE.md, «Lingua dei post»), semplice e concreto: niente gergo di marketing, niente frasi fatte, niente tic da testo scritto con l’AI (trattini lunghi, «non è X, è Y», elenchi di tre, domande retoriche in apertura, emoji come punti elenco, maiuscole per enfasi).
- Le istruzioni del cliente in CLAUDE.md valgono sopra ogni altra regola.
- Non inventare fatti, numeri, prezzi, nomi o risultati: dove serve un dato che non hai, metti [il dato] tra parentesi quadre.
- Una variante per canale, scritta per quel canale. Gli hashtag solo nel campo hashtags, pochi e specifici, con # davanti.
- Per canale: LinkedIn da 700 a 1.500 caratteri con la prima riga che ferma lo scorrimento e paragrafi brevi, 3 hashtag; Instagram intorno ai 220 caratteri con l’aggancio nei primi 125, fino a 5 hashtag; Facebook discorsivo da 300 a 1.000 caratteri, fino a 2 hashtag; TikTok una o due righe intorno ai 120 caratteri, fino a 6 hashtag; X una sola idea, testo e hashtag insieme entro 280 caratteri; Pinterest la descrizione del pin da 150 a 400 caratteri con le parole che la gente cerca, fino a 3 hashtag.
- Formati: il post ha un’immagine (headline è il suo titolo, fino a 60 caratteri, se ne ha uno). Il carosello ha da ${SLIDES.min} a ${SLIDES.max} slide: la prima aggancia, le centrali sviluppano un punto ciascuna, l’ultima chiude con un’azione; titoli fino a 40 caratteri, testi fino a 160; headline è il titolo della prima. L’articolo è il testo lungo su LinkedIn (apertura forte, tre o quattro paragrafi) e un testo breve che lo presenta sugli altri canali; headline è il suo titolo.

## Come si disegna
- Le immagini le fai tu, in HTML e CSS: una pagina per immagine, alle misure del formato, salvata nella cartella del contenuto, poi esportata in PNG con renderizza. CSS dentro la pagina, niente script; il logo e le foto con <img> e percorsi relativi; i font da Google Fonts con <link>.
- Quando nella grafica serve una foto (un piatto, una ciocca di capelli, un locale, una persona al lavoro) e il brand non l’ha mandata, falla con il tool foto: descrivi soggetto, inquadratura, luce e trattamento, coerenti con i riferimenti del brand; niente testo e niente logo dentro la foto, quelli li metti tu nell’HTML. Poi la metti con <img>. Non disegnare in CSS quello che sarebbe una foto.
- Il logo del brand (logo.png) va com’è. I colori sono quelli del brand, in CLAUDE.md.
- Se il brand ha riferimenti (riferimenti-da-seguire/, file-riferimento/) guardali con guarda prima di cominciare e segui il loro stile. Se non ne ha, lo stile lo scegli tu per questo brand, e lo cambi da un contenuto all’altro: le ultime impaginazioni sono in CLAUDE.md.
- Dopo il render apri il PNG con Read e correggi quello che non va (testi tagliati o sovrapposti, poco leggibili, logo che manca). Nessuna immagine si consegna senza averla vista.
- In una correzione di un contenuto già fatto rifai solo le immagini che la correzione tocca.
- Le foto e i video che l’utente ha mandato (allegati/, file-riferimento/) li puoi usare nelle grafiche con <img>. Non usare materiali di altri brand.
- Nel campo layout, quando salvi, scrivi l’impaginazione in una frase: la leggeranno i contenuti dopo per variare.`;

export function contentSchema(contentId: string, format: ContentFormat, channels: ChannelId[]) {
  const carousel = format === 'carousel';
  return {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'variants', 'visual'],
    properties: {
      title: { type: 'string', description: 'Il titolo del contenuto in una frase' },
      variants: {
        type: 'array',
        minItems: channels.length,
        maxItems: channels.length,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['channel', 'text', 'hashtags'],
          properties: {
            channel: { type: 'string', enum: channels },
            text: { type: 'string', description: 'Il testo del post per questo canale, senza hashtag' },
            hashtags: { type: 'array', items: { type: 'string' }, description: 'Gli hashtag, con # davanti' },
          },
        },
      },
      visual: {
        type: 'object',
        additionalProperties: false,
        required: ['headline', 'slides', 'layout', 'files'],
        properties: {
          headline: { type: 'string', description: 'Il titolo dell’immagine o della prima slide; vuoto se non ha testo' },
          layout: {
            type: 'string',
            description:
              'L’impaginazione in una o due frasi, al massimo 500 caratteri: dove stanno foto, titolo, testo e logo, con quali colori. La leggono i contenuti dopo per variare.',
          },
          slides: {
            type: 'array',
            minItems: carousel ? SLIDES.min : 0,
            maxItems: carousel ? SLIDES.max : 0,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['title', 'body'],
              properties: { title: { type: 'string' }, body: { type: 'string' } },
            },
          },
          files: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['file', 'role', 'index', 'aspect'],
              properties: {
                file: {
                  type: 'string',
                  pattern: `^${contentDir(contentId)}/[A-Za-z0-9._-]+\\.(png|jpg)$`,
                  description: `Il file finale, percorso relativo alla cartella del brand (es. ${contentDir(contentId)}/cover-4x5.png)`,
                },
                role: { type: 'string', enum: ['cover', 'slide'] },
                index: { type: 'integer', minimum: 0, description: 'L’ordine: 0 per la prima copertina o la prima slide' },
                aspect: { type: 'string', enum: formatAspects(format, channels), description: 'La proporzione: solo quelle dei canali del contenuto' },
                channel: {
                  type: 'string',
                  enum: channels,
                  description: 'Solo per un file fatto apposta per un canale, nella sua confezione; senza, vale per tutti i canali con quella proporzione',
                },
              },
            },
          },
        },
      },
    },
  };
}

// Claude Code nella cartella del brand con i tool renderizza e guarda; con resume riprende la sessione di prima.
export async function runContentAgent(options: { brandDir: string; contentId: string; format: ContentFormat; channels: ChannelId[]; prompt: string; resume?: string }): Promise<void> {
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai-nuovo-2.');
    process.exit(1);
  }
  const temp = path.join(options.brandDir, contentDir(options.contentId), 'tmp');
  await mkdir(temp, { recursive: true });

  const graphics = graphicsTools(options.brandDir);
  try {
    for await (const message of query({
      prompt: options.prompt,
      options: {
        model: MODEL,
        cwd: options.brandDir,
        env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
        mcpServers: { grafica: graphics.server, immagini: photoTools(options.brandDir, GEMINI_API_KEY), vista: visionTools(options.brandDir, GEMINI_API_KEY) },
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        outputFormat: { type: 'json_schema', schema: contentSchema(options.contentId, options.format, options.channels) },
        ...(options.resume && { resume: options.resume }),
      },
    })) {
      console.log(JSON.stringify(message));
    }
  } finally {
    await graphics.close();
  }
}
