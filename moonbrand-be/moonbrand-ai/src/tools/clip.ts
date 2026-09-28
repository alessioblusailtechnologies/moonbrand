import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { GoogleGenAI, VideoGenerationReferenceType, type Image } from '@google/genai';
import { z } from 'zod';

const MODELS = { alta: 'veo-3.1-generate-preview', veloce: 'veo-3.1-fast-generate-preview' } as const;
const POLL_MS = 10_000;

const MIME_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

// La chiave resta in questo processo: Claude vede solo il tool, non la chiamata a Veo.
export function clipTools(folder: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const image = async (relative: string): Promise<Image> => {
    const mimeType = MIME_TYPES[path.extname(relative).toLowerCase()];
    if (!mimeType) throw new Error(`Formato non supportato per ${relative}: usa PNG, JPEG o WebP.`);
    return { imageBytes: (await readFile(inside(relative))).toString('base64'), mimeType };
  };
  const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

  const generate = tool(
    'genera_clip',
    'Genera una clip video vera con Veo 3.1 e la salva in MP4 nella cartella del brand. Ci vogliono alcuni minuti. ' +
      'Descrivi soggetto, azione, movimento di macchina, luce e stile; la clip ha anche un audio suo, che nel video puoi togliere. ' +
      'Puoi farla partire da un’immagine della cartella (prima_immagine), chiuderla su un’altra (ultima_immagine) ' +
      'o darle fino a 3 immagini di riferimento per soggetti e oggetti da mantenere (riferimenti: solo con 8 secondi). ' +
      'Le clip da 8 secondi escono in 1080p, quelle più corte in 720p.',
    {
      descrizione: z.string().min(10).describe('Cosa succede nella clip: soggetto, azione, inquadratura e movimento di macchina, luce, stile'),
      formato: z.enum(['9:16', '16:9']).describe('Proporzioni: 9:16 verticale o 16:9 orizzontale'),
      secondi: z.union([z.literal(4), z.literal(6), z.literal(8)]).describe('Durata: 4, 6 o 8 secondi'),
      prima_immagine: z.string().optional().describe('Immagine della cartella del brand da cui parte la clip, es. video/public/contenuti/<id>/foto.jpg'),
      ultima_immagine: z.string().optional().describe('Immagine su cui la clip si chiude (serve anche prima_immagine)'),
      riferimenti: z.array(z.string()).max(3).optional().describe('Immagini di soggetti o oggetti da mantenere nella clip'),
      evitare: z.string().optional().describe('Cosa non deve comparire, es. testo sovrimpresso, loghi, persone'),
      qualita: z.enum(['alta', 'veloce']).optional().describe('alta (di base) o veloce, più rapida e meno costosa'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.mp4$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. video/public/contenuti/<id>/clip-1.mp4'),
    },
    async ({ descrizione, formato, secondi, prima_immagine, ultima_immagine, riferimenti = [], evitare, qualita = 'alta', file }) => {
      try {
        let operation = await ai.models.generateVideos({
          model: MODELS[qualita],
          source: { prompt: descrizione, ...(prima_immagine && { image: await image(prima_immagine) }) },
          config: {
            aspectRatio: formato,
            durationSeconds: secondi,
            resolution: secondi === 8 ? '1080p' : '720p',
            ...(evitare && { negativePrompt: evitare }),
            ...(ultima_immagine && { lastFrame: await image(ultima_immagine) }),
            ...(riferimenti.length > 0 && {
              referenceImages: await Promise.all(
                riferimenti.map(async (reference) => ({ image: await image(reference), referenceType: VideoGenerationReferenceType.ASSET })),
              ),
            }),
          },
        });
        while (!operation.done) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          operation = await ai.operations.getVideosOperation({ operation });
        }
        if (operation.error) return failure(`Veo non ha generato la clip: ${JSON.stringify(operation.error)}`);
        const video = operation.response?.generatedVideos?.[0]?.video;
        if (!video) {
          const reasons = operation.response?.raiMediaFilteredReasons?.join(' ') ?? '';
          return failure(`Veo non ha restituito una clip. ${reasons || 'Prova a riformulare la descrizione.'}`);
        }
        const target = inside(file);
        await mkdir(path.dirname(target), { recursive: true });
        await ai.files.download({ file: video, downloadPath: target });
        return { content: [{ type: 'text' as const, text: `Clip salvata in ${file}` }] };
      } catch (error) {
        return failure(`Generazione non riuscita: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'clip', tools: [generate] });
}
