import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { GoogleGenAI, type Part } from '@google/genai';
import { z } from 'zod';

import { IMAGE_MODEL, IMAGE_PRO_MODEL } from '../config/env';
import { GEMINI_PRO_IMAGE_2K, geminiCost } from '../config/prices';
import { measure } from '../service/usage';
import { brandFolder, failure, IMAGE_TYPES, PARALLEL, text } from './common';

// Le immagini generate (foto e illustrazioni) le fa Gemini: Claude descrive il soggetto, l'immagine arriva come file e
// lui la mette nella grafica o nel video. Di base il modello veloce; «pro» quando l'immagine è il centro del post.
const EXTENSIONS: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const ASPECTS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4', '21:9'] as const;
// Un'immagine arriva in 20-30 secondi; oltre questo si riprova invece di aspettare.
const TIMEOUT_MS = 150_000;

export function imageTools(folder: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const { inside } = brandFolder(folder);

  const generate = tool(
    'genera_immagine',
    'Genera un’immagine vera (foto o illustrazione) con il motore immagini e la salva in JPEG nella cartella del brand, da mettere in una grafica ' +
      'con <img> o in un video. Descrivi soggetto, inquadratura, luce e trattamento. Niente testo e niente logo nell’immagine: quelli li metti tu. ' +
      'Puoi passare immagini della cartella come riferimento di soggetto o di stile. Più immagini nello stesso messaggio girano insieme.',
    {
      descrizione: z.string().min(10).describe('Cosa deve mostrare l’immagine: soggetto, inquadratura, luce, trattamento'),
      riferimenti: z.array(z.string()).max(6).optional().describe('Immagini della cartella del brand da seguire come soggetto o stile, es. file-riferimento/abc.jpg'),
      formato: z.enum(ASPECTS).describe('Le proporzioni dell’immagine'),
      qualita: z.enum(['normale', 'pro']).optional().describe('normale (default) per quasi tutto; pro quando l’immagine è il centro del post e deve essere perfetta: costa il quadruplo'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.jpg$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. contenuti/<id>/foto-1.jpg'),
    },
    async ({ descrizione, riferimenti = [], formato, qualita = 'normale', file }) => {
      const model = qualita === 'pro' ? IMAGE_PRO_MODEL : IMAGE_MODEL;
      try {
        const parts: Part[] = [{ text: descrizione }];
        for (const reference of riferimenti) {
          const mimeType = IMAGE_TYPES[path.extname(reference).toLowerCase()];
          if (!mimeType) throw new Error(`formato non supportato per il riferimento ${reference}: usa PNG, JPEG o WebP.`);
          parts.push({ inlineData: { mimeType, data: (await readFile(inside(reference))).toString('base64') } });
        }
        const response = await measure(
          {
            task: 'image',
            model,
            extra: ({ usageMetadata }) => ({
              units: 1,
              unit: 'immagini',
              inputTokens: usageMetadata?.promptTokenCount,
              outputTokens: usageMetadata?.candidatesTokenCount,
              // Il Pro ha un prezzo fisso per immagine; il modello normale si paga a token in uscita.
              costUsd:
                qualita === 'pro'
                  ? (geminiCost(model, usageMetadata?.promptTokenCount) ?? 0) + GEMINI_PRO_IMAGE_2K
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
        if (!image?.data) throw new Error('il motore immagini non ha restituito un’immagine: riprova, magari con una descrizione diversa.');
        const saved = file.replace(/\.jpg$/, EXTENSIONS[image.mimeType ?? 'image/jpeg'] ?? '.jpg');
        const target = inside(saved);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(image.data, 'base64'));
        return text(`Immagine salvata in ${saved}`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'immagini', tools: [generate] });
}
