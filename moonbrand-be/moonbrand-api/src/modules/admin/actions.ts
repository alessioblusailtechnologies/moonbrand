import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import {
  PASSWORD_MIN,
  type AdminAccount,
  type AdminAddCreditsRequest,
  type AdminCreateAccountRequest,
  type AdminEngineRequest,
  type StyleJobInput,
} from '@moonbrand/shared/api/contract';
import { DEFAULT_LOCALE } from '@moonbrand/shared/i18n/locales';

import { ApiError } from '../../errors';
import { insertJob } from '../ai/repository';
import { confirmEmail, createAccount } from '../auth/accounts';
import type { AuthGateway } from '../auth/gateway';
import { ACCOUNT_SELECT, toAccount, type AccountRow } from './queries';

// Le azioni dell'admin: un'utenza nuova già confermata (entra subito con la password, senza email), e crediti in più a
// un brand per il mese in corso, e il cambio di motore AI di un account.

const createSchema = z.object({
  email: z.email('Scrivi un indirizzo email valido.').max(320),
  name: z.string().trim().min(1, 'Scrivi il nome.').max(200),
  password: z.string().min(PASSWORD_MIN, `La password deve avere almeno ${PASSWORD_MIN} caratteri.`).max(200),
}) satisfies z.ZodType<AdminCreateAccountRequest>;

const creditsSchema = z.object({
  amount: z.number().int('Solo crediti interi.').min(1, 'Almeno 1 credito.').max(100_000, 'Al massimo 100.000 crediti alla volta.'),
}) satisfies z.ZodType<AdminAddCreditsRequest>;

const engineSchema = z.object({ engine: z.enum(['v1', 'v2']) }) satisfies z.ZodType<AdminEngineRequest>;

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const accountParams = z.object({ accountId: z.uuid('Utenza non trovata.') });

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

  // Il motore AI dell'account. Si cambia solo a lavori fermi: un job già in coda lo prenderebbe il motore di prima. I
  // brand si staccano dal worker che li aveva (brand_workers) e per ognuno parte il job che sistema la cartella, sempre
  // sul worker v2: verso v2 mette la roba della v1 in v1/ e prepara la cartella, verso v1 la rimette com'era.
  scope.post('/v1/admin/accounts/:accountId/engine', async (request): Promise<AdminAccount> => {
    const { accountId } = accountParams.parse(request.params);
    const { engine } = engineSchema.parse(request.body);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const { rows } = await client.query<{ ai_engine: string }>('select ai_engine from presenza.accounts where id = $1 for update', [accountId]);
      if (!rows[0]) throw ApiError.notFound('Utenza non trovata.');
      if (rows[0].ai_engine === engine) throw ApiError.conflict('SAME_ENGINE', 'L’utenza è già su questo motore.');
      const busy = await client.query("select 1 from presenza.ai_jobs where account_id = $1 and status in ('queued', 'running') limit 1", [accountId]);
      if ((busy.rowCount ?? 0) > 0) throw ApiError.conflict('JOBS_RUNNING', 'L’utenza ha lavori in corso: riprova quando sono finiti.');
      await client.query('update presenza.accounts set ai_engine = $2 where id = $1', [accountId, engine]);
      const brands = await client.query<{ id: string }>('select id from presenza.brands where account_id = $1', [accountId]);
      const ids = brands.rows.map((brand) => brand.id);
      await client.query('delete from presenza.brand_workers where brand_id = any($1::text[])', [ids]);
      for (const brandId of ids) {
        const input: StyleJobInput = { brandId, migrate: engine };
        await insertJob(client, accountId, 'style', input, { free: true, engine: 'v2' });
      }
      await client.query('commit');
      request.log.info({ admin: request.identity.accountId, account: accountId, engine, brands: ids.length }, 'motore cambiato dall’admin');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
    const { rows } = await pool.query<AccountRow>(`${ACCOUNT_SELECT} where a.id = $1`, [accountId]);
    return toAccount(rows[0]!);
  });
}
