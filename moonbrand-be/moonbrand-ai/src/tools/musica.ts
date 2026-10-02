import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { measure, type Meter } from '../lib/usage';
import { PARALLEL } from './parallel';

// Musica e canzoni con ElevenLabs Music: una chiamata sola, che risponde con il brano già fatto (pochi secondi per 10 s di musica).
// Il brano si fa comunque in sottofondo: il tool risponde subito, così Claude intanto scrive la composizione, e attendi_musica
// aspetta i brani in corso prima del render.
const API = 'https://api.elevenlabs.io/v1';
const MODEL = 'music_v1';
// mp3 a 128: il piano pay-as-you-go rifiuta i formati più alti.
const FORMAT = 'mp3_44100_128';
const MAX_WAIT_MS = 10 * 60_000;
// Troppe richieste insieme per il piano: si aspetta e si riprova.
const BUSY_RETRY_MS = 5_000;
// I limiti di ElevenLabs: il brano intero e ogni sezione di una canzone.
const MIN_MS = 3_000;
const MAX_MS = 600_000;
const MAX_SECTION_MS = 120_000;

interface Section {
  section_name: string;
  positive_local_styles: string[];
  negative_local_styles: string[];
  duration_ms: number;
  lines: string[];
}

// Dal testo con le sezioni tra parentesi quadre alle sezioni del composition_plan; la durata si divide in base alle righe.
// Una sezione senza righe (un [Intro] o un [Instrumental]) conta come una riga e resta strumentale.
function sections(lyrics: string, totalMs: number): Section[] {
  const parsed: { name: string; lines: string[] }[] = [];
  for (const raw of lyrics.split(/\r?\n/)) {
    const line = raw.trim();
    const tag = /^\[(.+)\]$/.exec(line);
    if (tag) parsed.push({ name: tag[1].trim().slice(0, 100), lines: [] });
    else if (line) {
      if (parsed.length === 0) parsed.push({ name: 'Verse', lines: [] });
      parsed[parsed.length - 1].lines.push(line.slice(0, 200));
    }
  }
  const weight = (section: { lines: string[] }) => Math.max(section.lines.length, 1);
  const total = parsed.reduce((sum, section) => sum + weight(section), 0);
  return parsed.map((section) => ({
    section_name: section.name,
    positive_local_styles: [],
    negative_local_styles: [],
    duration_ms: Math.min(MAX_SECTION_MS, Math.max(MIN_MS, Math.round((totalMs * weight(section)) / total))),
    lines: section.lines.slice(0, 30),
  }));
}

