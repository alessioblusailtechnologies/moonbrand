import type { BrandSubscription } from '@moonbrand/shared/api/contract';

import type { I18nService } from '../i18n/i18n.service';

// Un abbonamento è vivo finché Dodo Payments non lo chiude: anche con un rinnovo non pagato che aspetta la carta nuova, o
// in pausa.
const ENDED = new Set(['cancelled', 'expired', 'failed']);

export const subscriptionLive = (subscription: BrandSubscription | null): subscription is BrandSubscription =>
  Boolean(subscription && !ENDED.has(subscription.status));

// Lo stato del piano di un brand, in una riga: da attivare, in omaggio, in attivazione, attivo fino al rinnovo, disdetto,
// pagamento non riuscito.
export function subscriptionStatusLine(i18n: I18nService, subscription: BrandSubscription | null): string {
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.intl(), { day: 'numeric', month: 'long' }) : '');
  if (!subscription) return i18n.t('plans.status.none');
  if (subscription.free) return i18n.t('plans.status.free');
  switch (subscription.status) {
    case 'pending':
      return i18n.t('plans.status.pending');
    case 'cancelled':
      return i18n.t('plans.status.cancelled');
    case 'expired':
      return i18n.t('plans.status.expired');
    case 'failed':
      return i18n.t('plans.status.failed');
    case 'paused':
      return i18n.t('plans.status.paused');
    case 'past_due':
    case 'on_hold':
      return i18n.t('plans.status.past_due');
    default:
      if (subscription.cancelsAt) return i18n.t('plans.status.cancels', { date: date(subscription.cancelsAt) });
      return i18n.t('plans.status.active', { date: date(subscription.periodEnd) });
  }
}
