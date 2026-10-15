import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';

import { GEMINI_DESIGN_2K, geminiCost } from '../lib/prices';
import { measure } from '../lib/usage';
import { PARALLEL } from './parallel';

// Le foto che servono dentro una grafica le fa un modello di immagini: Claude descrive il soggetto, la foto arriva come
// file e lui la mette nell'HTML con <img>. Niente testo né logo dentro la foto: quelli li impagina Claude.
// Di base il modello «workhorse» di Google; qualità pro per Nano Banana Pro quando la foto è il centro del post.
export const PHOTO_MODEL = process.env.GEMINI_PHOTO_MODEL || 'gemini-nano-banana-2.1';
export const PHOTO_PRO_MODEL = process.env.GEMINI_PHOTO_PRO_MODEL || 'gemini-3-pro-image';

const MIME_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9'] as const;
// Una foto arriva in 20-30 secondi; oltre questo si riprova invece di aspettare.
const TIMEOUT_MS = 150_000;

// La chiave resta in questo processo: Claude vede solo il tool, non la chiamata al modello.
export function photoTools(folder: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

  const photo = tool(
    'foto',
    'Fa una foto vera (o un’illustrazione) con il motore immagini e la salva nella cartella del brand, da mettere nella grafica con <img>. ' +
      'Descrivi soggetto, inquadratura, luce e trattamento. Niente testo e niente logo nella foto: quelli li metti tu nell’HTML. ' +
      'Puoi passare immagini della cartella come riferimento di soggetto o di stile. Più foto nello stesso messaggio girano insieme; una foto che ha come riferimento un’altra foto da fare la chiedi nel messaggio dopo, quando quella esiste.',
    {
      descrizione: z.string().min(10).describe('Cosa deve mostrare la foto: soggetto, inquadratura, luce, trattamento'),
      riferimenti: z
        .array(z.string())
        .max(6)
        .optional()
        .describe('Immagini della cartella del brand da seguire come soggetto o stile, es. file-riferimento/abc.jpg'),
      formato: z.enum(ASPECTS).describe('Le proporzioni della foto'),
      qualita: z.enum(['normale', 'pro']).optional().describe('normale (default) per quasi tutto; pro quando la foto è il centro del post e deve essere perfetta: costa il quadruplo'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.jpg$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. contenuti/<id>/foto-1.jpg'),
    },
    async ({ descrizione, riferimenti = [], formato, qualita = 'normale', file }) => {
      const model = qualita === 'pro' ? PHOTO_PRO_MODEL : PHOTO_MODEL;
      try {
        const parts: Part[] = [{ text: descrizione }];
        for (const reference of riferimenti) {
          const mimeType = MIME_TYPES[path.extname(reference).toLowerCase()];
          if (!mimeType) return failure(`Formato non supportato per il riferimento ${reference}: usa PNG, JPEG o WebP.`);
          parts.push({ inlineData: { mimeType, data: (await readFile(inside(reference))).toString('base64') } });
        }
        const response = await measure(
          {
            task: 'photo',
            model,
            extra: ({ usageMetadata }) => ({
              units: 1,
              unit: 'immagini',
              inputTokens: usageMetadata?.promptTokenCount,
              outputTokens: usageMetadata?.candidatesTokenCount,
              // Il Pro ha un prezzo fisso per immagine; il modello normale si paga a token in uscita.
              costUsd:
                qualita === 'pro'
                  ? (geminiCost(model, usageMetadata?.promptTokenCount) ?? 0) + GEMINI_DESIGN_2K
                  : (geminiCost(model, usageMetadata?.promptTokenCount, usageMetadata?.candidatesTokenCount) ?? 0),
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
        if (!image?.data) return failure('Il motore immagini non ha restituito una foto: riprova, magari con una descrizione diversa.');
        const saved = file.replace(/\.jpg$/, EXTENSIONS[image.mimeType ?? 'image/jpeg'] ?? '.jpg');
        const target = inside(saved);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(image.data, 'base64'));
        return { content: [{ type: 'text' as const, text: `Foto salvata in ${saved}` }] };
      } catch (error) {
        return failure(`Foto non riuscita: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'immagini', tools: [photo] });
}
