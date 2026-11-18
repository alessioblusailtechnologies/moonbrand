import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

// Il lato lungo dei video caricati: basta per i video dei social, che escono in 1080×1920.
const MAX_SIDE = 1920;

async function ffmpeg(args: string[]): Promise<void> {
  if (!ffmpegPath) throw new Error('ffmpeg non è disponibile su questa piattaforma');
  await run(ffmpegPath, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 10 * 1024 * 1024 });
}

// I colori di un video HDR portati a quelli normali (SDR, bt709). L'iPhone registra in HLG e molti Android in PQ,
// tutti e due nello spazio bt2020: se quei numeri vengono letti come bt709 i colori si spengono (un rame diventa
// castano: Messina, 17/11). L'HLG è nato per stare anche sugli schermi normali, quindi gli basta il cambio di
// spazio colore; il PQ va anche riportato alla luminosità di uno schermo normale.
const SDR_FROM_HLG = 'zscale=tin=bt709:pin=bt2020:min=bt2020nc:t=bt709:p=bt709:m=bt709:r=tv';
const SDR_FROM_PQ =
  'zscale=tin=smpte2084:pin=bt2020:min=bt2020nc:t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv';

// ffmpeg senza uscita stampa la descrizione del file e finisce in errore: la descrizione è quello che serve.
async function hdrKind(input: string): Promise<'hlg' | 'pq' | null> {
  if (!ffmpegPath) throw new Error('ffmpeg non è disponibile su questa piattaforma');
  const described = await run(ffmpegPath, ['-hide_banner', '-i', input], { maxBuffer: 10 * 1024 * 1024 }).then(
    (done) => done.stderr,
    (error: { stderr?: string }) => error.stderr ?? '',
  );
  const video = described.split('\n').find((line) => /Stream #0:\d+.*Video:/.test(line)) ?? '';
  if (video.includes('arib-std-b67')) return 'hlg';
  if (video.includes('smpte2084')) return 'pq';
  return null;
}

// Un video caricato diventa un MP4 H.264 che si guarda ovunque e che Remotion sa montare: dall'HEVC dell'iPhone,
// da MOV, WebM e altri. Già ruotato per il verso giusto, con il lato lungo al massimo di MAX_SIDE, con i colori
// normali (mai HDR) e con l'inizio del file pronto per partire subito. Accanto, la copertina in JPEG da un
// fotogramma di mezzo secondo.
export async function normalizeVideo(input: string, output: string, poster: string): Promise<void> {
  const hdr = await hdrKind(input);
  const size = `scale='if(gte(iw,ih),min(${MAX_SIDE},iw),-2)':'if(gte(iw,ih),-2,min(${MAX_SIDE},ih))'`;
  const sdr = hdr === 'hlg' ? SDR_FROM_HLG : hdr === 'pq' ? SDR_FROM_PQ : null;
  await ffmpeg([
    '-i',
    input,
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    sdr ? `${sdr},${size}` : size,
    // Il file convertito dichiara i colori che ha davvero: senza, resterebbe scritto bt2020 e HLG.
    ...(sdr ? ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'] : []),
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-movflags',
    '+faststart',
    output,
  ]);
  // Un video più corto di mezzo secondo prende il primo fotogramma.
  await ffmpeg(['-ss', '0.5', '-i', output, '-frames:v', '1', '-q:v', '3', poster]).catch(() => undefined);
  const made = await stat(poster).then(
    (info) => info.size > 0,
    () => false,
  );
  if (!made) await ffmpeg(['-i', output, '-frames:v', '1', '-q:v', '3', poster]);
}

// Un audio caricato (dal telefono, registrato nel browser, o la traccia di un video) diventa un MP3 mono a 128 kbps
// costanti: lo leggono ElevenLabs e i montaggi, e la durata si conta dalla dimensione (AUDIO_BYTES_PER_SECOND).
export const AUDIO_BYTES_PER_SECOND = 128_000 / 8;

export async function normalizeAudio(input: string, output: string): Promise<void> {
  await ffmpeg(['-i', input, '-map', '0:a:0', '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', output]);
}
