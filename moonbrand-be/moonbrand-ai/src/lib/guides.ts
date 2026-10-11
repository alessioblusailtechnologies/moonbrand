import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrandCategory, ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';

// Le guide di moonbrand che il codice carica da solo, senza lasciarle scegliere all'agente
// (plugin/skills/contenuti, vedi docs/2026-10-10-guide-canale-e-categoria.md):
// - canali/<canale>.md: come si fa un contenuto che sembra nato su quel canale, per ogni attività;
// - categorie/<categoria>/<canale>.md: come lavorano su quel canale le attività di quel tipo.
// Un file che non c'è vuol dire nessuna guida.
const GUIDES_DIR = new URL('../../plugin/skills/contenuti/', import.meta.url);

async function readGuide(file: string): Promise<string | null> {
  try {
    const text = await readFile(fileURLToPath(new URL(file, GUIDES_DIR)), 'utf8');
    return text.trim() || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export function channelGuide(channel: ChannelId): Promise<string | null> {
  return readGuide(`canali/${channel}.md`);
}

// Le guide della categoria per i canali del brand, una per canale sotto ### <Canale>.
export async function categoryGuide(category: BrandCategory | null | undefined, channels: readonly ChannelId[]): Promise<string | null> {
  if (!category) return null;
  const guides = await Promise.all(channels.map(async (channel) => ({ channel, text: await readGuide(`categorie/${category}/${channel}.md`) })));
  const found = guides.filter((guide) => guide.text);
  return found.length > 0 ? found.map((guide) => `### ${channelName(guide.channel)}\n\n${guide.text}`).join('\n\n') : null;
}
