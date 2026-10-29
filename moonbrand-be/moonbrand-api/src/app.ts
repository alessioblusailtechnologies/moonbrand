import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type pg from 'pg';

import type { Config } from './config';
import { registerErrorHandler } from './errors';
import { readVersions } from './version';
import { adminCheck } from './modules/admin/queries';
import { registerAdminRoutes } from './modules/admin/routes';
import { registerAgentRoutes } from './modules/agent/routes';
import { registerAiRoutes } from './modules/ai/routes';
import { accountExists } from './modules/auth/accounts';
import type { AuthGateway } from './modules/auth/gateway';
import { registerAuthRoutes } from './modules/auth/routes';
import type { BrandFiles } from './modules/brand-files/files';
import type { Mailer } from './modules/email/mailer';
import { DodoApi } from './modules/billing/dodo-api';
import { registerDodoWebhook } from './modules/billing/dodo-webhook';
import { setAiEngine } from './modules/ai/engine';
import { setFreeUltraEmails } from './modules/billing/free-plan';
import { registerBillingRoutes } from './modules/billing/routes';
import { registerBrandFileRoutes } from './modules/brand-files/routes';
import { registerBrandRoutes } from './modules/brands/routes';
import { registerContentRoutes } from './modules/contents/routes';
import { registerConversationRoutes } from './modules/conversations/routes';
import { enforceBilling } from './modules/credits/balance';
import { registerCreditRoutes } from './modules/credits/routes';
import { registerIdeaRoutes } from './modules/ideas/routes';
import { registerMediaRoutes } from './modules/media/routes';
import { registerOnboardingRoutes } from './modules/onboarding/drafts';
import { registerPlanRoutes } from './modules/plan/routes';
import { registerSocialRoutes } from './modules/social/routes';
import { registerZernioWebhook } from './modules/social/webhooks';
import { registerTranscriptionRoutes } from './modules/transcription/routes';
import { registerWelcomeRoutes } from './modules/welcome/routes';
import type { MediaStorage } from './modules/media/storage';
import { registerAuth, type VerifyToken } from './plugins/auth';

export interface AppOptions {
  logger: FastifyServerOptions['logger'];
  pool: pg.Pool;
  verifyToken: VerifyToken;
  auth: AuthGateway;
  storage: MediaStorage;
  files: BrandFiles;
  mailer: Mailer;
  settings: Pick<
    Config,
    | 'CORS_ORIGINS'
    | 'COOKIE_SECURE'
    | 'COOKIE_SAME_SITE'
    | 'MISTRAL_API_KEY'
    | 'TRANSCRIPTION_MODEL'
    | 'ZERNIO_API_KEY'
    | 'ZERNIO_WEBHOOK_SECRET'
    | 'DODO_PAYMENTS_API_KEY'
    | 'DODO_PAYMENTS_WEBHOOK_KEY'
    | 'DODO_PAYMENTS_ENV'
    | 'BILLING_ENFORCED'
    | 'STUDIO_ORIGINS'
    | 'SIMULATE_SOCIAL'
    | 'STUDIO_URL'
    | 'EMAIL_SECRET'
    | 'SUPABASE_SERVICE_ROLE_KEY'
    | 'ADMIN_EMAILS'
    | 'FREE_ULTRA_EMAILS'
    | 'AI_DIR'
    | 'AI_ENGINE'
    | 'AI_WORKER_DIR'
  >;
}

export function buildApp(options: AppOptions) {
  const app = Fastify({ logger: options.logger, bodyLimit: 6 * 1024 * 1024 });

  const origins = (options.settings.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    void app.register(cors, { origin: origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] });
  }
  void app.register(cookie);

  registerErrorHandler(app);
  registerAuth(app, options.verifyToken, (id) => accountExists(options.pool, id), adminCheck(options.pool, options.settings));

  app.get('/v1/health', () => ({ ok: true }));
  const versions = readVersions(options.settings);
  app.get('/v1/version', () => versions);
  registerAuthRoutes(app, options.pool, options.auth, options.mailer, options.settings);
  enforceBilling(options.settings.BILLING_ENFORCED);
  setFreeUltraEmails(options.settings);
  setAiEngine(options.settings);
  const dodo = new DodoApi(options.settings);
  registerBrandRoutes(app, options.pool, options.files, options.storage, options.settings, dodo);
  registerBrandFileRoutes(app, options.files);
  registerMediaRoutes(app, options.storage);
  registerAiRoutes(app, options.pool, options.files);
  registerIdeaRoutes(app, options.pool);
  registerContentRoutes(app, options.pool, options.files);
  registerConversationRoutes(app, options.pool, options.files);
  registerPlanRoutes(app, options.pool, options.files);
  registerTranscriptionRoutes(app, options.pool, options.settings);
  registerSocialRoutes(app, options.pool, options.files, options.settings);
  registerZernioWebhook(app, options.pool, options.mailer, options.settings);
  registerDodoWebhook(app, options.pool, dodo, options.settings);
  registerBillingRoutes(app, options.pool, dodo, options.settings);
  registerWelcomeRoutes(app, options.pool);
  registerOnboardingRoutes(app, options.pool);
  registerCreditRoutes(app, options.pool);
  registerAdminRoutes(app, options.pool, options.files, options.auth, options.settings);
  void app.register(async (scope) => registerAgentRoutes(scope, options.pool, options.files));

  return app;
}
