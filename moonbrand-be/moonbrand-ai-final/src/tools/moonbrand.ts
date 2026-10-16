import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { hasDocument } from '@moonbrand/shared/domain/content';

import { putBrandFiles } from '../repository/storage';
import { carouselDocument } from '../service/document';

// I tool della chat per i dati di moonbrand: contenuti, idee e piano passano dall'API, con il token del job.
// L'API decide cosa si può fare: solo il brand del job, solo mentre il job è in corso.

const channel = z.enum(['linkedin', 'instagram', 'facebook', 'tiktok', 'x', 'pinterest']);

const content = {
  slotId: z.string().optional().describe('L’id dell’uscita del piano per cui è fatto il contenuto (dal messaggio o da piano_leggi): il contenuto esce lì'),
  title: z.string().min(1).describe('Il titolo del contenuto in una frase'),
  format: z.enum(['post', 'carousel', 'article', 'video']),
  channels: z.array(channel).min(1).describe('I canali su cui esce, tra quelli del brand'),
  variants: z
    .array(z.object({ channel, text: z.string().min(1).describe('Il testo del post per questo canale, senza hashtag'), hashtags: z.array(z.string()).describe('Gli hashtag, con # davanti') }))
    .describe('Una variante di testo per ogni canale; vuoto solo per il copione di un video, i testi li scrive il montaggio'),
  headline: z.string().describe('Il titolo dell’immagine, della prima slide o del video; vuoto se non ha testo'),
  slides: z.array(z.object({ title: z.string(), body: z.string() })).describe('Titolo e testo di ogni slide del carosello, nell’ordine; vuoto negli altri formati'),
  script: z.string().optional().describe('Solo nei video: l’idea in breve, cioè tono, ritmo, musica'),
  scenes: z
    .array(
      z.object({
        seconds: z.number().positive().describe('Quanto dura, in secondi'),
        shot: z.string().describe('Cosa si vede: soggetto, tipo di inquadratura, movimento di macchina'),
        source: z.enum(['clip', 'photo', 'user', 'graphics']).describe('clip generata, foto generata, foto o clip dell’utente, solo grafica'),
        onScreen: z.string().describe('Il testo a schermo; vuoto se non c’è'),
        voice: z.string().describe('La voce fuori campo; vuota se non c’è'),
      }),
    )
    .optional()
    .describe('Solo nei video: le inquadrature del copione, nell’ordine'),
  layout: z
    .string()
    .min(1)
    .describe('L’impaginazione in una o due frasi, al massimo 500 caratteri: dove stanno foto, titolo, testo e logo, con quali colori. La leggono i contenuti dopo per variare.'),
  files: z
    .array(
      z.object({
        file: z.string().describe('Il file finale, percorso relativo alla cartella del brand, es. chat/<id>/cover-4x5.png'),
        role: z.enum(['cover', 'slide', 'video']).describe('video: l’MP4 di un video, che vuole una copertina (cover) nella stessa proporzione'),
        index: z.number().int().min(0).describe('L’ordine: 0 per la prima copertina o la prima slide'),
        aspect: z.enum(['4:5', '1:1', '9:16', '16:9', '1.91:1', '2:3']),
        channel: channel.optional().describe('Solo per un file fatto apposta per un canale, nella sua confezione. Senza, vale per tutti i canali con quella proporzione.'),
      }),
    )
    .describe(
      'Le immagini finali in PNG o JPEG e i video in MP4, nelle proporzioni dei canali: moonbrand li copia nella cartella del contenuto. ' +
        'Vuoto solo per il copione di un video, che si monta dopo con video_avvia. Un carosello ha un giro di slide per proporzione; il PDF per LinkedIn lo aggiunge moonbrand.',
    ),
};

type ContentInput = z.infer<z.ZodObject<typeof content>>;

