import './env';

import { buildApp } from './app';
import { config } from './config';
import { createPool } from './db/pool';
import { supabaseAuthGateway } from './modules/auth/gateway';
import { supabaseStorage } from './modules/media/storage';
import { supabaseVerifier } from './plugins/auth';

const settings = config();
const pool = createPool(settings.DATABASE_URL);

const app = buildApp({
  logger: { level: settings.LOG_LEVEL },
  pool,
  verifyToken: supabaseVerifier(settings),
  auth: supabaseAuthGateway(settings),
  storage: supabaseStorage(settings),
  settings,
});

const port = Number(process.env.PORT) || settings.API_PORT;

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host: '0.0.0.0' });
