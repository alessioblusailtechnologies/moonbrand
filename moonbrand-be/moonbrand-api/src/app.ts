import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type pg from 'pg';

import type { Config } from './config';
import { registerErrorHandler } from './errors';
import { registerAiRoutes } from './modules/ai/routes';
import { accountExists } from './modules/auth/accounts';
import type { AuthGateway } from './modules/auth/gateway';
import { registerAuthRoutes } from './modules/auth/routes';
import { registerBrandRoutes } from './modules/brands/routes';
import { registerMediaRoutes } from './modules/media/routes';
import type { MediaStorage } from './modules/media/storage';
import { registerAuth, type VerifyToken } from './plugins/auth';

export interface AppOptions {
  logger: FastifyServerOptions['logger'];
  pool: pg.Pool;
  verifyToken: VerifyToken;
  auth: AuthGateway;
  storage: MediaStorage;
  settings: Pick<Config, 'CORS_ORIGINS' | 'COOKIE_SECURE' | 'COOKIE_SAME_SITE'>;
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
  registerAuth(app, options.verifyToken, (id) => accountExists(options.pool, id));

  app.get('/v1/health', () => ({ ok: true }));
  registerAuthRoutes(app, options.pool, options.auth, options.settings);
  registerBrandRoutes(app, options.pool);
  registerMediaRoutes(app, options.storage);
  registerAiRoutes(app, options.pool);

  return app;
}
