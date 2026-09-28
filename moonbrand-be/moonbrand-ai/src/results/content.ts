import { access } from 'node:fs/promises';
import path from 'node:path';

import type pg from 'pg';

import type { ContentEditJobInput, ContentJobInput, ContentPhotosJobInput } from '@moonbrand/shared/api/contract';
import type { ChannelVariant, ContentFile, ContentPhotoSlot, ContentVisual } from '@moonbrand/shared/domain/content';

import { contentDir, HASHTAGS } from '../lib/content';

interface ContentResult {
  title: string;
  variants: ChannelVariant[];
  visual: {
    headline: string;
    slides: { title: string; body: string }[];
    files: ContentFile[];
    slots: { id: string; description: string; aspect: string; file: string }[];
  };
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

// Gli slot con la loro foto, se c'è davvero. Da dove viene la foto lo sa il job che riempie gli slot;
// negli altri casi resta quello di prima, se la foto non è cambiata.
async function photoSlots(
  pool: pg.Pool,
  brandDir: string,
  dir: string,
  input: ContentJobInput | ContentEditJobInput | ContentPhotosJobInput,
  written: ContentResult['visual']['slots'],
): Promise<ContentPhotoSlot[]> {
  const { rows } = await pool.query<{ slots: ContentPhotoSlot[] | null }>("select visual->'slots' as slots from presenza.contents where id = $1", [
    input.contentId,
  ]);
  const before = new Map((rows[0]?.slots ?? []).map((slot) => [slot.id, slot]));
  const filled = new Map('slots' in input ? input.slots.map((slot) => [slot.id, slot.upload ? ('upload' as const) : ('ai' as const)]) : []);

  const slots: ContentPhotoSlot[] = [];
  for (const slot of written) {
    if (slots.some((item) => item.id === slot.id)) continue;
    const file = slot.file.startsWith(dir) && !slot.file.includes('..') && (await exists(path.join(brandDir, slot.file))) ? slot.file : '';
    const previous = before.get(slot.id);
    const source = file ? (filled.get(slot.id) ?? (previous?.file === file ? previous.source : null)) : null;
    slots.push({ id: slot.id, description: slot.description.trim(), aspect: slot.aspect, file, source });
  }
  return slots;
}

function cleanHashtags(hashtags: readonly string[], max: number): string[] {
  const clean = hashtags
    .map((tag) => tag.trim().replace(/\s+/g, '').replace(/^#*/, ''))
    .filter(Boolean)
    .map((tag) => `#${tag}`);
  return [...new Set(clean)].slice(0, max);
}

// Il contenuto scritto dal job va nella sua riga di presenza.contents, nella forma che legge anche social-app.
// Qui valgono le regole che il modello potrebbe non rispettare: solo i canali richiesti,
// hashtag puliti e contati, solo le immagini che esistono davvero nella cartella del contenuto.
export async function saveContent(
  pool: pg.Pool,
  brandsDir: string,
  input: ContentJobInput | ContentEditJobInput | ContentPhotosJobInput,
  result: unknown,
): Promise<void> {
  const { brandId, contentId, format, channels } = input;
  const written = result as ContentResult;
  const brandDir = path.join(brandsDir, brandId);
  const dir = `${contentDir(contentId)}/`;

  const variants: ChannelVariant[] = channels.flatMap((channel) => {
    const variant = written.variants.find((item) => item.channel === channel);
    return variant ? [{ channel, text: variant.text.trim(), hashtags: cleanHashtags(variant.hashtags, HASHTAGS[channel]) }] : [];
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
    slots: await photoSlots(pool, brandDir, dir, input, written.visual.slots ?? []),
  };

  await pool.query('update presenza.contents set title = $2, variants = $3::jsonb, visual = $4::jsonb where id = $1', [
    contentId,
    written.title.trim().slice(0, 300) || 'Contenuto',
    JSON.stringify(variants),
    JSON.stringify(visual),
  ]);
}
