import type { Account } from '@moonbrand/shared/api/contract';
import type { Locale } from '@moonbrand/shared/i18n/locales';

import type { Queryable } from '../../db/pool';

interface AccountRow {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  active_brand_id: string | null;
}

export async function findAccount(db: Queryable, accountId: string): Promise<(Account & { activeBrandId: string | null }) | null> {
  const { rows } = await db.query<AccountRow>('select id, email, name, locale, active_brand_id from presenza.accounts where id = $1', [accountId]);
  const row = rows[0];
  return row ? { id: row.id, email: row.email, name: row.name, locale: row.locale, activeBrandId: row.active_brand_id } : null;
}

export async function accountExists(db: Queryable, accountId: string): Promise<boolean> {
  const { rowCount } = await db.query('select 1 from presenza.accounts where id = $1', [accountId]);
  return (rowCount ?? 0) > 0;
}

export async function createAccount(db: Queryable, account: Account): Promise<void> {
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
