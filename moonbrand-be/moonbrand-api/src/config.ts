import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { z } from 'zod';

const optional = z.preprocess((value) => (value === '' ? undefined : value), z.string().min(1).optional());
const flag = z.preprocess((value) => value === 'true' || value === '1', z.boolean());

const schema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: optional,
  DATABASE_URL: z.string().min(1),
  MEDIA_BUCKET: z.string().min(1).default('presenza-media'),
  BRANDS_DIR: optional,
  // Dove il worker su questa macchina tiene le sessioni di Claude Code (senza S3): come CLAUDE_CONFIG_DIR del worker.
  CLAUDE_CONFIG_DIR: optional,
  // I file dei brand su Supabase Storage, con il protocollo S3: senza chiavi restano sul disco, in BRANDS_DIR.
  S3_ENDPOINT: optional,
  S3_REGION: z.string().min(1).default('eu-north-1'),
  S3_ACCESS_KEY_ID: optional,
  S3_SECRET_ACCESS_KEY: optional,
  // In alternativa alle chiavi S3: S3_ACCESS_KEY_ID = id del progetto, S3_SECRET_ACCESS_KEY = anon key e qui la service role.
  S3_SESSION_TOKEN: optional,
  BRANDS_BUCKET: z.string().min(1).default('presenza-brands'),
  FILES_SECRET: optional,
  API_PORT: z.coerce.number().int().default(3012),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: optional,
  COOKIE_SECURE: flag.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  // La dettatura nella casella dell'assistente, con Voxtral di Mistral: senza chiave il microfono dice che non è configurato.
  MISTRAL_API_KEY: optional,
  TRANSCRIPTION_MODEL: z.string().min(1).default('voxtral-mini-latest'),
  // Il collegamento dei social dei brand, con Zernio: senza chiave Collega dice che non è configurato.
  ZERNIO_API_KEY: optional,
  // Il segreto del webhook registrato su Zernio (POST /v1/webhooks/zernio, eventi account.*): dice quando un social chiude
  // l'accesso. Senza, il webhook risponde 503 e un canale scollegato si scopre solo quando un post fallisce.
  ZERNIO_WEBHOOK_SECRET: optional,
  // Dodo Payments, il venditore: la chiave API (catalogo, checkout, cambio di piano, portale, rimborsi) e la chiave di firma
  // dei webhook (POST /v1/webhooks/dodo: abbonamenti e crediti pagati), in modalità test o live (DODO_PAYMENTS_ENV). Senza
  // chiave API lo studio dice che i pagamenti non sono disponibili; senza chiave di firma il webhook risponde 503 e Dodo
  // ripete gli eventi finché non arriva.
  DODO_PAYMENTS_API_KEY: optional,
  DODO_PAYMENTS_WEBHOOK_KEY: optional,
  DODO_PAYMENTS_ENV: z.enum(['test_mode', 'live_mode']).default('test_mode'),
  // Il blocco dei lavori a pagamento per i brand senza piano attivo o senza crediti. Spento: si conta soltanto.
  BILLING_ENFORCED: flag.default(false),
  // Le origini di studio (es. https://moonbrand.app) dove si torna dopo aver collegato un social; vuoto: qualsiasi http(s).
  STUDIO_ORIGINS: optional,
  // Solo negli ambienti di prova, mai in produzione: i canali si possono «collegare» per finta e i loro post risultano
  // pubblicati senza passare da Zernio.
  SIMULATE_SOCIAL: flag.default(false),
  // Le email (benvenuto, conferma, nuova password) con Resend: senza chiave non partono e il link finisce nel log.
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().min(1).default('Moonbrand <ciao@moonbrand.app>'),
  // Dove portano i link delle email.
  STUDIO_URL: z.url().default('http://localhost:4200'),
  // La firma dei link di conferma; vuoto: la service role, come per i link dei file.
  EMAIL_SECRET: optional,
  // Le email che aprono /admin nello studio (utenze, consumi, lavori), separate da virgola; vuoto: nessuno.
  ADMIN_EMAILS: optional,
  // Le utenze con il piano Ultra in omaggio (niente pagamento, i crediti del piano ogni mese su ogni brand), separate da
  // virgola; vuoto: nessuna.
  FREE_ULTRA_EMAILS: optional,
  // Il codice del worker (moonbrand-ai), da cui la sezione Prompt dell'admin legge i prompt; vuoto: quello accanto all'API.
  AI_DIR: optional,
  // Il motore che prende i job: v2 (moonbrand-ai-v2) ha un onboarding senza template, font, esempi e progetto video.
  AI_ENGINE: z.enum(['v1', 'v2']).default('v1'),
  // La cartella del worker che gira davvero, se non è quella di AI_ENGINE (il v3 prende i job del v2), per la versione
  // mostrata nello studio; vuoto: quella di AI_ENGINE.
  AI_WORKER_DIR: optional,
});

export type Config = z.infer<typeof schema>;

let cache: Config | undefined;

export function config(): Config {
  if (!cache) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
      throw new Error(`Configurazione non valida: ${fields}`);
    }
    cache = parsed.data;
  }
  return cache;
}

// Stessa profondità di dist/server.mjs: il default resta moonbrand/moonbrand-brands anche dopo la build.
export function brandsDir(settings: Pick<Config, 'BRANDS_DIR'>): string {
  return path.resolve(settings.BRANDS_DIR ?? fileURLToPath(new URL('../../../moonbrand-brands', import.meta.url)));
}

export function aiDir(settings: Pick<Config, 'AI_DIR'>): string {
  return path.resolve(settings.AI_DIR ?? fileURLToPath(new URL('../../moonbrand-ai', import.meta.url)));
}

export function adminEmails(settings: Pick<Config, 'ADMIN_EMAILS'>): Set<string> {
  return new Set((settings.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean));
}
