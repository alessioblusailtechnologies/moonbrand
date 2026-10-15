import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';

import { GEMINI_DESIGN_2K, geminiCost } from '../lib/prices';
import { measure } from '../lib/usage';
import { PARALLEL } from './parallel';

// Il post lo disegna un modello di immagini, non l'HTML: Claude scrive il brief da grafico (testi esatti, palette, font,
// foto, segni del brand) e passa il logo e i riferimenti; il modello impagina tutto, testi compresi. Prova del 14/10/2026
// in prove/immagini: testi e logo giusti in 24 immagini su 24, composizioni diverse a ogni chiamata.
export const DESIGN_MODEL = process.env.GEMINI_DESIGN_MODEL || 'gemini-3-pro-image';
// Le slide che seguono una slide già fatta le disegna il modello «workhorse» di Google, a un quarto del prezzo: nella
// prova del 14/10 (prove/immagini/uscite/messina-slide2) le sue slide 2 reggono il confronto con il Pro.
export const FOLLOW_MODEL = process.env.GEMINI_FOLLOW_MODEL || 'gemini-nano-banana-2.1';

const MIME_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9'] as const;
// Un'immagine arriva in 25-30 secondi; nella prova del 14/10 una chiamata è rimasta appesa 465 secondi: oltre questo si
// riprova invece di aspettare.
const TIMEOUT_MS = 150_000;

// La chiave resta in questo processo: Claude vede solo il tool, non la chiamata al modello.
export function designTools(folder: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

  const design = tool(
    'disegna',
    'Fa disegnare al motore grafico un’immagine finita di un post: impaginazione, testi, foto, grafica e logo insieme, come la farebbe un grafico. ' +
      'Il brief è tutto quello che il motore sa: scrivi i testi esatti che devono comparire (e che non deve comparire altro), la palette con gli esadecimali, ' +
      'i font (o famiglie simili), la foto da fare (soggetto, luce, trattamento), i segni grafici del brand, dove va il logo e che composizione vuoi. ' +
      'I riferimenti si vedono nell’ordine in cui li passi: il primo è il logo da mettere com’è, poi i riferimenti di stile del brand, poi una slide già fatta ' +
      'se vuoi che la nuova le somigli. Salva un PNG nella cartella del brand. Più immagini che non dipendono l’una dall’altra chiedile nello stesso messaggio: girano insieme.',
    {
      brief: z.string().min(80).describe('Il brief da grafico, completo: testi esatti, palette, font, foto, segni, logo, composizione, lingua'),
      riferimenti: z
        .array(z.string())
        .max(6)
        .describe('Immagini della cartella del brand, nell’ordine: il logo (logo.png), poi i riferimenti di stile, poi una slide già fatta'),
      formato: z.enum(ASPECTS).describe('Le proporzioni dell’immagine, quelle del canale'),
      qualita: z
        .enum(['pro', 'veloce'])
        .optional()
        .describe(
          'pro (default) per i post, le copertine e la prima slide di un carosello; veloce per le slide dopo la prima, che ricevono la slide già fatta come riferimento: costa un quarto',
        ),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.png$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. contenuti/<id>/cover-4x5.png'),
    },
    async ({ brief, riferimenti, formato, qualita = 'pro', file }) => {
      const model = qualita === 'veloce' ? FOLLOW_MODEL : DESIGN_MODEL;
      try {
        const parts: Part[] = [{ text: brief }];
        for (const [index, reference] of riferimenti.entries()) {
          const mimeType = MIME_TYPES[path.extname(reference).toLowerCase()];
          if (!mimeType) return failure(`Formato non supportato per il riferimento ${reference}: usa PNG, JPEG o WebP.`);
          parts.push({ text: `Riferimento ${index + 1}: ${path.basename(reference)}` }, { inlineData: { mimeType, data: (await readFile(inside(reference))).toString('base64') } });
        }
        const response = await measure(
          {
            task: 'design',
            model,
            extra: ({ usageMetadata }) => ({
              units: 1,
              unit: 'immagini',
              inputTokens: usageMetadata?.promptTokenCount,
              outputTokens: usageMetadata?.candidatesTokenCount,
              // Il Pro ha un prezzo fisso per immagine; il modello veloce si paga a token in uscita.
              costUsd:
                qualita === 'veloce'
                  ? (geminiCost(model, usageMetadata?.promptTokenCount, usageMetadata?.candidatesTokenCount) ?? 0)
                  : (geminiCost(model, usageMetadata?.promptTokenCount) ?? 0) + GEMINI_DESIGN_2K,
            }),
          },
          () =>
            ai.models.generateContent({
              model,
              contents: [{ role: 'user', parts }],
              config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: formato, imageSize: '2K' }, httpOptions: { timeout: TIMEOUT_MS } },
            }),
        );
        const image = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
        if (!image?.data) return failure('Il motore grafico non ha restituito un’immagine: riprova, magari con un brief più preciso.');
        const saved = file.replace(/\.png$/, EXTENSIONS[image.mimeType ?? 'image/png'] ?? '.png');
        const target = inside(saved);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(image.data, 'base64'));
        return { content: [{ type: 'text' as const, text: `Immagine salvata in ${saved}` }] };
      } catch (error) {
        return failure(`Disegno non riuscito: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'grafica', tools: [design] });
}
