import type { Queryable } from '../../db/pool';

// La prova gratuita (TRIAL in shared/domain/subscription.ts): fino a accounts.trial_ends_at ogni brand dell'utenza che non
// ha un abbonamento lavora con il piano della prova e può collegare i canali in modo simulato. Un brand con
// l'abbonamento non è più in prova, anche prima della fine.

// La fine della prova dell'utenza, se è ancora in corso.
export async function trialEnd(db: Queryable, accountId: string): Promise<Date | null> {
  const { rows } = await db.query<{ trial_ends_at: Date }>(
    'select trial_ends_at from presenza.accounts where id = $1 and trial_ends_at > now()',
    [accountId],
  );
  return rows[0]?.trial_ends_at ?? null;
}

// La simulazione dei canali: sempre negli ambienti di prova (SIMULATE_SOCIAL), altrimenti solo per un brand in prova.
// brandId null: il brand dell'onboarding, che non c'è ancora e non ha abbonamento.
export async function canSimulate(db: Queryable, simulateSocial: boolean, accountId: string, brandId: string | null): Promise<boolean> {
  if (simulateSocial) return true;
  const { rows } = await db.query(
    `select 1 from presenza.accounts a
     where a.id = $1 and a.trial_ends_at > now()
       and ($2::uuid is null or not exists (select 1 from presenza.brand_subscriptions s where s.brand_id = $2::uuid))`,
    [accountId, brandId],
  );
  return rows.length > 0;
}

// Finita la prova, o attivato il piano, i canali simulati non valgono più: si segnano persi come quelli che il social ha
// chiuso, così i post lì aspettano e lo studio chiede di collegarli per davvero.
export async function expireSimulatedChannels(db: Queryable): Promise<void> {
  await db.query(
    `update presenza.brands b
     set channels = (
       select jsonb_object_agg(key, case when value ->> 'accountId' like 'sim\\_%' then value || '{"lost": true}' else value end)
       from jsonb_each(b.channels)
     )
     where exists (
         select 1 from jsonb_each(b.channels)
         where value ->> 'accountId' like 'sim\\_%' and coalesce(value ->> 'lost', 'false') <> 'true'
       )
       and (
         exists (select 1 from presenza.brand_subscriptions s where s.brand_id = b.id)
         or not exists (select 1 from presenza.accounts a where a.id = b.account_id and a.trial_ends_at > now())
       )`,
  );
}
