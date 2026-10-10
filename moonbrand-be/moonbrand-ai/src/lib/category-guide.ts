import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { BrandCategory, ChannelId } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';

// Le guide per categoria di attività, un file per canale (plugin/skills/contenuti/categorie/<categoria>/<canale>.md):
// come lavorano su quel canale le attività di quel tipo. Le carica il codice in base al brand, non le sceglie l'agente,
// e solo per i canali del brand; i canali senza file non hanno guida.
const CATEGORIES_DIR = new URL('../../plugin/skills/contenuti/categorie/', import.meta.url);

async function channelGuide(category: BrandCategory, channel: ChannelId): Promise<string | null> {
  try {
    const text = await readFile(fileURLToPath(new URL(`${category}/${channel}.md`, CATEGORIES_DIR)), 'utf8');
    return text.trim() || null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function categoryGuide(category: BrandCategory | null | undefined, channels: readonly ChannelId[]): Promise<string | null> {
  if (!category) return null;
  const guides = await Promise.all(channels.map(async (channel) => ({ channel, text: await channelGuide(category, channel) })));
  const found = guides.filter((guide) => guide.text);
  return found.length > 0 ? found.map((guide) => `### ${channelName(guide.channel)}\n\n${guide.text}`).join('\n\n') : null;
}