// La chiave resta in questo processo: Claude vede solo i tool, non le chiamate a ElevenLabs.
export function musicTools(folder: string, apiKey: string) {
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };

  // I crediti usati nel periodo, come per voce ed effetti: la differenza prima e dopo è quanto è costato il brano.
  const credits: Meter = {
    unit: 'crediti ElevenLabs',
    read: async () => {
      const response = await fetch(`${API}/user/subscription`, { headers: { 'xi-api-key': apiKey } });
      if (!response.ok) throw new Error(`ElevenLabs ha risposto ${response.status}`);
      return ((await response.json()) as { character_count: number }).character_count;
    },
  };

  const generate = async (body: Record<string, unknown>, file: string) => {
    const started = Date.now();
    let response: Response;
    for (;;) {
      response = await fetch(`${API}/music?output_format=${FORMAT}`, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'content-type': 'application/json' },
        body: JSON.stringify({ model_id: MODEL, ...body }),
      });
      if (response.status === 429 && Date.now() - started < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, BUSY_RETRY_MS));
        continue;
      }
      break;
    }
    if (!response.ok) throw new Error(`ElevenLabs ha risposto ${response.status}: ${await response.text()}`);
    const target = inside(file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await response.arrayBuffer()));
    return { content: [{ type: 'text' as const, text: `Salvato in ${file}.` }] };
  };
  const failure = (error: unknown) => ({
    content: [{ type: 'text' as const, text: `Non riuscito: ${error instanceof Error ? error.message : String(error)}` }],
    isError: true,
  });

  // I brani in corso, per file chiesto: ognuno finisce con il messaggio di generate o con l'errore.
  type Result = Awaited<ReturnType<typeof generate>> | ReturnType<typeof failure>;
  const pending = new Map<string, Promise<Result>>();
  const start = (task: 'music' | 'song', body: Record<string, unknown>, file: string) => {
    pending.set(file, measure({ task, model: MODEL, meter: credits }, () => generate(body, file)).catch(failure));
    return {
      content: [
        {
          type: 'text' as const,
          text:
            `Avviato: il brano arriva in ${file} tra pochi secondi o qualche decina, secondo la durata. ` +
            'Intanto continua: scrivi la composizione e i testi. Prima di usare il file o di renderizzare chiama attendi_musica.',
        },
      ],
    };
  };
  const audioFile = (example: string) =>
    z
      .string()
      .regex(/^[A-Za-z0-9._\/-]+\.mp3$/)
      .describe(`Dove salvarlo, relativo alla cartella del brand, es. video/public/contenuti/<id>/${example}`);
  const seconds = z
    .number()
    .min(MIN_MS / 1000)
    .max(MAX_MS / 1000)
    .describe('Quanto deve durare, in secondi: quanto il video o la parte che lo usa, più un paio di secondi per chiudere. Si paga al minuto.');

  const instrumental = tool(
    'genera_musica',
    'Avvia una musica strumentale originale con ElevenLabs, che la salva nella cartella del brand: risponde subito e il brano arriva in pochi secondi (poi attendi_musica). ' +
      'Descrivi in inglese genere, atmosfera, strumenti, tempo (BPM) e andamento, compreso come finisce. La durata la scegli tu: chiedi quella che ti serve.',
    {
      descrizione: z.string().min(10).describe('Com’è la musica, in inglese: genere, atmosfera, strumenti, tempo, andamento'),
      durata: seconds,
      file: audioFile('musica.mp3'),
    },
    ({ descrizione, durata, file }) =>
      Promise.resolve(start('music', { prompt: descrizione, music_length_ms: Math.round(durata * 1000), force_instrumental: true }, file)),
    PARALLEL,
  );

  const song = tool(
    'genera_canzone',
    'Avvia una canzone cantata con ElevenLabs, sul testo che scrivi tu, che la salva nella cartella del brand: risponde subito e il brano arriva in qualche decina di secondi (poi attendi_musica). ' +
      'Il testo va diviso in sezioni con i tag [Verse], [Chorus], [Bridge], [Outro]; una sezione senza righe, come [Intro], resta strumentale. ' +
      'La durata si divide tra le sezioni in base alle righe. Lo stile si descrive in inglese (genere, atmosfera, voce maschile o femminile, tempo).',
    {
      testo: z
        .string()
        .min(10)
        .describe('Il testo della canzone, con le sezioni tra parentesi quadre: parole da canzone vera nel tono del brand, non le frasi del copy'),
      stile: z.string().optional().describe('Lo stile in inglese, es. "warm acoustic pop, female vocal, 100 BPM, hopeful"'),
      durata: seconds,
      file: audioFile('canzone.mp3'),
    },
    ({ testo, stile, durata, file }) => {
      const plan = sections(testo, Math.round(durata * 1000));
      if (plan.length === 0) return Promise.resolve(failure(new Error('il testo non ha righe')));
      const styles = (stile ?? '').split(',').map((item) => item.trim()).filter(Boolean);
      return Promise.resolve(
        start('song', { composition_plan: { positive_global_styles: styles, negative_global_styles: [], sections: plan } }, file),
      );
    },
    PARALLEL,
  );

  const wait = tool(
    'attendi_musica',
    'Aspetta che i brani avviati con genera_musica e genera_canzone siano pronti e dice dove sono salvati o perché non sono riusciti. ' +
      'Senza file aspetta tutti quelli in corso. Da chiamare prima di usare un brano nel video o di renderizzare.',
    { file: z.array(z.string()).optional().describe('I file chiesti a genera_musica o genera_canzone; vuoto per tutti') },
    async ({ file }) => {
      const files = file?.length ? file : [...pending.keys()];
      if (files.length === 0) return { content: [{ type: 'text' as const, text: 'Nessun brano in corso.' }] };
      const results = await Promise.all(
        files.map(async (item) => {
          const job = pending.get(item);
          if (!job) return { text: `${item}: nessun brano avviato con questo nome.`, error: true };
          const result = await job;
          pending.delete(item);
          return { text: result.content[0].text, error: 'isError' in result };
        }),
      );
      return {
        content: [{ type: 'text' as const, text: results.map((result) => result.text).join('\n') }],
        ...(results.some((result) => result.error) && { isError: true }),
      };
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'musica', tools: [instrumental, song, wait] });
}
