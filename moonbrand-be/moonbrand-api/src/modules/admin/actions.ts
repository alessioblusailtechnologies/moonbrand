import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import { PASSWORD_MIN, type AdminAccount, type AdminAddCreditsRequest, type AdminCreateAccountRequest } from '@moonbrand/shared/api/contract';
import { DEFAULT_LOCALE } from '@moonbrand/shared/i18n/locales';

import { ApiError } from '../../errors';
import { confirmEmail, createAccount } from '../auth/accounts';
import type { AuthGateway } from '../auth/gateway';
import { ACCOUNT_SELECT, toAccount, type AccountRow } from './queries';

// Le azioni dell'admin: un'utenza nuova già confermata (entra subito con la password, senza email), e crediti in più a
// un brand per il mese in corso.

const createSchema = z.object({
  email: z.email('Scrivi un indirizzo email valido.').max(320),
  name: z.string().trim().min(1, 'Scrivi il nome.').max(200),
  password: z.string().min(PASSWORD_MIN, `La password deve avere almeno ${PASSWORD_MIN} caratteri.`).max(200),
}) satisfies z.ZodType<AdminCreateAccountRequest>;

const creditsSchema = z.object({
  amount: z.number().int('Solo crediti interi.').min(1, 'Almeno 1 credito.').max(100_000, 'Al massimo 100.000 crediti alla volta.'),
}) satisfies z.ZodType<AdminAddCreditsRequest>;

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });

export function registerAdminActions(scope: FastifyInstance, pool: pg.Pool, gateway: AuthGateway): void {
  scope.post('/v1/admin/accounts', async (request, reply) => {
    const input = createSchema.parse(request.body);
    const email = input.email.trim().toLowerCase();
    // Supabase la crea con l'email già confermata (createUser con email_confirm).
    const created = await gateway.createUser(email, input.password);
    if (!created) throw ApiError.conflict('EMAIL_TAKEN', 'Questa email è già registrata.');
    await createAccount(pool, { id: created.id, email, name: input.name, locale: DEFAULT_LOCALE });
    await confirmEmail(pool, created.id);
    const { rows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} where a.id = $1`, [created.id]);
    const account: AdminAccount = toAccount(rows[0]!);
    request.log.info({ admin: request.identity.accountId, account: created.id }, 'utenza creata dall’admin');
    return reply.code(201).send(account);
  });

  // Un movimento topup sul brand: vale nel mese in cui si aggiunge (vedi /v1/credits).
  scope.post('/v1/admin/brands/:brandId/credits', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const { amount } = creditsSchema.parse(request.body);
    const { rowCount } = await pool.query(
      `insert into presenza.credit_movements (account_id, brand_id, amount, kind)
       select b.account_id, b.id, $2, 'topup' from presenza.brands b where b.id = $1`,
      [brandId, amount],
    );
    if (rowCount === 0) throw ApiError.notFound('Brand non trovato.');
    request.log.info({ admin: request.identity.accountId, brand: brandId, amount }, 'crediti aggiunti dall’admin');
    return reply.code(204).send();
  });
}
