import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AdminModelSettings, AdminModelSettingsRequest } from '@moonbrand/shared/api/contract';
import { mergeModelSettings, THINKING_LEVELS, type ModelCatalog, type ModelSettingsPatch } from '@moonbrand/shared/domain/models';

// La sezione Modelli dell'admin: quale modello e quanto ragionamento usano la chat e gli strumenti del motore. Stanno in
// presenza.settings (chiave models) sopra i predefiniti condivisi (domain/models); il worker li legge a ogni lavoro, quindi
// valgono dal turno di chat dopo, senza riavvii. Il nome del modello non si controlla qui: se non esiste, il lavoro
// fallisce e lo dice.

const KEY = 'models';
// Il catalogo dei modelli tra cui scegliere, scritto dal worker del motore (moonbrand-ai-v4/src/lib/catalog.ts).
const CATALOG_KEY = 'models.catalog';

const model = z.string().trim().min(1, 'Scrivi il modello.').max(120);
const thinking = z.enum(THINKING_LEVELS);
const choice = z.object({ model, thinking: thinking.optional() });

const schema = z.object({
  chat: z.object({
    model: model.regex(/^[\w.-]+\/[\w.:-]+$/, 'Il modello della chat è fornitore/modello, come anthropic/claude-opus-5-5.'),
    thinking,
  }),
  tools: z.object({ testi: choice, immagini: choice, vista: choice, ricerca: choice, voce: choice, musica: choice }),
}) satisfies z.ZodType<AdminModelSettingsRequest>;

interface Row {
  key: string;
  value: unknown;
  updated_at: Date;
  email: string | null;
}

async function current(pool: pg.Pool): Promise<AdminModelSettings> {
  const { rows } = await pool.query<Row>(
    `select s.key, s.value, s.updated_at, a.email from presenza.settings s
     left join presenza.accounts a on a.id = s.updated_by
     where s.key = any($1)`,
    [[KEY, CATALOG_KEY]],
  );
  const own = rows.find((row) => row.key === KEY);
  const catalog = rows.find((row) => row.key === CATALOG_KEY);
  return {
    settings: mergeModelSettings(own?.value as ModelSettingsPatch | undefined),
    updatedAt: own?.updated_at.toISOString() ?? null,
    updatedBy: own?.email ?? null,
    catalog: (catalog?.value as ModelCatalog | undefined) ?? null,
    catalogAt: catalog?.updated_at.toISOString() ?? null,
  };
}

export function registerAdminSettings(scope: FastifyInstance, pool: pg.Pool): void {
  scope.get('/v1/admin/models', (): Promise<AdminModelSettings> => current(pool));

  scope.put('/v1/admin/models', async (request): Promise<AdminModelSettings> => {
    // Il merge toglie il ragionamento agli strumenti che non ragionano e completa quello che manca.
    const settings = mergeModelSettings(schema.parse(request.body));
    await pool.query(
      `insert into presenza.settings (key, value, updated_at, updated_by) values ($1, $2, now(), $3)
       on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
      [KEY, JSON.stringify(settings), request.identity.accountId],
    );
    request.log.info({ admin: request.identity.accountId, settings }, 'modelli cambiati dall’admin');
    return current(pool);
  });
}
