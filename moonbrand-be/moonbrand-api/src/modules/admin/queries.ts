import type pg from 'pg';

import type { AdminAccount, AdminCost, AdminJob } from '@moonbrand/shared/api/contract';

import { adminEmails, type Config } from '../../config';
import { accountEmail } from '../auth/accounts';

// Le query comuni della sezione admin. I costi sono quelli veri in dollari: Claude dai job, i servizi (clip, immagini,
// musica...) da ai_usage. In ai_usage ci sono anche righe di Claude dei primi giorni (visual-style, video): contano come
// Claude, come nei crediti.

export const MONTH_START = `date_trunc('month', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome'`;
export const ROME_DAY = (column: string) => `to_char(${column} at time zone 'Europe/Rome', 'YYYY-MM-DD')`;
// Il costo di Claude e dei servizi da ai_usage, per le righe che soddisfano la condizione.
export const USAGE_CLAUDE = (where: string) => `(select coalesce(sum(cost_usd), 0) from presenza.ai_usage where ${where} and model like 'claude%')`;
export const USAGE_SERVICES = (where: string) =>
  `(select coalesce(sum(cost_usd), 0) from presenza.ai_usage where ${where} and coalesce(model, '') not like 'claude%')`;
export const JOBS_CLAUDE = (where: string) => `(select coalesce(sum(cost_usd), 0) from presenza.ai_jobs where ${where})`;

export const usd = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;
export const cost = (claude: unknown, generations: unknown): AdminCost => ({ claude: usd(claude), generations: usd(generations) });
export const iso = (value: Date | null) => (value ? value.toISOString() : null);

// Un lavoro con chi l'ha chiesto, il brand, quanto è durato e quanto è costato. In coda: da quanto aspetta.
export const JOB_SELECT = `
  select j.id, j.kind, j.status, j.account_id, a.email, b.identity->>'name' as brand_name,
    j.created_at, j.started_at, j.finished_at,
    case when j.status = 'queued' then extract(epoch from now() - j.created_at)
         when j.started_at is null then null
         else extract(epoch from coalesce(j.finished_at, now()) - j.started_at) end as seconds,
    coalesce(j.cost_usd, 0) + ${USAGE_CLAUDE('job_id = j.id')} as claude, ${USAGE_SERVICES('job_id = j.id')} as generations,
    j.error, t.message as request
  from presenza.ai_jobs j
  join presenza.accounts a on a.id = j.account_id
  left join presenza.brands b on b.id::text = j.input->>'brandId'
  left join lateral (select message from presenza.conversation_turns where job_id = j.id limit 1) t on true`;

export interface JobRow {
  id: string;
  kind: string;
  status: AdminJob['status'];
  account_id: string;
  email: string;
  brand_name: string | null;
  created_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  seconds: string | null;
  claude: string;
  generations: string;
  error: string | null;
  request: string | null;
}

export const MAX_TEXT = 300;
export const short = (text: string | null) => (text && text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}…` : text);

export function toJob(row: JobRow): AdminJob {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    accountId: row.account_id,
    email: row.email,
    brandName: row.brand_name,
    createdAt: row.created_at.toISOString(),
    startedAt: iso(row.started_at),
    finishedAt: iso(row.finished_at),
    seconds: row.seconds === null ? null : Math.round(Number(row.seconds)),
    cost: cost(row.claude, row.generations),
    error: short(row.error),
    request: short(row.request),
  };
}

export interface AccountRow {
  id: string;
  email: string;
  name: string;
  created_at: Date;
  last_sign_in_at: Date | null;
  confirmed: boolean;
  brands: string;
  contents: string;
  jobs: string;
  last_activity: Date | null;
  claude: string;
  generations: string;
  credits_month: string;
}

export const ACCOUNT_SELECT = `
  select a.id, a.email, a.name, a.created_at, a.last_sign_in_at, a.email_confirmed_at is not null as confirmed,
    (select count(*) from presenza.brands where account_id = a.id) as brands,
    (select count(*) from presenza.contents where account_id = a.id) as contents,
    (select count(*) from presenza.ai_jobs where account_id = a.id) as jobs,
    (select max(created_at) from presenza.ai_jobs where account_id = a.id) as last_activity,
    ${JOBS_CLAUDE('account_id = a.id')} + ${USAGE_CLAUDE('account_id = a.id')} as claude,
    ${USAGE_SERVICES('account_id = a.id')} as generations,
    (select coalesce(-sum(amount), 0) from presenza.credit_movements
      where account_id = a.id and amount < 0 and created_at >= ${MONTH_START}) as credits_month
  from presenza.accounts a`;

export function toAccount(row: AccountRow): AdminAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    lastSignInAt: iso(row.last_sign_in_at),
    emailConfirmed: row.confirmed,
    brands: Number(row.brands),
    contents: Number(row.contents),
    jobs: Number(row.jobs),
    lastActivityAt: iso(row.last_activity),
    cost: cost(row.claude, row.generations),
    creditsMonth: Math.round(Number(row.credits_month)),
  };
}


// Chi è admin: le email di ADMIN_EMAILS, ricontrollate a ogni richiesta sull'email dell'account.
export function adminCheck(pool: pg.Pool, settings: Pick<Config, 'ADMIN_EMAILS'>): (accountId: string) => Promise<boolean> {
  const admins = adminEmails(settings);
  return async (accountId) => {
    if (admins.size === 0) return false;
    const email = await accountEmail(pool, accountId);
    return email !== null && admins.has(email.toLowerCase());
  };
}
