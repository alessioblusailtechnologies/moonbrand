import type { Account } from '@moonbrand/shared/api/contract';
import type { Locale } from '@moonbrand/shared/i18n/locales';

import type { Queryable } from '../../db/pool';

interface AccountRow {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  active_brand_id: string | null;
  email_confirmed_at: Date | null;
}

export async function findAccount(db: Queryable, accountId: string): Promise<(Account & { activeBrandId: string | null }) | null> {
  const { rows } = await db.query<AccountRow>(
    'select id, email, name, locale, active_brand_id, email_confirmed_at from presenza.accounts where id = $1',
    [accountId],
  );
  const row = rows[0];
  return row
    ? { id: row.id, email: row.email, name: row.name, locale: row.locale, emailConfirmed: row.email_confirmed_at !== null, activeBrandId: row.active_brand_id }
    : null;
}

export async function findAccountIdByEmail(db: Queryable, email: string): Promise<string | null> {
  const { rows } = await db.query<{ id: string }>('select id from presenza.accounts where email = $1', [email]);
  return rows[0]?.id ?? null;
}

export async function accountEmail(db: Queryable, accountId: string): Promise<string | null> {
  const { rows } = await db.query<{ email: string }>('select email from presenza.accounts where id = $1', [accountId]);
  return rows[0]?.email ?? null;
}

export interface MailTarget {
  email: string;
  name: string;
  locale: Locale;
}

// Il permesso di mandare un'email all'account: al massimo una al minuto, e la conferma solo se manca ancora.
// Segna l'ora subito, nella stessa query, così due richieste insieme non ne mandano due.
export async function claimEmail(db: Queryable, accountId: string, kind: 'confirm' | 'reset'): Promise<MailTarget | null> {
  const { rows } = await db.query<MailTarget>(
    `update presenza.accounts set email_sent_at = now()
      where id = $1 and (email_sent_at is null or email_sent_at < now() - interval '60 seconds')
        and ($2 = 'reset' or email_confirmed_at is null)
      returning email, name, locale`,
    [accountId, kind],
  );
  return rows[0] ?? null;
}

export async function confirmEmail(db: Queryable, accountId: string): Promise<void> {
  await db.query('update presenza.accounts set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [accountId]);
}

export async function accountExists(db: Queryable, accountId: string): Promise<boolean> {
  const { rowCount } = await db.query('select 1 from presenza.accounts where id = $1', [accountId]);
  return (rowCount ?? 0) > 0;
}

export async function createAccount(db: Queryable, account: Omit<Account, 'emailConfirmed'>): Promise<void> {
  await db.query('insert into presenza.accounts (id, email, name, locale) values ($1, $2, $3, $4) on conflict (id) do nothing', [
    account.id,
    account.email,
    account.name,
    account.locale,
  ]);
}

export async function recordSignIn(db: Queryable, accountId: string): Promise<void> {
  await db.query('update presenza.accounts set last_sign_in_at = now() where id = $1', [accountId]);
}

export async function setActiveBrand(db: Queryable, accountId: string, brandId: string | null): Promise<void> {
  await db.query('update presenza.accounts set active_brand_id = $2 where id = $1', [accountId, brandId]);
}

export async function setLocale(db: Queryable, accountId: string, locale: Locale): Promise<void> {
  await db.query('update presenza.accounts set locale = $2 where id = $1', [accountId, locale]);
}