export function moonbrandTools(apiUrl: string, token: string, brandDir: string, workDir: string) {
  const call = async (method: string, route: string, body?: unknown) => {
    try {
      const response = await fetch(`${apiUrl}/v1/agent${route}`, {
        method,
        headers: { authorization: `Job ${token}`, ...(body !== undefined && { 'content-type': 'application/json' }) },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) return { content: [{ type: 'text' as const, text: payload?.message ?? `Errore ${response.status}` }], isError: true };
      return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `moonbrand non risponde: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  };

  // Un carosello per LinkedIn esce anche come documento PDF: lo fa moonbrand dalle slide, prima di salvare. L'API copia i
  // file dallo storage: prima di salvare ci vanno quelli fatti in questo job.
  const withDocument = async (input: ContentInput) => {
    const document = hasDocument(input.format, input.channels) ? await carouselDocument(brandDir, input.files, `${workDir}/documento-linkedin-${Date.now().toString(36)}.pdf`).catch(() => null) : null;
    const ready = document ? { ...input, files: [...input.files, document] } : input;
    await putBrandFiles(brandDir, ready.files.map((item) => item.file)).catch((error: unknown) => console.error('file del contenuto non caricati', error));
    return ready;
  };

  const day = z.string().describe('Il giorno, AAAA-MM-GG, ora di Roma');
  const time = z.string().describe('L’ora, HH:mm, ora di Roma: una per tutti i canali dell’uscita');
  const slotFields = {
    channels: z.array(channel).min(1).optional().describe('I canali; con un contenuto sono i suoi, con un’idea di solito il canale del giorno'),
    themeId: z.string().nullable().optional().describe('L’id del tema che l’uscita deve coprire'),
    ideaId: z.string().nullable().optional().describe('L’idea tenuta da cui partirà il contenuto'),
  };
  const id = z.string().describe('L’id del contenuto');

  const tools = [
    tool('contenuti_elenca', 'Elenca i contenuti del brand nella sezione Contenuti: titolo, formato, canali, stato, impaginazione, file, l’uscita nel piano e com’è andata canale per canale.', {}, () => call('GET', '/contents'), { alwaysLoad: true }),
    tool(
      'contenuto_leggi',
      'Legge un contenuto salvato: i testi per canale, le slide, il copione dei video, i file, l’uscita nel piano e com’è andata canale per canale (publications: published con il link, publishing, failed con il motivo in problem e, se moonbrand riprova da solo, quando in retryAt).',
      { id },
      ({ id }) => call('GET', `/contents/${encodeURIComponent(id)}`),
      { alwaysLoad: true },
    ),
    tool(
      'contenuto_approva',
      'Approva un contenuto salvato, solo quando l’utente lo chiede. Da approvato esce da solo all’ora della sua uscita nel piano, sui canali collegati: se non è nel piano, mettilo con uscite_crea. Se l’ora è già passata, approvandolo esce subito: dillo prima, o sposta l’uscita.',
      { id },
      ({ id }) => call('POST', `/contents/${encodeURIComponent(id)}/approve`),
      { alwaysLoad: true },
    ),
    tool('contenuto_riapri', 'Rimette in bozza un contenuto approvato che non è ancora uscito. Un contenuto già uscito su un canale non si riapre.', { id }, ({ id }) => call('POST', `/contents/${encodeURIComponent(id)}/reopen`), { alwaysLoad: true }),
    tool(
      'contenuto_salva',
      'Salva un contenuto nuovo nella sezione Contenuti, come bozza: post, carosello, articolo o video. Da usare appena il contenuto è pronto: testi per ogni canale e immagini finali controllate. ' +
        'Un video si salva come copione: format «video», script e scenes, variants e files vuoti; poi video_avvia lo monta. Un video già montato ha l’MP4 con role «video» e la copertina con role «cover», nella stessa proporzione.',
      content,
      async (input) => call('POST', '/contents', await withDocument(input)),
      { alwaysLoad: true },
    ),
    tool('contenuto_aggiorna', 'Riscrive un contenuto già salvato, che torna bozza. Va passato il contenuto completo, anche le parti che non cambiano.', { id, ...content }, async ({ id, ...input }) => call('PUT', `/contents/${encodeURIComponent(id)}`, await withDocument(input)), {
      alwaysLoad: true,
    }),
    tool(
      'video_avvia',
      'Avvia il montaggio di un video salvato come copione con contenuto_salva (format «video», script e scenes). Il video si monta a parte, fuori dalla chat, e compare nella sezione Contenuti quando è pronto, con i testi per canale. Da chiamare dopo l’ok dell’utente al copione.',
      { contentId: z.string().describe('L’id del contenuto salvato con contenuto_salva') },
      ({ contentId }) => call('POST', `/contents/${encodeURIComponent(contentId)}/video`),
      { alwaysLoad: true },
    ),
    tool(
      'pubblicazione_proponi',
      'Quando l’utente chiede di pubblicare adesso un contenuto salvato, o di riprovare subito dove non è uscito: sotto la tua risposta compare la card del contenuto con il pulsante «Pubblica ora». Tu non pubblichi: esce quando lo preme, solo dove non è ancora uscito.',
      { id },
      ({ id }) => call('POST', `/contents/${encodeURIComponent(id)}/publish-request`),
      { alwaysLoad: true },
    ),
    tool(
      'piano_leggi',
      'Legge il piano: le uscite di un periodo (di default le prossime 4 settimane), con giorno, ora, canali, stato (empty, toPrepare, toApprove, scheduled, published), tema, idea e contenuto, e com’è andata canale per canale.',
      { from: day.optional(), to: day.optional() },
      ({ from, to }) => call('GET', `/plan?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) })}`),
      { alwaysLoad: true },
    ),
    tool(
      'piano_proponi',
      'Propone le uscite delle prossime settimane con le regole di moonbrand: i giorni del ritmo del brand, il canale e l’ora migliori, i temi secondo il loro peso e le idee tenute. Non salva niente: ritocca la proposta e poi crea le uscite con uscite_crea.',
      {
        startDate: day.optional().describe('Da quando; di default domani'),
        weeks: z.number().int().min(1).max(12).describe('Per quante settimane'),
        perWeek: z.number().int().min(1).max(7).optional().describe('Quante uscite a settimana; di default il ritmo del brand'),
        channels: z.array(channel).min(1).optional().describe('Su quali canali; di default quelli del brand'),
      },
      (input) => call('POST', '/plan/proposal', input),
      { alwaysLoad: true },
    ),
    tool(
      'uscite_crea',
      'Mette nel piano una o più uscite, tutte o nessuna: vuote con il tema da coprire, con un’idea tenuta, o con un contenuto già salvato (contentId). Giorno e ora da adesso in poi.',
      { uscite: z.array(z.object({ date: day, time, ...slotFields, contentId: z.string().nullable().optional().describe('Un contenuto salvato da mettere in questa uscita') })).min(1).max(60) },
      (input) => call('POST', '/slots', input),
      { alwaysLoad: true },
    ),
    tool(
      'uscita_cambia',
      'Sposta un’uscita (giorno, ora) o ne cambia canali, tema o idea. Se il contenuto non era uscito su qualche canale, all’ora nuova riprova solo lì.',
      { id: z.string().describe('L’id dell’uscita'), date: day.optional(), time: time.optional(), ...slotFields },
      ({ id, ...input }) => call('PATCH', `/slots/${encodeURIComponent(id)}`, input),
      { alwaysLoad: true },
    ),
    tool('uscita_togli', 'Toglie un’uscita dal piano. Il suo contenuto, se c’è, resta tra i Contenuti, senza data.', { id: z.string().describe('L’id dell’uscita') }, ({ id }) => call('DELETE', `/slots/${encodeURIComponent(id)}`), { alwaysLoad: true }),
    tool('idee_elenca', 'Elenca le idee del brand nella sezione Idee, con il loro stato: new (da decidere), saved (tenuta), discarded (scartata).', {}, () => call('GET', '/ideas'), { alwaysLoad: true }),
    tool(
      'idea_salva',
      'Aggiunge un’idea nella sezione Idee, tra quelle da decidere. Solo per le idee che l’utente vuole tenere.',
      {
        title: z.string().min(1).describe('L’idea in una frase specifica, massimo 110 caratteri'),
        angleLabel: z.string().describe('Il taglio in 2-4 parole, es. «Il dietro le quinte»'),
        angle: z.string().describe('Cosa raccontare e con quali elementi, in due o tre frasi'),
        rationale: z.string().describe('Perché ha senso adesso, in una frase'),
        themeId: z.string().nullable().describe('L’id del tema del brand che tocca, null se nessuno'),
      },
      (input) => call('POST', '/ideas', input),
      { alwaysLoad: true },
    ),
  ];

  return createSdkMcpServer({ name: 'moonbrand', tools });
}
