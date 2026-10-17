import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import type { AgentContentRequest } from '@moonbrand/shared/api/contract';

import { putBrandFiles } from '../../lib/brand-sync';

// L'unico tool di moonbrand nella chat: salva un contenuto in Contenuti, come bozza, con la stessa rotta dell'API che usa
// moonbrand-ai. Il token del job resta qui, Claude non lo vede. Ruolo e ordine dei file li deduce il codice.

const channel = z.enum(['linkedin', 'instagram', 'facebook', 'tiktok', 'x', 'pinterest']);

const input = {
  id: z.string().optional().describe('L’id di un contenuto già salvato, per riscriverlo; senza, ne crea uno nuovo'),
  slotId: z.string().optional().describe('L’id dell’uscita del piano, se il contenuto è per quella'),
  titolo: z.string().min(1),
  formato: z.enum(['post', 'carousel', 'video']),
  canali: z.array(channel).min(1),
  testi: z.array(z.object({ canale: channel, testo: z.string().min(1), hashtag: z.array(z.string()) })).min(1).describe('Il testo del post per ogni canale'),
  file: z
    .array(z.object({ file: z.string().describe('Relativo alla cartella del brand, es. contenuti/post.png'), proporzione: z.enum(['4:5', '1:1', '9:16', '16:9', '1.91:1', '2:3']) }))
    .min(1)
    .describe('Le immagini (PNG o JPEG) e i video (MP4) finali, nell’ordine; un video vuole anche la sua copertina'),
};

type Input = z.infer<z.ZodObject<typeof input>>;

function request({ slotId, titolo, formato, canali, testi, file }: Input): AgentContentRequest {
  const counters = new Map<string, number>();
  return {
    ...(slotId && { slotId }),
    title: titolo,
    format: formato,
    channels: canali,
    variants: testi.map(({ canale, testo, hashtag }) => ({ channel: canale, text: testo, hashtags: hashtag })),
    headline: '',
    slides: [],
    files: file.map(({ file, proporzione }) => {
      const role = file.toLowerCase().endsWith('.mp4') ? 'video' : formato === 'carousel' ? 'slide' : 'cover';
      const key = `${role}:${proporzione}`;
      const index = counters.get(key) ?? 0;
      counters.set(key, index + 1);
      return { file, role, index, aspect: proporzione };
    }),
  };
}

export function salvaServer(apiUrl: string, token: string, brandDir: string) {
  return createSdkMcpServer({
    name: 'moonbrand',
    tools: [
      tool(
        'salva_contenuto',
        'Salva un contenuto finito in Contenuti, come bozza: l’utente lo vede lì, lo approva e lo programma. Per cambiarlo dopo, passa il suo id.',
        input,
        async (args) => {
          // L'API copia i file dallo storage: prima ci vanno quelli fatti in questo turno.
          await putBrandFiles(
            brandDir,
            args.file.map((item) => item.file),
          ).catch((error: unknown) => console.error('file del contenuto non caricati', error));
          const route = args.id ? `/contents/${encodeURIComponent(args.id)}` : '/contents';
          try {
            const response = await fetch(`${apiUrl}/v1/agent${route}`, {
              method: args.id ? 'PUT' : 'POST',
              headers: { authorization: `Job ${token}`, 'content-type': 'application/json' },
              body: JSON.stringify(request(args)),
            });
            const payload = (await response.json().catch(() => null)) as { message?: string } | null;
            if (!response.ok) return { content: [{ type: 'text' as const, text: payload?.message ?? `Errore ${response.status}` }], isError: true };
            return { content: [{ type: 'text' as const, text: JSON.stringify(payload) }] };
          } catch (error) {
            return { content: [{ type: 'text' as const, text: `moonbrand non risponde: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
          }
        },
      ),
    ],
  });
}
