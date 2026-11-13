import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { VoicesResponse } from '@moonbrand/shared/api/contract';
import { BRAND_VOICES_MAX, VOICE_SAMPLE_MAX_SECONDS, VOICE_SAMPLE_MIN_SECONDS, type BrandVoice, type LibraryVoice } from '@moonbrand/shared/domain/voice';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { AUDIO_BYTES_PER_SECOND, normalizeAudio } from '../media/video';
import type { ElevenLabs } from './elevenlabs';
import { countVoices, deleteVoice, findVoice, insertVoice, listVoices, renameVoice, setDefaultVoice, type VoiceRow } from './repository';

// I campioni delle voci clonate, nella cartella del brand.
export const VOICES_DIR = 'voci';
// Un audio caricato: ben oltre i 5 minuti che servono, per i WAV non compressi.
export const MAX_AUDIO_BYTES = 200 * 1024 ** 2;

// Chi lavora sul DB: con l'identità dell'utente dallo studio, con il pool per i tool della chat (il token dice il brand).
export type Run = <T>(fn: (db: Queryable) => Promise<T>) => Promise<T>;

export interface VoiceOwner {
  accountId: string;
  brandId: string;
}

function voiceOf(files: BrandFiles, brandId: string, row: VoiceRow): BrandVoice {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    voiceId: row.elevenlabs_voice_id,
    previewUrl: row.kind === 'clone' && row.sample_path ? files.url(brandId, row.sample_path) : row.preview_url,
    language: row.language,
    description: row.description,
    isDefault: row.is_default,
    createdAt: row.created_at.toISOString(),
  };
}

// Un audio in arrivo o già in memoria diventa un MP3 in una cartella temporanea; il resto lo fa chi lo chiama.
export async function withMp3<T>(source: { stream: Readable } | { bytes: Uint8Array }, use: (mp3: string, seconds: number) => Promise<T>): Promise<T> {
  const work = await mkdtemp(path.join(tmpdir(), 'moonbrand-audio-'));
  try {
    const upload = path.join(work, 'upload');
    if ('stream' in source) {
      let size = 0;
      const limit = new Transform({
        transform(chunk: Buffer, _encoding, done) {
          size += chunk.length;
          done(size > MAX_AUDIO_BYTES ? ApiError.invalid(`Il file supera ${MAX_AUDIO_BYTES / 1024 ** 2} MB.`) : null, chunk);
        },
      });
      await pipeline(source.stream, limit, createWriteStream(upload));
    } else {
      await writeFile(upload, source.bytes);
    }
    const mp3 = path.join(work, 'audio.mp3');
    try {
      await normalizeAudio(upload, mp3);
    } catch {
      throw ApiError.invalid('Non riesco a leggere questo audio: prova con un MP3, un M4A o un WAV.');
    }
    return await use(mp3, (await stat(mp3)).size / AUDIO_BYTES_PER_SECOND);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

export function voiceService(files: BrandFiles, eleven: ElevenLabs | null) {
  const off = () => new ApiError(503, 'VOICES_OFF', 'Le voci non sono attive.');

  const roomFor = async (db: Queryable, brandId: string) => {
    if ((await countVoices(db, brandId)) >= BRAND_VOICES_MAX) {
      throw ApiError.conflict('VOICES_FULL', `Il brand ha già ${BRAND_VOICES_MAX} voci: togline una per aggiungerne un'altra.`);
    }
  };

  return {
    async list(run: Run, brandId: string): Promise<VoicesResponse> {
      const [rows, cloning] = await Promise.all([run((db) => listVoices(db, brandId)), eleven ? eleven.canClone() : false]);
      return { voices: rows.map((row) => voiceOf(files, brandId, row)), max: BRAND_VOICES_MAX, cloning };
    },

    search(filters: { query?: string; language?: string; gender?: string }): Promise<LibraryVoice[]> {
      if (!eleven) throw off();
      return eleven.search(filters);
    },

    async addLibrary(
      run: Run,
      owner: VoiceOwner,
      voice: { voiceId: string; name: string; language?: string | null; description?: string | null; previewUrl?: string | null },
    ): Promise<BrandVoice> {
      if (!eleven) throw off();
      const row = await run(async (db) => {
        await roomFor(db, owner.brandId);
        return insertVoice(db, { ...owner, kind: 'library', ...voice }).catch((error: { code?: string }) => {
          if (error.code === '23505') throw ApiError.conflict('VOICE_EXISTS', 'Questa voce è già tra quelle del brand.');
          throw error;
        });
      });
      return voiceOf(files, owner.brandId, row);
    },

    // La voce clonata da un MP3 già pronto (withMp3): il campione resta nella cartella del brand per l'ascolto. Se il
    // salvataggio non riesce, la voce si toglie anche da ElevenLabs, per non occupare uno spazio.
    async clone(run: Run, owner: VoiceOwner, name: string, mp3: string, seconds: number): Promise<BrandVoice> {
      if (!eleven) throw off();
      if (seconds < VOICE_SAMPLE_MIN_SECONDS) {
        throw ApiError.invalid(`Serve almeno ${VOICE_SAMPLE_MIN_SECONDS} secondi di parlato: questo audio ne ha ${Math.round(seconds)}.`);
      }
      if (seconds > VOICE_SAMPLE_MAX_SECONDS + 1) throw ApiError.invalid(`Bastano ${VOICE_SAMPLE_MAX_SECONDS / 60} minuti di parlato: accorcia l'audio.`);
      await run((db) => roomFor(db, owner.brandId));
      if (!(await eleven.canClone())) throw new ApiError(503, 'VOICE_CLONING_OFF', 'La clonazione delle voci al momento non è disponibile.');
      const bytes = new Uint8Array(await readFile(mp3));
      const voiceId = await eleven.clone(name, bytes);
      const samplePath = `${VOICES_DIR}/${randomUUID()}.mp3`;
      try {
        await files.save(owner.brandId, samplePath, bytes);
        const row = await run(async (db) => {
          await roomFor(db, owner.brandId);
          return insertVoice(db, { ...owner, kind: 'clone', name, voiceId, samplePath, consent: true });
        });
        return voiceOf(files, owner.brandId, row);
      } catch (error) {
        await eleven.remove(voiceId).catch(() => undefined);
        await files.remove(owner.brandId, samplePath).catch(() => undefined);
        throw error;
      }
    },

    async update(run: Run, brandId: string, id: string, patch: { name?: string; isDefault?: boolean }): Promise<BrandVoice> {
      const row = await run(async (db) => {
        if (!(await findVoice(db, brandId, id))) throw ApiError.notFound('Voce non trovata.');
        if (patch.name) await renameVoice(db, brandId, id, patch.name);
        if (patch.isDefault) await setDefaultVoice(db, brandId, id);
        return findVoice(db, brandId, id);
      });
      return voiceOf(files, brandId, row!);
    },

    // Una voce clonata si cancella anche da ElevenLabs, e con lei il campione.
    async remove(run: Run, brandId: string, id: string): Promise<void> {
      const row = await run(async (db) => {
        const found = await findVoice(db, brandId, id);
        if (!found) throw ApiError.notFound('Voce non trovata.');
        await deleteVoice(db, brandId, id);
        return found;
      });
      if (row.kind !== 'clone') return;
      await eleven?.remove(row.elevenlabs_voice_id);
      if (row.sample_path) await files.remove(brandId, row.sample_path).catch(() => undefined);
    },
  };
}

export type VoiceService = ReturnType<typeof voiceService>;
