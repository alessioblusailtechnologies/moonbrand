import { createHmac, timingSafeEqual } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { ChannelId } from '@moonbrand/shared/domain/brand';
import { CHANNELS, channelName } from '@moonbrand/shared/domain/catalog';
import type { Locale } from '@moonbrand/shared/i18n/locales';

import type { Config } from '../../config';
import { ApiError } from '../../errors';
import type { Mailer } from '../email/mailer';
import { channelLostEmail } from '../email/templates';

export const ZERNIO_WEBHOOK = '/v1/webhooks/zernio';

// Gli eventi degli account di Zernio (docs.zernio.com/webhooks/accounts). Un social che chiude l'accesso (token
// scaduto o revocato, password cambiata, app tolta) arriva come account.disconnected: il canale del brand diventa da
// ricollegare, i suoi post aspettano e chi ha il brand riceve un'email. Ricollegando lo stesso account Zernio tiene lo
// stesso accountId e manda account.connected: il canale torna a posto da solo, anche se si ricollega dalla dashboard.
// Gli account che scolleghiamo noi (Scollega, un altro account al suo posto) non sono più in nessun brand: si ignorano.
const eventSchema = z.object({
  id: z.string(),
  event: z.string(),
  account: z.object({ accountId: z.string() }).loose().optional(),
});

const CHANNEL_IDS = new Set<string>(CHANNELS.map(({ id }) => id));

interface Lost {
  brand_id: string;
  channel: ChannelId;
  brand_name: string;
  email: string;
  name: string;
  locale: Locale;
}

// Segna da ricollegare i canali con questo account; restituisce solo quelli che non lo erano già, così l'email parte
// una volta anche se Zernio ripete l'evento.
async function markLost(pool: pg.Pool, accountId: string): Promise<Lost[]> {
  const { rows } = await pool.query<Lost>(
    `with hit as (
       select b.id, ch.key as channel
       from presenza.brands b cross join lateral jsonb_each(b.channels) ch
       where ch.value ->> 'accountId' = $1 and coalesce(ch.value ->> 'lost', 'false') <> 'true'
     ), marked as (
       update presenza.brands b set channels = jsonb_set(b.channels, array[hit.channel, 'lost'], 'true'::jsonb)
       from hit where b.id = hit.id
       returning b.id, b.account_id, b.identity ->> 'name' as brand_name, hit.channel
     )
     select m.id as brand_id, m.channel, m.brand_name, a.email, a.name, a.locale
     from marked m join presenza.accounts a on a.id = m.account_id`,
    [accountId],
  );
  return rows.filter((row) => CHANNEL_IDS.has(row.channel));
}

async function clearLost(pool: pg.Pool, accountId: string): Promise<void> {
  await pool.query(
    `with hit as (
       select b.id, ch.key as channel
       from presenza.brands b cross join lateral jsonb_each(b.channels) ch
       where ch.value ->> 'accountId' = $1 and ch.value ? 'lost'
     )
     update presenza.brands b set channels = b.channels #- array[hit.channel, 'lost']
     from hit where b.id = hit.id`,
    [accountId],
  );
}

// La firma di Zernio: HMAC-SHA256 del corpo così com'è arrivato, in esadecimale, con il segreto scelto registrando il webhook.
function signed(body: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(signature.trim().toLowerCase(), 'hex');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function registerZernioWebhook(
  app: FastifyInstance,
  pool: pg.Pool,
  mailer: Mailer,
  settings: Pick<Config, 'ZERNIO_WEBHOOK_SECRET' | 'STUDIO_URL'>,
): void {
  // Il corpo serve intero per la firma: in questo scope il JSON si legge a mano.
  void app.register(async (scope) => {
    scope.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_request, body, done) => done(null, body));

    scope.post(ZERNIO_WEBHOOK, async (request, reply) => {
      const secret = settings.ZERNIO_WEBHOOK_SECRET;
      if (!secret) throw new ApiError(503, 'WEBHOOK_NOT_CONFIGURED', 'Manca ZERNIO_WEBHOOK_SECRET.');
      const body = request.body as Buffer;
      const header = request.headers['x-zernio-signature'] ?? request.headers['x-late-signature'];
      if (!signed(body, Array.isArray(header) ? header[0] : header, secret)) throw ApiError.unauthenticated('Firma non valida.');

      let parsed: z.infer<typeof eventSchema>;
      try {
        parsed = eventSchema.parse(JSON.parse(body.toString('utf8')));
      } catch {
        throw ApiError.invalid('Evento non valido.');
      }
      const accountId = parsed.account?.accountId;
      // Zernio vuole la risposta entro 5 secondi: le email partono dopo.
      if (accountId && parsed.event === 'account.disconnected') {
        const lost = await markLost(pool, accountId);
        request.log.warn({ event: parsed.id, account: accountId, channels: lost.length }, 'social scollegato da Zernio');
        for (const row of lost) {
          const url = new URL('/impostazioni', settings.STUDIO_URL).toString();
          const mail = channelLostEmail(row.locale, row.name, channelName(row.channel), row.brand_name, url);
          mailer.send({ to: row.email, ...mail }, request.log).catch((error: unknown) => request.log.error({ err: error }, 'email del social scollegato non partita'));
        }
      } else if (accountId && parsed.event === 'account.connected') {
        await clearLost(pool, accountId);
      }
      return reply.code(204).send();
    });
  });
}
