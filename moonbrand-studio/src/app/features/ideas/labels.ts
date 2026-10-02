import type { IdeaSignalKind } from '@moonbrand/shared/domain/idea';
import type { MessageKey } from '@moonbrand/shared/i18n/translate';

export const SIGNAL_LABELS: Record<IdeaSignalKind, MessageKey> = {
  theme: 'ideas.signal.theme',
  trend: 'ideas.signal.trend',
  recurrence: 'ideas.signal.recurrence',
  season: 'ideas.signal.season',
  network: 'ideas.signal.network',
  prompt: 'ideas.signal.prompt',
  link: 'ideas.signal.link',
  document: 'ideas.signal.document',
};
