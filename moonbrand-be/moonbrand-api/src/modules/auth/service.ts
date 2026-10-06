import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

import type { Account, Me, ResetPasswordRequest, SignInRequest, SignUpRequest, UpdateMeRequest } from '@moonbrand/shared/api/contract';
import { DEFAULT_LOCALE, type Locale } from '@moonbrand/shared/i18n/locales';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import type { Mailer } from '../email/mailer';
import { confirmEmail as confirmTemplate, resetEmail, welcomeEmail } from '../email/templates';
import { accountEmail, claimEmail, confirmEmail, createAccount, findAccount, findAccountIdByEmail, recordSignIn, setLocale } from './accounts';
import type { EmailLinks } from './email-links';
import type { AuthGateway, Tokens } from './gateway';

export interface AuthResult extends Tokens {
  account: Account;
}

// Quello che serve per le email dell'accesso: chi le manda, i link verso lo studio e il log per quelle che non partono.
export interface AuthMail {
  mailer: Mailer;
  links: EmailLinks;
  log: FastifyBaseLogger;
}

const publicAccount = ({ id, email, name, locale, emailConfirmed }: Account): Account => ({ id, email, name, locale, emailConfirmed });

// Le email partono senza farsi aspettare: chi si registra entra subito, e chi chiede la password non capisce dal
// tempo di risposta se l'indirizzo ha un account.
function deliver(mail: AuthMail, to: string, content: ReturnType<typeof welcomeEmail>): void {
  mail.mailer.send({ to, ...content }, mail.log).catch((error: unknown) => mail.log.error({ err: error }, 'email non partita'));
}

async function sendConfirmation(pool: pg.Pool, mail: AuthMail, accountId: string, kind: 'welcome' | 'confirm'): Promise<boolean> {
  const target = await claimEmail(pool, accountId, 'confirm');
  if (!target) return false;
  const url = mail.links.confirm(accountId, target.email);
  const template = kind === 'welcome' ? welcomeEmail : confirmTemplate;
  deliver(mail, target.email, template(target.locale, target.name, url));
  return true;
}

export async function signUp(pool: pg.Pool, gateway: AuthGateway, mail: AuthMail, input: SignUpRequest): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const created = await gateway.createUser(email, input.password);
  const session = await gateway.signIn(email, input.password);
  if (!session) {
    if (created) throw new Error('accesso non riuscito subito dopo la registrazione');
    throw ApiError.conflict('EMAIL_TAKEN', 'Questa email è già registrata: accedi con la sua password.');
  }
  await createAccount(pool, { id: session.userId, email, name: input.name.trim(), locale: input.locale ?? DEFAULT_LOCALE });
  await recordSignIn(pool, session.userId);
  await sendConfirmation(pool, mail, session.userId, 'welcome');
  const account = await findAccount(pool, session.userId);
  if (!account) throw new Error('account non creato');
  const { userId: _userId, ...tokens } = session;
  return { ...tokens, account: publicAccount(account) };
}

export async function signIn(pool: pg.Pool, gateway: AuthGateway, input: SignInRequest): Promise<AuthResult> {
  const session = await gateway.signIn(input.email.trim().toLowerCase(), input.password);
  if (!session) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Email o password non corretti.');
  const account = await findAccount(pool, session.userId);
  if (!account) throw ApiError.forbidden('NO_ACCOUNT', 'Questa email non ha ancora un account: registrati.');
  await recordSignIn(pool, session.userId);
  const { userId: _userId, ...tokens } = session;
  return { ...tokens, account: publicAccount(account) };
}

export async function me(pool: pg.Pool, identity: Identity): Promise<Me> {
  const account = await withIdentity(pool, identity, (db) => findAccount(db, identity.accountId));
  if (!account) throw ApiError.forbidden('NO_ACCOUNT', 'Questa email non ha ancora un account: registrati.');
  return { account: publicAccount(account), activeBrandId: account.activeBrandId };
}

