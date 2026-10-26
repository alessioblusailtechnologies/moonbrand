import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { ELEVENLABS } from '../../lib/prices';
import { atlasClient } from './atlas';
import { brandFolder, credits, download, failure, measured, PARALLEL, SAVE_PATH, text, type ServiceKeys } from './servizi';

// La parte audio della chat. Musica e canzoni sempre con Suno su Atlas (2 versioni a generazione); voce fuori campo,
// effetti e trascrizione con i tempi delle parole con ElevenLabs. I file si salvano nella cartella del brand; a Claude torna solo dove sono.

const API = 'https://api.elevenlabs.io';
const OUTPUT = 'mp3_44100_192';
// La voce a 192 kbps vuole il piano Creator di ElevenLabs.
const VOICE_OUTPUT = 'mp3_44100_128';
const DEFAULT_VOICE_MODEL = 'eleven_v3';
const SUNO = 'suno/chirp-v6';
const SUNO_MODELS = z.enum(['suno/chirp-v6', 'suno/chirp-v6-wild', 'suno/chirp-v6-mini']);

const savePath = z.string().regex(SAVE_PATH).describe('Dove salvare l’MP3, es. lavoro/musica.mp3');

export function audioServer(brandDir: string, keys: Pick<ServiceKeys, 'atlas' | 'elevenlabs'>) {
  const { inside, save } = brandFolder(brandDir);
  const apiKey = keys.elevenlabs ?? '';
  const atlas = keys.atlas ? atlasClient(keys.atlas, inside) : undefined;

  // Una musica o una canzone di Suno: aspetta e salva le versioni restituite, numerate se sono più di una.
  const suno = async (model: string, request: Record<string, unknown>, target: string) => {
    if (!atlas) throw new Error('Atlas non è configurato');
    const found = await atlas.find(model);
    const costUsd = atlas.cost(found, request, 1);
    const urls = await measured(
      { task: 'music', model },
      async () => atlas.result(await atlas.start('generateAudio', { ...request, model })),
      () => ({ costUsd, units: 1, unit: 'generazioni' }),
    );
    const numbered = (index: number) => target.replace(/(\.[a-z0-9]+)?$/i, (extension) => `-${index + 1}${extension || '.mp3'}`);
    const targets = urls.length === 1 ? [target] : urls.map((_, index) => numbered(index));
    await Promise.all(urls.map(async (url, index) => save(targets[index]!, await download(url))));
    return `${targets.length === 1 ? 'Salvata in' : `${targets.length} versioni in`} ${targets.join(', ')}, circa ${credits(costUsd)}.`;
  };

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
    'Compone con Suno una musica strumentale di sottofondo e la salva. Ne fa 2 versioni, da ascoltare e scegliere. Per una musica cantata c’è genera_canzone.',
    {
      descrizione: z.string().min(1).describe('Genere, umore, strumenti, tempo, es. «acustico caldo, chitarra e piano leggero, 100 bpm»'),
      durata: z.number().min(10).max(360).describe('In secondi'),
      stili_da_evitare: z.array(z.string()).optional(),
      modello: SUNO_MODELS.optional().describe(`Di default ${SUNO}; suno/chirp-v6-wild ha arrangiamenti più audaci, suno/chirp-v6-mini è più veloce`),
      salva: savePath,
    },
    async ({ descrizione, durata, stili_da_evitare = [], modello = SUNO, salva }) => {
      try {
        inside(salva);
        // In Suno la durata vale solo nel modo custom, dove la descrizione va in style e il prompt è il testo cantato.
        const request = {
          custom: true,
          instrumental: true,
          prompt: '',
          style: descrizione.slice(0, 500),
          ...(stili_da_evitare.length > 0 && { negative_tags: stili_da_evitare.join(', ').slice(0, 500) }),
          duration: Math.round(durata),
        };
        return text(await suno(modello, request, salva));
      } catch (error) {
        return failure(error);
      }
    },
    PARALLEL,
  );

  const song = tool(
    'genera_canzone',
    'Compone con Suno una canzone cantata, un jingle o una sigla, e la salva. Ne fa 2 versioni, da ascoltare e scegliere. ' +
      'Con il testo si canta quello, con [Verse], [Chorus], [Bridge] sulle loro righe; senza, lo scrive Suno dalla descrizione. ' +
      'Se l’utente non chiede altro, il testo è di tendenza, come le canzoni che girano sui social, e non parla di quello che fa il brand.',
    {
      descrizione: z.string().min(1).describe('La musica: genere, umore, strumenti, tempo, tipo di voce, es. «pop italiano solare, chitarra acustica, 110 bpm»'),
      testo: z.string().optional().describe('Le parole da cantare, una riga per verso'),
      titolo: z.string().optional(),
      voce: z.enum(['maschile', 'femminile']).optional(),
      durata: z.number().min(10).max(360).optional().describe('In secondi; vale solo se c’è il testo'),
      stili_da_evitare: z.array(z.string()).optional(),
      modello: SUNO_MODELS.optional().describe(`Di default ${SUNO}`),
      salva: savePath,
    },
    async ({ descrizione, testo, titolo, voce, durata, stili_da_evitare = [], modello = SUNO, salva }) => {
      try {
        inside(salva);
        const gender = voce && { vocal_gender: voce === 'maschile' ? 'Male' : 'Female' };
        const request = testo
          ? {
              custom: true,
              prompt: testo.slice(0, 3000),
              style: descrizione.slice(0, 500),
              ...(titolo && { title: titolo.slice(0, 200) }),
              ...(stili_da_evitare.length > 0 && { negative_tags: stili_da_evitare.join(', ').slice(0, 500) }),
              ...(durata && { duration: Math.round(durata) }),
              ...gender,
            }
          : { custom: false, prompt: descrizione.slice(0, 3000), ...gender };
        return text(await suno(modello, request, salva));
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

  const tools = [...(atlas || keys.elevenlabs ? [music] : []), ...(atlas ? [song] : []), ...(keys.elevenlabs ? [voices, voice, effect, transcribe] : [])];
  return createSdkMcpServer({ name: 'audio', tools });
}
