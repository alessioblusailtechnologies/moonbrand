import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import type { AgentContentRequest } from '@moonbrand/shared/api/contract';
import { FORMAT_ASPECT, hasDocument } from '@moonbrand/shared/domain/content';

import { putBrandFiles } from '../../lib/brand-sync';
import { carouselDocument } from '../../lib/document';

// I tool di moonbrand nella chat: contenuti, piano e idee, con le stesse rotte dell'API che usa moonbrand-ai. Il token
// del job resta qui, Claude non lo vede; l'API agisce solo sul brand del job e solo mentre il job è in corso.

const channel = z.enum(['linkedin', 'instagram', 'facebook', 'tiktok', 'x', 'pinterest']);

// Le proporzioni che ogni canale prende, per formato: un file per ognuna di quelle dei canali del contenuto.
const ASPECTS = `Ogni canale esce con i file della sua proporzione, quindi serve un file per ognuna di quelle dei canali del contenuto. ${(['post', 'carousel', 'video'] as const)
  .map(
    (format) =>
      `${format}: ${Object.entries(FORMAT_ASPECT[format])
        .filter(([, aspect]) => aspect)
        .map(([name, aspect]) => `${name} ${aspect}`)
        .join(', ')}`,
  )
  .join('; ')}.`;

const content = {
  slotId: z.string().optional().describe('L’id dell’uscita del piano, se il contenuto è per quella'),
  titolo: z.string().min(1),
  formato: z.enum(['post', 'carousel', 'video']),
  canali: z.array(channel).min(1),
  testi: z.array(z.object({ canale: channel, testo: z.string().min(1), hashtag: z.array(z.string()) })).min(1).describe('Il testo del post per ogni canale'),
  file: z
    .array(
      z.object({
        file: z.string().describe('Relativo alla cartella del brand, es. contenuti/post.png'),
        proporzione: z.enum(['4:5', '1:1', '9:16', '16:9', '1.91:1', '2:3']).describe(ASPECTS),
        canale: channel
          .optional()
          .describe('Solo per un file fatto apposta per un canale, per esempio il video TikTok accanto al Reel. Senza, vale per tutti i canali con quella proporzione che non hanno il loro'),
      }),
    )
    .min(1)
    .describe('Le immagini (PNG o JPEG) e i video (MP4) finali, nell’ordine; un video vuole anche la sua copertina'),
};

type ContentInput = z.infer<z.ZodObject<typeof content>>;

// Ruolo e ordine dei file li deduce il codice.
function request({ slotId, titolo, formato, canali, testi, file }: ContentInput): AgentContentRequest {
  const counters = new Map<string, number>();
  return {
    ...(slotId && { slotId }),
    title: titolo,
    format: formato,
    channels: canali,
    variants: testi.map(({ canale, testo, hashtag }) => ({ channel: canale, text: testo, hashtags: hashtag })),
    headline: '',
    slides: [],
    files: file.map(({ file, proporzione, canale }) => {
      const role = file.toLowerCase().endsWith('.mp4') ? 'video' : formato === 'carousel' ? 'slide' : 'cover';
      // L'ordine si conta per ruolo, proporzione e canale: il giro di slide di TikTok riparte da 0 accanto a quello comune.
      const key = `${role}:${proporzione}:${canale ?? ''}`;
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      return { file, role, index, aspect: proporzione, ...(canale && { channel: canale }) };
    }),
  };
}

const day = z.string().describe('Il giorno, AAAA-MM-GG, ora di Roma');
const time = z.string().describe('L’ora, HH:mm, ora di Roma');
const slotFields = {
  channels: z.array(channel).min(1).optional(),
  themeId: z.string().nullable().optional().describe('L’id del tema che l’uscita copre'),
  ideaId: z.string().nullable().optional().describe('L’id dell’idea da cui partirà il contenuto'),
};
const id = { id: z.string() };