export async function updateMe(pool: pg.Pool, identity: Identity, input: UpdateMeRequest): Promise<Me> {
  await withIdentity(pool, identity, (db) => setLocale(db, identity.accountId, input.locale));
  return me(pool, identity);
}

// "Rimanda l'email" dallo studio: niente se è già confermata, un errore se ne è appena partita una.
export async function resendConfirmation(pool: pg.Pool, mail: AuthMail, identity: Identity): Promise<void> {
  if (await sendConfirmation(pool, mail, identity.accountId, 'confirm')) return;
  const account = await findAccount(pool, identity.accountId);
  if (account && !account.emailConfirmed) throw new ApiError(429, 'TOO_MANY_REQUESTS', 'L’email è appena partita: aspetta un minuto prima di chiederne un’altra.');
}

export async function confirmAccountEmail(pool: pg.Pool, links: EmailLinks, token: string): Promise<void> {
  const accountId = await links.confirmedAccount(token, (id) => accountEmail(pool, id));
  if (!accountId) throw new ApiError(400, 'INVALID_LINK', 'Il link non vale più: chiedine uno nuovo.');
  await confirmEmail(pool, accountId);
}

// Risponde sempre allo stesso modo: non si scopre da qui se un indirizzo ha un account.
export async function forgotPassword(pool: pg.Pool, gateway: AuthGateway, mail: AuthMail, email: string): Promise<void> {
  const accountId = await findAccountIdByEmail(pool, email.trim().toLowerCase());
  if (!accountId) return;
  const target = await claimEmail(pool, accountId, 'reset');
  if (!target) return;
  void gateway
    .recoveryToken(target.email)
    .then((token) => token && deliver(mail, target.email, resetEmail(target.locale, target.name, mail.links.reset(token))))
    .catch((error: unknown) => mail.log.error({ err: error }, 'link per la nuova password non creato'));
}

// Il link della nuova password diventa una sessione: si cambia la password, si chiudono le altre sessioni e si entra.
// Aver aperto il link vale anche come conferma dell'email.
export async function resetPassword(pool: pg.Pool, gateway: AuthGateway, input: ResetPasswordRequest): Promise<AuthResult> {
  const session = await gateway.verifyRecovery(input.token);
  if (!session) throw new ApiError(400, 'INVALID_LINK', 'Il link non vale più: chiedine uno nuovo.');
  await gateway.setPassword(session.accessToken, input.password);
  await gateway.signOutOthers(session.accessToken);
  const account = await findAccount(pool, session.userId);
  if (!account) throw ApiError.forbidden('NO_ACCOUNT', 'Questa email non ha ancora un account: registrati.');
  await confirmEmail(pool, session.userId);
  await recordSignIn(pool, session.userId);
  const { userId: _userId, ...tokens } = session;
  return { ...tokens, account: publicAccount({ ...account, emailConfirmed: true }) };
}

// Di ritorno da Google: chi non ha ancora un account lo trova creato (nome e email da Google, email già confermata).
// Con la stessa email di un account con password, Supabase unisce le due identità: si entra nello stesso account.
export async function signInWithGoogle(pool: pg.Pool, gateway: AuthGateway, code: string, codeVerifier: string, locale?: Locale): Promise<AuthResult> {
  const session = await gateway.exchangeCode(code, codeVerifier);
  if (!session) throw new ApiError(400, 'GOOGLE_FAILED', 'L’accesso con Google non è riuscito: riprova.');
  const { userId, profile, ...tokens } = session;
  const email = profile.email.trim().toLowerCase();
  const name = profile.name.trim() || email.split('@')[0] || '';
  await createAccount(pool, { id: userId, email, name, locale: locale ?? DEFAULT_LOCALE });
  await confirmEmail(pool, userId);
  await recordSignIn(pool, userId);
  const account = await findAccount(pool, userId);
  if (!account) throw new Error('account non creato');
  return { ...tokens, account: publicAccount(account) };
}
