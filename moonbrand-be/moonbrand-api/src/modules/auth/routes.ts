import { createHash, randomBytes } from 'node:crypto';

import type { FastifyInstance, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import { PASSWORD_MIN, REFRESH_COOKIE, type Session } from '@moonbrand/shared/api/contract';
import { LOCALES } from '@moonbrand/shared/i18n/locales';

import type { Config } from '../../config';
import { ApiError } from '../../errors';
import type { Mailer } from '../email/mailer';
import { emailLinks } from './email-links';
import type { AuthGateway } from './gateway';
import {
  confirmAccountEmail,
  forgotPassword,
  me,
  resendConfirmation,
  resetPassword,
  signIn,
  signInWithGoogle,
  signUp,
  updateMe,
  type AuthResult,
} from './service';

const email = z.email('Scrivi un indirizzo email valido.').max(320);
const password = z.string().min(PASSWORD_MIN, `La password deve avere almeno ${PASSWORD_MIN} caratteri.`).max(200);

const locale = z.enum(LOCALES);

const signUpSchema = z.object({ name: z.string().trim().min(1, 'Scrivi il tuo nome.').max(200), email, password, locale: locale.optional() });
const updateMeSchema = z.object({ locale });
const signInSchema = z.object({ email, password: z.string().min(1).max(200) });
const token = z.string().trim().min(1).max(500);
const confirmSchema = z.object({ token });
const forgotSchema = z.object({ email });
const resetSchema = z.object({ token, password });
const googleSchema = z.object({ code: token, locale: locale.optional() });

// Il verificatore PKCE dell'accesso con Google, tra la partenza e il ritorno: dieci minuti bastano.
const OAUTH_COOKIE = 'mb_oauth';
const OAUTH_MAX_AGE = 10 * 60;

const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

export function registerAuthRoutes(
  app: FastifyInstance,
  pool: pg.Pool,
  gateway: AuthGateway,
  mailer: Mailer,
  settings: Pick<Config, 'COOKIE_SECURE' | 'COOKIE_SAME_SITE' | 'STUDIO_URL' | 'EMAIL_SECRET' | 'SUPABASE_SERVICE_ROLE_KEY'>,
): void {
  const links = emailLinks(settings.STUDIO_URL, settings.EMAIL_SECRET ?? settings.SUPABASE_SERVICE_ROLE_KEY);
  const mail = { mailer, links, log: app.log };
  const cookieOptions = { httpOnly: true, secure: settings.COOKIE_SECURE, sameSite: settings.COOKIE_SAME_SITE, path: '/v1/auth' } as const;

  const startSession = (reply: FastifyReply, result: AuthResult, status = 200) => {
    reply.setCookie(REFRESH_COOKIE, result.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
    const session: Session = { accessToken: result.accessToken, expiresIn: result.expiresIn, account: result.account };
    return reply.code(status).send(session);
  };

  app.post('/v1/auth/sign-up', async (request, reply) =>
    startSession(reply, await signUp(pool, gateway, mail, signUpSchema.parse(request.body)), 201),
  );

  app.post('/v1/auth/sign-in', async (request, reply) => startSession(reply, await signIn(pool, gateway, signInSchema.parse(request.body))));

  app.post('/v1/auth/refresh', async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE];
    const tokens = token ? await gateway.refresh(token) : null;
    if (!tokens) {
      reply.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw ApiError.unauthenticated('Sessione scaduta: accedi di nuovo.');
    }
    reply.setCookie(REFRESH_COOKIE, tokens.refreshToken, { ...cookieOptions, maxAge: REFRESH_MAX_AGE });
    return { accessToken: tokens.accessToken, expiresIn: tokens.expiresIn };
  });

  app.post('/v1/auth/sign-out', async (request, reply) => {
    const header = request.headers.authorization;
    if (header?.startsWith('Bearer ')) await gateway.signOut(header.slice('Bearer '.length));
    reply.clearCookie(REFRESH_COOKIE, cookieOptions);
    return reply.code(204).send();
  });

  app.post('/v1/auth/email/confirm', async (request, reply) => {
    await confirmAccountEmail(pool, links, confirmSchema.parse(request.body).token);
    return reply.code(204).send();
  });

  app.post('/v1/auth/email/resend', async (request, reply) => {
    await resendConfirmation(pool, mail, request.identity);
    return reply.code(204).send();
  });

  app.post('/v1/auth/password/forgot', async (request, reply) => {
    await forgotPassword(pool, gateway, mail, forgotSchema.parse(request.body).email);
    return reply.code(204).send();
  });

  app.post('/v1/auth/password/reset', async (request, reply) => startSession(reply, await resetPassword(pool, gateway, resetSchema.parse(request.body))));

  // Lo studio apre questo indirizzo nella pagina: si va da Google passando da Supabase, e si torna su /accesso-google.
  app.get('/v1/auth/google', async (_request, reply) => {
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    reply.setCookie(OAUTH_COOKIE, verifier, { ...cookieOptions, maxAge: OAUTH_MAX_AGE });
    return reply.redirect(gateway.googleUrl(new URL('/accesso-google', settings.STUDIO_URL).toString(), challenge));
  });

  app.post('/v1/auth/google/callback', async (request, reply) => {
    const { code, locale: chosen } = googleSchema.parse(request.body);
    const verifier = request.cookies[OAUTH_COOKIE];
    reply.clearCookie(OAUTH_COOKIE, cookieOptions);
    if (!verifier) throw new ApiError(400, 'GOOGLE_FAILED', 'L’accesso con Google è scaduto: riprova.');
    return startSession(reply, await signInWithGoogle(pool, gateway, code, verifier, chosen));
  });

  app.get('/v1/me', (request) => me(pool, request.identity));

  app.patch('/v1/me', (request) => updateMe(pool, request.identity, updateMeSchema.parse(request.body)));
}
