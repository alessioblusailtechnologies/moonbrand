import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { FORMAT_ASPECT, formatAspects, hasDocument, type ContentFormat } from '@moonbrand/shared/domain/content';

import { designTools } from '../tools/disegna';
import { visionTools } from '../tools/vista';

// Le regole per scrivere e disegnare un contenuto stanno qui, nel prompt: niente skill. Un contenuto ha un testo per
// canale e le sue immagini, disegnate dal motore grafico (tool disegna) e controllate dal motore di visione (guarda).

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
- Le immagini le fa il motore grafico con il tool disegna, una chiamata per immagine: tu sei il direttore creativo, scrivi il brief da grafico e lui impagina. Non fare HTML, CSS o script per le grafiche.
- Il brief dice tutto, perché il motore non vede altro: i testi esatti che devono comparire e che non deve comparire altro testo; la palette con gli esadecimali e il ruolo di ogni colore; i font del brand (o famiglie simili); la foto da fare (soggetto vero del brand, inquadratura, luce, trattamento); i segni grafici ricorrenti dello stile; dove va il logo, piccolo e com’è; la composizione che vuoi (dove stanno titolo, foto, testo); la lingua dei testi. Per ogni immagine una composizione pensata per la sua idea, diversa dalle impaginazioni recenti in CLAUDE.md.
- I riferimenti, nell’ordine: prima il logo del brand (logo.png), poi uno o due riferimenti di stile del brand (riferimenti-da-seguire/, file-riferimento/, o una grafica recente in contenuti/), così lo stile resta quello; nel brief di’ che il riferimento 1 è il logo da mettere com’è e che gli altri mostrano il linguaggio grafico da seguire senza copiarli. Per le slide dopo la prima passa anche la slide precedente: stesso sistema, composizione diversa.
- La confezione per canale: Instagram e Facebook editoriali, con la grafica del brand, e di solito condividono i file; LinkedIn sobrio e leggibile, poca decorazione, logo discreto; X un messaggio solo leggibile anche piccolo; Pinterest un pin verticale con una foto luminosa che occupa quasi tutto, un titolo grande che dice cosa si trova e il logo piccolo in basso; TikTok nativo, come lo fa chi usa l’app: una foto o un fotogramma vero a tutto schermo con una frase scritta come la scrive l’app, niente grafica montata né logo. Se l’utente vuole la stessa confezione ovunque, fai come chiede.
- Ogni immagine, appena fatta, la controlli con guarda: i testi sono esattamente quelli del brief e scritti giusto, non c’è altro testo, il logo è intero e fedele, niente tagliato ai bordi, colori del brand, leggibilità. Se c’è un problema, correggi il brief (più esplicito sul punto sbagliato) e disegna di nuovo, al massimo due volte per immagine; se resta un difetto piccolo, tienila e dillo nel risultato. Nessuna immagine si consegna senza il controllo.
- Più immagini e più controlli che non dipendono l’uno dall’altro chiedili nello stesso messaggio: girano insieme.
- Le foto e i video che l’utente ha mandato (allegati/, file-riferimento/) si possono passare come riferimento al motore grafico perché li usi come soggetto: dillo nel brief. Non usare materiali di altri brand.
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

// Claude Code nella cartella del brand con i tool disegna e guarda; con resume riprende la sessione di prima.
export async function runContentAgent(options: { brandDir: string; contentId: string; format: ContentFormat; channels: ChannelId[]; prompt: string; resume?: string }): Promise<void> {
  const { GEMINI_API_KEY, ...env } = process.env;
  if (!GEMINI_API_KEY) {
    console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai-nuovo.');
    process.exit(1);
  }
  const temp = path.join(options.brandDir, contentDir(options.contentId), 'tmp');
  await mkdir(temp, { recursive: true });

  for await (const message of query({
    prompt: options.prompt,
    options: {
      cwd: options.brandDir,
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers: { grafica: designTools(options.brandDir, GEMINI_API_KEY), vista: visionTools(options.brandDir, GEMINI_API_KEY) },
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: 'json_schema', schema: contentSchema(options.contentId, options.format, options.channels) },
      ...(options.resume && { resume: options.resume }),
    },
  })) {
    console.log(JSON.stringify(message));
  }
}
