import { access } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import type { ContentEditJobInput, ContentJobInput, ContentVideoJobInput } from '@moonbrand/shared/api/contract';
import { cleanHashtags, type ChannelVariant, type ContentFile, type ContentVisual, type VideoScene } from '@moonbrand/shared/domain/content';

import { contentDir } from '../lib/content';

interface ContentResult {
  title: string;
  variants: ChannelVariant[];
  visual: { headline: string; slides: { title: string; body: string }[]; script?: string; scenes?: VideoScene[]; layout?: string; files: ContentFile[] };
}

// Il copione di un video, prima del video: solo titolo, idea e inquadrature.
interface ScriptResult {
  title: string;
  visual: { script: string; scenes: VideoScene[] };
}


const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

const ROLE_ORDER = { cover: 0, slide: 1, video: 2 };

const cleanScenes = (scenes: VideoScene[]): VideoScene[] =>
  scenes.map((scene) => ({
    seconds: Math.max(0.5, Math.round(scene.seconds * 10) / 10),
    shot: scene.shot.trim(),
    source: scene.source,
    onScreen: scene.onScreen.trim(),
    voice: scene.voice.trim(),
  }));

// Il contenuto scritto dal job va nella sua riga di presenza.contents, nella forma che legge anche social-app.
// Qui valgono le regole che il modello potrebbe non rispettare: solo i canali richiesti,
// hashtag puliti e contati, solo i file che esistono davvero nella cartella del contenuto.
// scriptOnly: il job ha scritto solo il copione di un video (il job content di un video, un ritocco del copione).
export async function saveContent(
  pool: pg.Pool,
  brandsDir: string,
  input: ContentJobInput | ContentEditJobInput | ContentVideoJobInput,
  result: unknown,
  scriptOnly = false,
): Promise<void> {
  const { brandId, contentId, format, channels } = input;
  const brandDir = path.join(brandsDir, brandId);
  const dir = `${contentDir(contentId)}/`;

  if (scriptOnly) {
    const written = result as ScriptResult;
    const scenes = cleanScenes(written.visual.scenes);
    if (scenes.length === 0) throw new Error('il copione non ha inquadrature');
    const visual: ContentVisual = { headline: '', slides: [], script: written.visual.script.trim(), scenes, design: null, files: [] };
    await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb where id = $1', [
      contentId,
      written.title.trim().slice(0, 300) || 'Video',
      '[]',
      JSON.stringify(visual),
    ]);
    return;
  }

  const written = result as ContentResult;
  const variants: ChannelVariant[] = channels.flatMap((channel) => {
    const variant = written.variants.find((item) => item.channel === channel);
    return variant ? [{ channel, text: variant.text.trim(), hashtags: cleanHashtags(variant.hashtags, channel) }] : [];
  });
  if (variants.length === 0) throw new Error('nessuna variante di testo per i canali richiesti');

  const files: ContentFile[] = [];
  for (const file of written.visual.files) {
    if (!file.file.startsWith(dir) || file.file.includes('..')) continue;
    if (await exists(path.join(brandDir, file.file))) files.push({ file: file.file, role: file.role, index: file.index, aspect: file.aspect });
  }
  if (files.length === 0) throw new Error('nessun file trovato nella cartella del contenuto');
  if (format === 'video' && !files.some((file) => file.role === 'video')) throw new Error('nessun video trovato nella cartella del contenuto');
  files.sort((a, b) => (a.role === b.role ? a.index - b.index : ROLE_ORDER[a.role] - ROLE_ORDER[b.role]));

  const visual: ContentVisual = {
    headline: written.visual.headline.trim(),
    slides: format === 'carousel' ? written.visual.slides.slice(0, 10).map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })) : [],
    script: format === 'video' ? (written.visual.script ?? '').trim() : '',
    scenes: format === 'video' ? cleanScenes(written.visual.scenes ?? []) : [],
    design: null,
    ...(written.visual.layout?.trim() && { layout: written.visual.layout.trim() }),
    files,
  };

  await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb where id = $1', [
    contentId,
    written.title.trim().slice(0, 300) || 'Contenuto',
    JSON.stringify(variants),
    JSON.stringify(visual),
  ]);
}
