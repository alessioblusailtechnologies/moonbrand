import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { geminiClient } from './gemini';
import { brandFolder, failure, PARALLEL, text } from './servizi';

// Gli occhi della chat sui file che non legge da sé: Gemini guarda video (movimento e audio), audio, immagini e PDF e
// risponde alla domanda.

const DEFAULT_MODEL = 'gemini-3.8-flash';

export function guardaServer(brandDir: string, apiKey: string) {
  const { inside } = brandFolder(brandDir);
  const gemini = geminiClient(apiKey, inside);

  const look = tool(
    'guarda_file',
    'Fa guardare a Gemini video, audio, immagini o PDF della cartella del brand e risponde alla domanda: per controllare un montaggio, ' +
      'il ritmo sulla musica, una voce, cosa c’è in una ripresa dell’utente.',
    {
      file: z.array(z.string()).min(1).max(10).describe('I file della cartella del brand, nell’ordine'),
      domanda: z.string().min(1),
      modello: z.string().optional().describe(`Di default ${DEFAULT_MODEL}`),
    },
    async ({ file, domanda, modello = DEFAULT_MODEL }) => {
      try {
        const response = await gemini.generate('vision', modello, file, domanda);
        const answer = (response.candidates?.[0]?.content?.parts ?? [])
          .filter((part) => part.text && !part.thought)
          .map((part) => part.text)
          .join('\n')
          .trim();
        return text(answer || 'Nessuna risposta.');
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'guarda', tools: [look] });
}
