import type { StepMedia } from '../ai/steps';

// Un artefatto: un file che il sistema ha prodotto in una conversazione (un'immagine, una clip, una musica, un documento,
// una pagina HTML). Lo registra il worker quando il tool che l'ha fatto finisce, con una copia fissa in artefatti/:
// rifatto lo stesso file, nasce un artefatto nuovo che punta al precedente (parentId), e il precedente resta com'era.
// I contenuti salvati non sono artefatti: stanno in Contenuti e la chat li mostra accanto a questi.
export type ArtifactKind = StepMedia['kind'];

export interface ArtifactFile {
  file: string;
  url: string;
}

export interface Artifact {
  id: string;
  // Il turno in cui è nato.
  jobId: string;
  kind: ArtifactKind;
  title: string;
  // Il percorso che il tool ha scritto nella cartella del brand: le versioni dello stesso file lo condividono.
  source: string;
  // La copia fissa, o le copie quando il tool ne fa più versioni insieme (le 2 musiche di Suno).
  files: ArtifactFile[];
  mime: string;
  parentId: string | null;
  // La proporzione, quando si sa.
  aspect: string | null;
  createdAt: string;
}

// La cartella delle copie fisse, nella cartella del brand.
export const ARTIFACTS_DIR = 'artefatti';

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  md: 'text/markdown',
  txt: 'text/plain',
  pdf: 'application/pdf',
  html: 'text/html',
  htm: 'text/html',
};

export function mimeOf(file: string): string {
  return MIME[/\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? ''] ?? 'application/octet-stream';
}

// Il titolo che si legge dal nome del file: «lavoro/copertina-reel.png» diventa «copertina reel», «lavoro/clip/2.mp4»
// diventa «clip 2».
export function titleFromFile(file: string): string {
  const parts = file.split('/');
  const name = (parts.pop() ?? file).replace(/\.[^.]+$/, '');
  const words = (value: string) => value.replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
  const shown = /^\d+$/.test(name) && parts.length > 0 ? `${words(parts.at(-1)!)} ${name}` : words(name);
  return shown.charAt(0).toUpperCase() + shown.slice(1);
}
