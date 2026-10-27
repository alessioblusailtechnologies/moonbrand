import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import { GoogleGenAI, type GenerateContentConfig, type GenerateContentResponse, type Part } from '@google/genai';

import { geminiCost } from '../../lib/prices';
import { measured, MIME_TYPES } from './servizi';

// Gemini per i tool della chat: immagini (genera_immagine) e occhi (guarda_file). I file della cartella del brand vanno
// nella richiesta; oltre i 15 MB passano dalla Files API.

const INLINE_BYTES = 15 * 1024 * 1024;

export function geminiClient(apiKey: string, inside: (relative: string) => string) {
  const ai = new GoogleGenAI({ apiKey });

  const part = async (relative: string): Promise<Part> => {
    const mimeType = MIME_TYPES[path.extname(relative).toLowerCase()];
    if (!mimeType) throw new Error(`${relative}: formato non supportato`);
    const full = inside(relative);
    if ((await stat(full)).size <= INLINE_BYTES) return { inlineData: { mimeType, data: (await readFile(full)).toString('base64') } };
    let file = await ai.files.upload({ file: full, config: { mimeType } });
    while (file.state === 'PROCESSING') {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      file = await ai.files.get({ name: file.name! });
    }
    if (file.state === 'FAILED' || !file.uri) throw new Error(`${relative}: caricamento non riuscito`);
    return { fileData: { mimeType, fileUri: file.uri } };
  };

  // Il costo dai token della risposta, anche quelli delle immagini, che costano più del testo.
  const generate = async (task: 'image' | 'vision', model: string, files: string[], prompt: string, config?: GenerateContentConfig): Promise<GenerateContentResponse> => {
    const parts = [...(await Promise.all(files.map(part))), { text: prompt }];
    return measured(
      { task, model },
      () => ai.models.generateContent({ model, contents: [{ role: 'user', parts }], ...(config && { config }) }),
      (response) => {
        const usage = response.usageMetadata;
        const image = usage?.candidatesTokensDetails?.find((detail) => detail.modality === 'IMAGE')?.tokenCount ?? 0;
        const output = (usage?.candidatesTokenCount ?? 0) - image + (usage?.thoughtsTokenCount ?? 0);
        const input = usage?.promptTokenCount ?? 0;
        const images = (response.candidates?.[0]?.content?.parts ?? []).filter((item) => item.inlineData?.mimeType?.startsWith('image/')).length;
        const costUsd = geminiCost(model, { input, output, image });
        if (costUsd === undefined) console.warn(`[gemini] ${model} non è nel listino (prices.ts)`);
        return { costUsd, inputTokens: input, outputTokens: output + image, ...(images > 0 && { units: images, unit: 'immagini' }) };
      },
    );
  };

  return { generate };
}
