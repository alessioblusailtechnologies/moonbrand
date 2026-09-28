import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const channel = z.enum(['linkedin', 'instagram', 'facebook', 'tiktok', 'x']);

const content = {
  title: z.string().min(1).describe('Il titolo del contenuto in una frase'),
  format: z.enum(['post', 'carousel', 'article']),
  channels: z.array(channel).min(1).describe('I canali su cui esce, tra quelli del brand'),
  variants: z
    .array(
      z.object({
        channel,
        text: z.string().min(1).describe('Il testo del post per questo canale, senza hashtag'),
        hashtags: z.array(z.string()).describe('Gli hashtag, con # davanti'),
      }),
    )
    .describe('Una variante di testo per ogni canale'),
  headline: z.string().describe('Il titolo dell’immagine o della prima slide; vuoto se l’immagine non ha testo'),
  slides: z
    .array(z.object({ title: z.string(), body: z.string() }))
    .describe('Titolo e testo di ogni slide del carosello, nell’ordine; vuoto negli altri formati'),
  files: z
    .array(
      z.object({
        file: z.string().describe('L’immagine finale, percorso relativo alla cartella del brand, es. chat/<id>/cover-4x5.png'),
        role: z.enum(['cover', 'slide']),
        index: z.number().int().min(0).describe('L’ordine: 0 per la prima copertina o la prima slide'),
        aspect: z.enum(['4:5', '1:1', '9:16', '16:9', '1.91:1']),
      }),
    )
    .min(1)
    .describe('Le immagini finali, PNG o JPEG: moonbrand le copia nella cartella del contenuto'),
};

// I tool della chat per i dati di moonbrand: contenuti e idee passano dall'API, con il token del job.
// L'API decide cosa si può fare: solo il brand del job, solo mentre il job è in corso.
export function moonbrandTools(apiUrl: string, token: string) {
  const call = async (method: string, route: string, body?: unknown) => {
    try {
      const response = await fetch(`${apiUrl}/v1/agent${route}`, {
        method,
        headers: { authorization: `Job ${token}`, ...(body !== undefined && { 'content-type': 'application/json' }) },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        return { content: [{ type: 'text' as const, text: payload?.message ?? `Errore ${response.status}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `moonbrand non risponde: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  };

  const tools = [
    tool(
      'contenuti_elenca',
      'Elenca i contenuti del brand nella sezione Contenuti: titolo, formato, canali, stato (draft o approved) e immagini.',
      {},
      () => call('GET', '/contents'),
      { alwaysLoad: true },
    ),
    tool(
      'contenuto_leggi',
      'Legge un contenuto salvato: i testi per canale, le slide e i percorsi delle immagini nella cartella del brand.',
      { id: z.string().describe('L’id del contenuto') },
      ({ id }) => call('GET', `/contents/${encodeURIComponent(id)}`),
      { alwaysLoad: true },
    ),
    tool(
      'contenuto_salva',
      'Salva un contenuto nuovo nella sezione Contenuti, come bozza. Da usare appena il contenuto è pronto: testi per ogni canale e immagini finali controllate.',
      content,
      (input) => call('POST', '/contents', input),
      { alwaysLoad: true },
    ),
    tool(
      'contenuto_aggiorna',
      'Riscrive un contenuto già salvato, che torna bozza. Va passato il contenuto completo, anche le parti che non cambiano.',
      { id: z.string().describe('L’id del contenuto'), ...content },
      ({ id, ...input }) => call('PUT', `/contents/${encodeURIComponent(id)}`, input),
      { alwaysLoad: true },
    ),
    tool(
      'idee_elenca',
      'Elenca le idee del brand nella sezione Idee, con il loro stato: new (da decidere), saved (tenuta), discarded (scartata).',
      {},
      () => call('GET', '/ideas'),
      { alwaysLoad: true },
    ),
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
