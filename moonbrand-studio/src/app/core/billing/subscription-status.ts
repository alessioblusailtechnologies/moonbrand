import type { BrandSubscription } from '@moonbrand/shared/api/contract';

import type { I18nService } from '../i18n/i18n.service';

// Un abbonamento è vivo finché Paddle non lo chiude: anche mentre riprova un pagamento non riuscito o è in pausa.
export const subscriptionLive = (subscription: BrandSubscription | null): subscription is BrandSubscription =>
  Boolean(subscription && subscription.status !== 'canceled');

// Lo stato del piano di un brand, in una riga: da attivare, attivo fino al rinnovo, disdetto, pagamento non riuscito.
export function subscriptionStatusLine(i18n: I18nService, subscription: BrandSubscription | null): string {
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(i18n.intl(), { day: 'numeric', month: 'long' }) : '');
  if (!subscription) return i18n.t('plans.status.none');
  if (subscription.status === 'canceled') return i18n.t('plans.status.canceled');
  if (subscription.cancelsAt) return i18n.t('plans.status.cancels', { date: date(subscription.cancelsAt) });
  if (subscription.status === 'past_due') return i18n.t('plans.status.past_due');
  if (subscription.status === 'paused') return i18n.t('plans.status.paused');
  return i18n.t('plans.status.active', { date: date(subscription.periodEnd) });
}
