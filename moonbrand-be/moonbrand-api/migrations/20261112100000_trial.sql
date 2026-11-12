-- La prova gratuita di 7 giorni (TRIAL in shared/domain/subscription.ts): la fine la scrive l'API quando nasce l'account.
-- Gli account già esistenti restano senza prova (null).

alter table presenza.accounts add column trial_ends_at timestamptz;
