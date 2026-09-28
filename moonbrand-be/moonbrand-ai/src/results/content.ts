import { access } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import type { ContentEditJobInput, ContentJobInput } from '@moonbrand/shared/api/contract';
import { cleanHashtags, type ChannelVariant, type ContentFile, type ContentVisual } from '@moonbrand/shared/domain/content';

import { contentDir } from '../lib/content';

interface ContentResult {
  title: string;
  variants: ChannelVariant[];
  visual: { headline: string; slides: { title: string; body: string }[]; files: ContentFile[] };
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// Il contenuto scritto dal job va nella sua riga di presenza.contents, nella forma che legge anche social-app.
// Qui valgono le regole che il modello potrebbe non rispettare: solo i canali richiesti,
// hashtag puliti e contati, solo le immagini che esistono davvero nella cartella del contenuto.
export async function saveContent(pool: pg.Pool, brandsDir: string, input: ContentJobInput | ContentEditJobInput, result: unknown): Promise<void> {
  const { brandId, contentId, format, channels } = input;
  const written = result as ContentResult;
  const brandDir = path.join(brandsDir, brandId);
  const dir = `${contentDir(contentId)}/`;

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
  if (files.length === 0) throw new Error('nessuna immagine trovata nella cartella del contenuto');
  files.sort((a, b) => (a.role === b.role ? a.index - b.index : a.role === 'cover' ? -1 : 1));

  const visual: ContentVisual = {
    headline: written.visual.headline.trim(),
    slides: format === 'carousel' ? written.visual.slides.slice(0, 10).map((slide) => ({ title: slide.title.trim(), body: slide.body.trim() })) : [],
    script: '',
    scenes: [],
    design: null,
    files,
  };

  await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb where id = $1', [
    contentId,
    written.title.trim().slice(0, 300) || 'Contenuto',
    JSON.stringify(variants),
    JSON.stringify(visual),
  ]);
}
