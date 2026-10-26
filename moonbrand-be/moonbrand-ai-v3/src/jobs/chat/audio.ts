import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { ELEVENLABS } from '../../lib/prices';
import { brandFolder, failure, measured, PARALLEL, SAVE_PATH, text } from './servizi';

// La parte audio della chat, con ElevenLabs: musica, voce fuori campo, effetti e trascrizione con i tempi delle parole.
// I file si salvano nella cartella del brand; a Claude torna solo dove sono e quanto durano.

const API = 'https://api.elevenlabs.io';
const OUTPUT = 'mp3_44100_192';
// La voce a 192 kbps vuole il piano Creator di ElevenLabs.
const VOICE_OUTPUT = 'mp3_44100_128';
const DEFAULT_VOICE_MODEL = 'eleven_v3';

const savePath = z.string().regex(SAVE_PATH).describe('Dove salvare l’MP3, es. lavoro/musica.mp3');

export function audioServer(brandDir: string, apiKey: string) {
  const { inside, save } = brandFolder(brandDir);

  const request = async (endpoint: string, init: { method?: string; json?: unknown; form?: FormData } = {}) => {
    const response = await fetch(`${API}${endpoint}`, {
      method: init.method ?? (init.json || init.form ? 'POST' : 'GET'),
      headers: { 'xi-api-key': apiKey, ...(init.json !== undefined && { 'content-type': 'application/json' }) },
      body: init.form ?? (init.json !== undefined ? JSON.stringify(init.json) : undefined),
      signal: AbortSignal.timeout(10 * 60_000),
    });
    if (!response.ok) throw new Error(`${response.status}: ${(await response.text()).slice(0, 500)}`);
    return response;
  };

  const saveAudio = async (target: string, response: Response) => {
    await save(target, Buffer.from(await response.arrayBuffer()));
    return target;
  };

  const music = tool(
    'genera_musica',
    'Compone una musica e la salva. Con sezioni la struttura segue i tagli del video (strofa, drop, finale, con la loro durata); senza, basta il prompt.',
    {
      prompt: z.string().optional().describe('Genere, umore, strumenti, tempo; obbligatorio senza sezioni'),
      durata: z.number().min(3).max(300).describe('In secondi'),
      strumentale: z.boolean().optional().describe('Senza voce cantata, di default sì'),
      stili: z.array(z.string()).optional().describe('Con sezioni: gli stili di tutto il brano'),
      stili_da_evitare: z.array(z.string()).optional(),
      sezioni: z
        .array(
          z.object({
            nome: z.string(),
            durata: z.number().positive().describe('In secondi'),
            stili: z.array(z.string()),
            stili_da_evitare: z.array(z.string()).optional(),
            testo: z.array(z.string()).optional().describe('Le righe cantate, se non è strumentale'),
          }),
        )
        .optional(),
      modello: z.string().optional().describe('es. music_v1, music_v2_5; di default quello di ElevenLabs'),
      salva: savePath,
    },
    async ({ prompt, durata, strumentale = true, stili = [], stili_da_evitare = [], sezioni, modello, salva }) => {
      try {
        inside(salva);
        if (!prompt && !sezioni?.length) throw new Error('serve il prompt o le sezioni');
        const body = sezioni?.length
          ? {
              composition_plan: {
                positive_global_styles: stili,
                negative_global_styles: stili_da_evitare,
                sections: sezioni.map((section) => ({
                  section_name: section.nome,
                  positive_local_styles: section.stili,
                  negative_local_styles: section.stili_da_evitare ?? [],
                  duration_ms: Math.round(section.durata * 1000),
                  lines: strumentale ? [] : (section.testo ?? []),
                })),
              },
              respect_sections_durations: true,
            }
          : { prompt, music_length_ms: Math.round(durata * 1000), force_instrumental: strumentale };
        const seconds = sezioni?.length ? sezioni.reduce((sum, section) => sum + section.durata, 0) : durata;
        await measured(
          { task: 'music', model: modello ?? 'music' },
          async () => saveAudio(salva, await request(`/v1/music?output_format=${OUTPUT}`, { json: { ...body, ...(modello && { model_id: modello }) } })),
          () => ({ units: seconds, unit: 'secondi', costUsd: (seconds / 60) * ELEVENLABS.musicPerMinute }),
        );
        return text(`Salvata in ${salva}, ${seconds.toFixed(0)} s.`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const voices = tool(
    'cerca_voci',
    'Cerca le voci per la voce fuori campo: quelle dell’account e quelle condivise di ElevenLabs, con id, descrizione e lingua.',
    {
      cerca: z.string().optional().describe('es. calda, narratore, giovane'),
      lingua: z.string().optional().describe('Codice della lingua, es. it, en, fr'),
      genere: z.enum(['male', 'female', 'neutral']).optional(),
    },
    async ({ cerca, lingua, genere }) => {
      try {
        const own = new URLSearchParams({ page_size: '30', ...(cerca && { search: cerca }) });
        const shared = new URLSearchParams({ page_size: '30', ...(cerca && { search: cerca }), ...(lingua && { language: lingua }), ...(genere && { gender: genere }) });
        const [mine, library] = await Promise.all([
          request(`/v2/voices?${own}`).then((response) => response.json() as Promise<{ voices?: { voice_id: string; name: string; description?: string; labels?: Record<string, string> }[] }>),
          request(`/v1/shared-voices?${shared}`).then((response) => response.json() as Promise<{ voices?: { voice_id: string; name: string; description?: string; language?: string; gender?: string; accent?: string; use_case?: string }[] }>),
        ]);
        const lines = [
          ...(mine.voices ?? []).map((voice) => `- ${voice.voice_id} ${voice.name} (account): ${[voice.description, ...Object.values(voice.labels ?? {})].filter(Boolean).join(', ').slice(0, 160)}`),
          ...(library.voices ?? []).map(
            (voice) => `- ${voice.voice_id} ${voice.name}: ${[voice.language, voice.gender, voice.accent, voice.use_case, voice.description].filter(Boolean).join(', ').slice(0, 200)}`,
          ),
        ];
        return text(lines.length > 0 ? lines.join('\n') : 'Nessuna voce trovata.');
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const voice = tool(
    'genera_voce',
    `Legge un testo con una voce (cerca_voci) e salva l’audio. Di default ${DEFAULT_VOICE_MODEL}, che capisce i tag di intonazione tra parentesi quadre.`,
    {
      testo: z.string().min(1),
      voce: z.string().describe('L’id della voce'),
      lingua: z.string().optional().describe('Codice della lingua, es. it'),
      modello: z.string().optional(),
      impostazioni: z
        .object({ stability: z.number().optional(), similarity_boost: z.number().optional(), style: z.number().optional(), speed: z.number().optional() })
        .optional(),
      salva: savePath,
    },
    async ({ testo, voce, lingua, modello = DEFAULT_VOICE_MODEL, impostazioni, salva }) => {
      try {
        inside(salva);
        const body = { text: testo, model_id: modello, ...(lingua && { language_code: lingua }), ...(impostazioni && { voice_settings: impostazioni }) };
        await measured(
          { task: 'voice', model: modello },
          async () => saveAudio(salva, await request(`/v1/text-to-speech/${encodeURIComponent(voce)}?output_format=${VOICE_OUTPUT}`, { json: body })),
          () => ({ units: testo.length, unit: 'caratteri', costUsd: (testo.length / 1000) * ELEVENLABS.voicePerThousandCharacters }),
        );
        return text(`Salvata in ${salva}. Per i tempi delle parole usa trascrivi.`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const effect = tool(
    'genera_effetto',
    'Genera un effetto sonoro (whoosh, passi, folla, un tintinnio) e lo salva.',
    {
      descrizione: z.string().min(1),
      durata: z.number().min(0.5).max(30).optional().describe('In secondi; senza, la sceglie ElevenLabs'),
      loop: z.boolean().optional(),
      salva: savePath,
    },
    async ({ descrizione, durata, loop, salva }) => {
      try {
        inside(salva);
        const seconds = durata ?? 5;
        await measured(
          { task: 'effect', model: 'sound-generation' },
          async () =>
            saveAudio(
              salva,
              await request(`/v1/sound-generation?output_format=${OUTPUT}`, { json: { text: descrizione, ...(durata && { duration_seconds: durata }), ...(loop && { loop }) } }),
            ),
          () => ({ units: seconds, unit: 'secondi', costUsd: (seconds / 60) * ELEVENLABS.effectPerMinute }),
        );
        return text(`Salvato in ${salva}.`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const transcribe = tool(
    'trascrivi',
    'Trascrive un audio o un video della cartella del brand con i tempi di ogni parola, per sottotitoli e tagli a tempo. ' +
      'Il risultato completo (parole con inizio e fine in secondi) va in salva come JSON; a te torna il testo.',
    {
      file: z.string(),
      lingua: z.string().optional().describe('Codice della lingua, es. it'),
      salva: z.string().regex(SAVE_PATH).describe('Dove salvare il JSON delle parole, es. lavoro/parole.json'),
    },
    async ({ file, lingua, salva }) => {
      try {
        inside(salva);
        const form = new FormData();
        form.append('model_id', 'scribe_v1');
        form.append('timestamps_granularity', 'word');
        if (lingua) form.append('language_code', lingua);
        form.append('file', new Blob([await readFile(inside(file))]), path.basename(file));
        const result = await measured(
          { task: 'word-timing', model: 'scribe_v1' },
          async () => (await request('/v1/speech-to-text', { form })).json() as Promise<{ text?: string; words?: { text: string; start: number; end: number; type?: string }[] }>,
          (response) => {
            const seconds = response.words?.at(-1)?.end ?? 0;
            return { units: seconds, unit: 'secondi audio', costUsd: (seconds / 3600) * ELEVENLABS.transcriptionPerHour };
          },
        );
        const words = (result.words ?? []).filter((word) => word.type !== 'spacing').map(({ text: word, start, end }) => ({ text: word, start, end }));
        await save(salva, Buffer.from(JSON.stringify({ text: result.text ?? '', words }, null, 1)));
        return text(`${words.length} parole, fino a ${(words.at(-1)?.end ?? 0).toFixed(1)} s, in ${salva}.\n\n${result.text ?? ''}`);
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'audio', tools: [music, voices, voice, effect, transcribe] });
}
