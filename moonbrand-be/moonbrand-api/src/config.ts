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
  API_PORT: z.coerce.number().int().default(3012),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: optional,
  COOKIE_SECURE: flag.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
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
