import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const API = 'https://api.elevenlabs.io/v1';
const VOICE_MODEL = 'eleven_v3';

interface SharedVoice {
  voice_id: string;
  name: string;
  description?: string | null;
  gender?: string;
  age?: string;
  accent?: string;
  descriptive?: string;
  use_case?: string;
}

interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

// Il formato Caption di @remotion/captions: il testo di ogni parola dopo la prima comincia con uno spazio.
interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  timestampMs: number | null;
  confidence: number | null;
}

// Dai tempi delle lettere a quelli delle parole; i tag di intonazione di eleven_v3, come [whispers], non si leggono e restano fuori.
function toCaptions({ characters, character_start_times_seconds: starts, character_end_times_seconds: ends }: Alignment): Caption[] {
  const captions: Caption[] = [];
  let word: { text: string; start: number; end: number } | null = null;
  let inTag = false;
  const close = () => {
    if (!word) return;
    const startMs = Math.round(word.start * 1000);
    captions.push({ text: `${captions.length > 0 ? ' ' : ''}${word.text}`, startMs, endMs: Math.round(word.end * 1000), timestampMs: startMs, confidence: null });
    word = null;
  };
  characters.forEach((character, index) => {
    if (character === '[') inTag = true;
    if (inTag || /\s/.test(character)) {
      close();
      if (character === ']') inTag = false;
      return;
    }
    word ??= { text: '', start: starts[index] ?? 0, end: 0 };
    word.text += character;
    word.end = ends[index] ?? word.end;
  });
  close();
  return captions;
}

// Voce fuori campo ed effetti con ElevenLabs (la musica la fa Mureka, in musica.ts).
// La chiave resta in questo processo: Claude vede solo i tool, non le chiamate a ElevenLabs.
export function audioTools(folder: string, apiKey: string) {
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const save = async (file: string, data: Buffer | string) => {
    const target = inside(file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  };
  const call = async (endpoint: string, init?: { body: unknown }) => {
    const response = await fetch(`${API}${endpoint}`, {
      method: init ? 'POST' : 'GET',
      headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
      ...(init && { body: JSON.stringify(init.body) }),
    });
    if (!response.ok) throw new Error(`ElevenLabs ha risposto ${response.status}: ${await response.text()}`);
    return response;
  };
  const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
  const failure = (error: unknown) => ({
    content: [{ type: 'text' as const, text: `Non riuscito: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });
  const mp3 = (example: string) =>
    z
      .string()
      .regex(/^[A-Za-z0-9._\/-]+\.mp3$/)
      .describe(`Dove salvarlo, relativo alla cartella del brand, es. video/public/contenuti/<id>/${example}`);

  const voices = tool(
    'cerca_voci',
    'Cerca voci per la voce fuori campo nella libreria di ElevenLabs e restituisce id e descrizione di ciascuna. ' +
      'Non puoi ascoltarle: scegli dalla descrizione quella che somiglia di più alla voce del brand.',
    {
      lingua: z.string().optional().describe('Codice della lingua, es. it (di base) o en'),
      genere: z.enum(['male', 'female', 'neutral']).optional(),
      eta: z.enum(['young', 'middle_aged', 'old']).optional(),
      uso: z
        .enum(['narrative_story', 'conversational', 'characters_animation', 'social_media', 'entertainment_tv', 'advertisement', 'informative_educational'])
        .optional()
        .describe('Per cosa è pensata la voce'),
      cerca: z.string().optional().describe('Parole da cercare nel nome o nella descrizione, in inglese, es. warm, calm, energetic'),
    },
    async ({ lingua = 'it', genere, eta, uso, cerca }) => {
      try {
        const query = new URLSearchParams({ language: lingua, page_size: '20', sort: 'usage_character_count_1y' });
        if (genere) query.set('gender', genere);
        if (eta) query.set('age', eta);
        if (uso) query.set('use_cases', uso);
        if (cerca) query.set('search', cerca);
        const { voices: found } = (await (await call(`/shared-voices?${query}`)).json()) as { voices: SharedVoice[] };
        if (found.length === 0) return text('Nessuna voce trovata: allarga la ricerca.');
        const lines = found.map((voice) =>
          [voice.voice_id, voice.name, voice.gender, voice.age, voice.accent, voice.descriptive, voice.use_case, voice.description?.replace(/\s+/g, ' ')]
            .filter(Boolean)
            .join(' · '),
        );
        return text(lines.join('\n'));
      } catch (error) {
        return failure(error);
      }
    },
    { alwaysLoad: true },
  );

  const voiceOver = tool(
    'genera_voce',
    'Legge un testo con una voce di ElevenLabs (eleven_v3) e salva l’audio in MP3. Accanto salva, con lo stesso nome e .json, ' +
      'i tempi di ogni parola nel formato Caption di @remotion/captions, per i sottotitoli e per mettere a tempo le scene. ' +
      'Il testo può contenere tag di intonazione in inglese tra parentesi quadre, es. [whispers], [excited], [pause]: non finiscono nei sottotitoli.',
    {
      testo: z.string().min(1).describe('Il testo da leggere, scritto come si pronuncia: numeri e sigle come vanno detti'),
      voce: z.string().describe('L’id della voce, da cerca_voci o quella già scelta per il brand'),
      lingua: z.string().optional().describe('Codice della lingua, es. it (di base)'),
      file: mp3('voce.mp3'),
    },
    async ({ testo, voce, lingua = 'it', file }) => {
      try {
        const response = await call(`/text-to-speech/${encodeURIComponent(voce)}/with-timestamps?output_format=mp3_44100_128`, {
          body: { text: testo, model_id: VOICE_MODEL, language_code: lingua },
        });
        const { audio_base64, alignment } = (await response.json()) as { audio_base64: string; alignment: Alignment };
        const captions = toCaptions(alignment);
        const captionsFile = file.replace(/\.mp3$/, '.json');
        await save(file, Buffer.from(audio_base64, 'base64'));
        await save(captionsFile, JSON.stringify(captions, null, 2));
        const seconds = (alignment.character_end_times_seconds.at(-1) ?? 0).toFixed(2);
        return text(`Voce salvata in ${file} (${seconds} secondi); i tempi delle parole in ${captionsFile}.`);
      } catch (error) {
        return failure(error);
      }
    },
    { alwaysLoad: true },
  );

  const effect = tool(
    'genera_effetto',
    'Crea un effetto sonoro con ElevenLabs e lo salva in MP3: transizioni, colpi, fruscii, ambienti, rumori di oggetti. ' +
      'Descrivi il suono in inglese e con precisione, es. "soft whoosh transition, airy, short tail".',
    {
      descrizione: z.string().min(3).describe('Il suono, in inglese'),
      secondi: z.number().min(0.5).max(30).optional().describe('Durata in secondi; se manca la sceglie ElevenLabs'),
      loop: z.boolean().optional().describe('true per un suono che si ripete senza stacchi, es. un ambiente di fondo'),
      file: mp3('whoosh.mp3'),
    },
    async ({ descrizione, secondi, loop = false, file }) => {
      try {
        const response = await call('/sound-generation?output_format=mp3_44100_128', {
          body: { text: descrizione, loop, ...(secondi !== undefined && { duration_seconds: secondi }) },
        });
        await save(file, Buffer.from(await response.arrayBuffer()));
        return text(`Effetto salvato in ${file}`);
      } catch (error) {
        return failure(error);
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'audio', tools: [voices, voiceOver, effect] });
}
