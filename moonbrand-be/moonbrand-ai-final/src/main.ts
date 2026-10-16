import { startWorker } from './worker/worker';

// Il motore AI di moonbrand: un worker che prende i lavori dalla coda sul DB e li fa con Claude Code nella cartella del
// brand. Si avvia con `npm run worker`; la configurazione è nel .env (vedi .env.example).
startWorker();
