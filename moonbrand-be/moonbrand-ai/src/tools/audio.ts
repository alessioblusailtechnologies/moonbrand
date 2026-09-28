import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const API = 'https://api.elevenlabs.io/v1';
const MUSIC_MODEL = 'music_v2_5';

// La chiave resta in questo processo: Claude vede solo il tool, non la chiamata a ElevenLabs.
export function audioTools(folder: string, apiKey: string) {
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

  const music = tool(
    'genera_musica',
    'Compone una musica originale con ElevenLabs e la salva in MP3 nella cartella del brand. ' +
      'Descrivi genere, atmosfera, strumenti, tempo (BPM) e come evolve: per esempio un inizio che aggancia, una crescita, un finale netto. ' +
      'Dura quanto chiedi, così segue la durata del video.',
    {
      descrizione: z.string().min(10).describe('Com’è la musica: genere, atmosfera, strumenti, tempo, andamento'),
      secondi: z.number().min(3).max(600).describe('Durata in secondi'),
      voce: z.boolean().optional().describe('true per avere anche una parte cantata; di base è solo strumentale'),
      file: z
        .string()
        .regex(/^[A-Za-z0-9._\/-]+\.mp3$/)
        .describe('Dove salvarla, relativo alla cartella del brand, es. video/public/contenuti/<id>/musica.mp3'),
    },
    async ({ descrizione, secondi, voce = false, file }) => {
      try {
        const response = await fetch(`${API}/music?output_format=mp3_44100_192`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: descrizione,
            music_length_ms: Math.round(secondi * 1000),
            model_id: MUSIC_MODEL,
            force_instrumental: !voce,
          }),
        });
        if (!response.ok) return failure(`ElevenLabs ha risposto ${response.status}: ${await response.text()}`);
        const target = inside(file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, Buffer.from(await response.arrayBuffer()));
        return { content: [{ type: 'text' as const, text: `Musica salvata in ${file}` }] };
      } catch (error) {
        return failure(`Generazione non riuscita: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'audio', tools: [music] });
}
