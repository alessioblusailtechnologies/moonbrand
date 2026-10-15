import type { Config } from '../../config';
import { ApiError } from '../../errors';

// Le utenze con il piano Ultra in omaggio (FREE_ULTRA_EMAILS): tutti i loro brand lavorano come con un abbonamento Ultra
// attivo, senza pagare e senza passare da Dodo Payments. I crediti sono quelli del piano, a mese di calendario, più quelli
// che aggiunge l'admin. Niente checkout, cambio piano, ricariche o portale.
let emails = new Set<string>();

export function setFreeUltraEmails(settings: Pick<Config, 'FREE_ULTRA_EMAILS'>): void {
  emails = new Set((settings.FREE_ULTRA_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}

export const isFreeUltra = (email: string | null | undefined): boolean => Boolean(email && emails.has(email.toLowerCase()));

export const freePlanError = (): ApiError => ApiError.conflict('FREE_PLAN', "Questa utenza ha il piano Ultra in omaggio: non c'è niente da pagare.");
