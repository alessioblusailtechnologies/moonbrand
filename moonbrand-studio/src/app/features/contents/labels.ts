import type { WritableFormat } from '@moonbrand/shared/api/contract';
import type { ChannelId } from '@moonbrand/shared/domain/brand';
import type { ContentFormat, ContentStatus } from '@moonbrand/shared/domain/content';

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: 'Post',
  carousel: 'Carosello',
  article: 'Articolo',
  video: 'Video',
};

export const FORMAT_OPTIONS: { id: WritableFormat; label: string; hint: string }[] = [
  { id: 'post', label: 'Post', hint: 'Testo e un’immagine' },
  { id: 'carousel', label: 'Carosello', hint: 'Da 5 a 7 slide da scorrere' },
  { id: 'article', label: 'Articolo', hint: 'Testo lungo su LinkedIn, breve altrove, con copertina' },
];

export const STATUS_LABELS: Record<ContentStatus, string> = {
  draft: 'Bozza',
  approved: 'Approvato',
};

// La copertina di un post che si mostra per ogni canale.
export const POST_ASPECT: Record<ChannelId, string> = { instagram: '4:5', facebook: '4:5', linkedin: '1:1', tiktok: '9:16', x: '16:9' };

export function cssAspect(aspect: string): string {
  return aspect.replace(':', ' / ');
}
