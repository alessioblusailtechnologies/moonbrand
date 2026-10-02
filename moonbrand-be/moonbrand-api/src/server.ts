import './env';

import { buildApp } from './app';
import { config } from './config';
import { createPool } from './db/pool';
import { supabaseAuthGateway } from './modules/auth/gateway';
import { localBrandFiles } from './modules/brand-files/files';
import { supabaseStorage } from './modules/media/storage';
import { schedulePublishing } from './modules/social/publisher';
import { scheduleMorningWelcome } from './modules/welcome/service';
import { supabaseVerifier } from './plugins/auth';

const settings = config();
const pool = createPool(settings.DATABASE_URL);
const files = localBrandFiles(pool, settings);

const app = buildApp({
  logger: { level: settings.LOG_LEVEL },
  pool,
  verifyToken: supabaseVerifier(settings),
  auth: supabaseAuthGateway(settings),
  storage: supabaseStorage(settings),
  files,
  settings,
});

const port = Number(process.env.PORT) || settings.API_PORT;

const stopMorningWelcome = scheduleMorningWelcome(pool, app.log);
// La pubblicazione vera, con Zernio: all'ora dell'uscita il contenuto approvato esce sui canali collegati.
const stopPublishing = schedulePublishing(pool, files, settings.ZERNIO_API_KEY, app.log);

const shutdown = async () => {
  stopMorningWelcome();
  stopPublishing();
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host: '0.0.0.0' });