export function moonbrandTools(apiUrl: string, token: string, brandDir: string) {
  const call = async (method: string, route: string, body?: unknown) => {
    try {
      const response = await fetch(`${apiUrl}/v1/agent${route}`, {
        method,
        headers: { authorization: `Job ${token}`, ...(body !== undefined && { 'content-type': 'application/json' }) },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) return { content: [{ type: 'text' as const, text: payload?.message ?? `Errore ${response.status}` }], isError: true };
      return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `moonbrand non risponde: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  };

  // Un carosello per LinkedIn esce anche come documento PDF: lo fa il codice dalle slide, prima di salvare. Se le slide
  // non si leggono si salva senza, e la pubblicazione su LinkedIn dirà che manca.
  // L'API copia i file dallo storage: prima ci vanno quelli fatti in questo turno.
  const save = async (route: string, method: string, input: ContentInput) => {
    const body = request(input);
    if (hasDocument(input.formato, input.canali)) {
      const target = `contenuti/carosello-linkedin-${Date.now().toString(36)}.pdf`;
      // Il PDF si fa con le slide di LinkedIn, o con quelle comuni: mai con quelle fatte per un altro canale.
      const own = input.file.filter((item) => item.canale === 'linkedin');
      const slides = own.length > 0 ? own : input.file.filter((item) => !item.canale);
      const document = await carouselDocument(brandDir, slides, target).catch((error: unknown) => {
        console.error('PDF del carosello non fatto', error);
        return null;
      });
      if (document) body.files.push({ file: document, role: 'document', index: 0, aspect: FORMAT_ASPECT.carousel.linkedin! });
    }
    await putBrandFiles(
      brandDir,
      body.files.map((item) => item.file),
    ).catch((error: unknown) => console.error('file del contenuto non caricati', error));
    return call(method, route, body);
  };

  const options = { alwaysLoad: true };

  return [
      tool(
        'salva_contenuto',
        'Salva un contenuto finito in Contenuti, come bozza: l’utente lo vede lì, lo approva e lo programma. Per cambiarlo dopo, passa il suo id.',
        { id: z.string().optional().describe('L’id di un contenuto già salvato, per riscriverlo; senza, ne crea uno nuovo'), ...content },
        ({ id: contentId, ...input }) =>
          contentId ? save(`/contents/${encodeURIComponent(contentId)}`, 'PUT', input) : save('/contents', 'POST', input),
        options,
      ),
      tool('contenuti_elenca', 'Elenca i contenuti del brand, con stato, uscita nel piano e com’è andata sui canali.', {}, () => call('GET', '/contents'), options),
      tool('contenuto_leggi', 'Legge un contenuto: testi, file, uscita nel piano e com’è andata sui canali.', id, ({ id: contentId }) => call('GET', `/contents/${encodeURIComponent(contentId)}`), options),
      tool(
        'contenuto_approva',
        'Approva un contenuto, solo quando l’utente lo chiede. Approvato, esce da solo all’ora della sua uscita nel piano; se quell’ora è già passata esce subito, quindi dillo prima.',
        id,
        ({ id: contentId }) => call('POST', `/contents/${encodeURIComponent(contentId)}/approve`),
        options,
      ),
      tool('contenuto_riapri', 'Rimette in bozza un contenuto approvato che non è ancora uscito.', id, ({ id: contentId }) => call('POST', `/contents/${encodeURIComponent(contentId)}/reopen`), options),
      tool(
        'pubblicazione_proponi',
        'Quando l’utente vuole pubblicare adesso: sotto la tua risposta compare il pulsante «Pubblica ora». Tu non pubblichi, esce quando lo preme l’utente.',
        id,
        ({ id: contentId }) => call('POST', `/contents/${encodeURIComponent(contentId)}/publish-request`),
        options,
      ),
      tool(
        'piano_leggi',
        'Legge le uscite del piano di un periodo (di default le prossime 4 settimane), con stato, tema, idea e contenuto.',
        { from: day.optional(), to: day.optional() },
        ({ from, to }) => call('GET', `/plan?${new URLSearchParams({ ...(from && { from }), ...(to && { to }) })}`),
        options,
      ),
      tool(
        'piano_proponi',
        'Propone le uscite delle prossime settimane con ritmo, canali, orari e temi del brand. Non salva: le uscite si creano con uscite_crea.',
        {
          startDate: day.optional().describe('Di default domani'),
          weeks: z.number().int().min(1).max(12),
          perWeek: z.number().int().min(1).max(7).optional(),
          channels: z.array(channel).min(1).optional(),
        },
        (input) => call('POST', '/plan/proposal', input),
        options,
      ),
      tool(
        'uscite_crea',
        'Mette nel piano una o più uscite: vuote con un tema, con un’idea o con un contenuto salvato.',
        { uscite: z.array(z.object({ date: day, time, ...slotFields, contentId: z.string().nullable().optional() })).min(1).max(60) },
        (input) => call('POST', '/slots', input),
        options,
      ),
      tool(
        'uscita_cambia',
        'Sposta un’uscita o ne cambia canali, tema o idea.',
        { ...id, date: day.optional(), time: time.optional(), ...slotFields },
        ({ id: slotId, ...input }) => call('PATCH', `/slots/${encodeURIComponent(slotId)}`, input),
        options,
      ),
      tool('uscita_togli', 'Toglie un’uscita dal piano; il contenuto resta tra i Contenuti.', id, ({ id: slotId }) => call('DELETE', `/slots/${encodeURIComponent(slotId)}`), options),
      tool('idee_elenca', 'Elenca le idee del brand: new, saved (tenute), discarded.', {}, () => call('GET', '/ideas'), options),
      tool(
        'idea_salva',
        'Aggiunge un’idea in Idee, solo se l’utente la vuole tenere.',
        {
          title: z.string().min(1).describe('In una frase, massimo 110 caratteri'),
          angleLabel: z.string().describe('Il taglio in 2-4 parole'),
          angle: z.string().describe('Cosa raccontare, in due o tre frasi'),
          rationale: z.string().describe('Perché ha senso adesso, in una frase'),
          themeId: z.string().nullable(),
        },
        (input) => call('POST', '/ideas', input),
        options,
      ),
  ];
}
