import type { Readable } from 'node:stream';

import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

import type { AgentVoiceRequest, VoiceLibraryAddRequest, VoiceLibraryResponse, VoicesResponse, VoiceUpdateRequest } from '@moonbrand/shared/api/contract';
import type { BrandVoice } from '@moonbrand/shared/domain/voice';

import { withIdentity, type Identity } from '../../db/identity';
import { ApiError } from '../../errors';
import { RELATIVE_PATH, type BrandFiles } from '../brand-files/files';
import { withMp3, type Run, type VoiceService } from './service';

const brandParams = z.object({ brandId: z.uuid('Brand non trovato.') });
const voiceParams = brandParams.extend({ voiceId: z.uuid('Voce non trovata.') });
const name = z.string().trim().min(1, 'Dai un nome alla voce.').max(60, 'Al massimo 60 caratteri.');

const searchQuery = z.object({
  q: z.string().trim().max(80).optional(),
  language: z.string().regex(/^[a-z]{2}$/).optional(),
  gender: z.enum(['male', 'female', 'neutral']).optional(),
});

const libraryBody = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9]{8,40}$/, 'Voce non valida.'),
  name,
  language: z.string().max(20).nullish(),
  description: z.string().max(300).nullish(),
  previewUrl: z.url({ protocol: /^https$/ }).max(1000).nullish(),
}) satisfies z.ZodType<VoiceLibraryAddRequest>;

const updateBody = z.object({ name: name.optional(), isDefault: z.literal(true).optional() }) satisfies z.ZodType<VoiceUpdateRequest>;

const cloneQuery = z.object({
  name,
  consent: z.literal('1', { error: 'Conferma di avere il diritto di usare questa voce.' }),
});

const agentBody = z.object({
  file: z.string().regex(RELATIVE_PATH, 'Il file deve essere nella cartella del brand, es. allegati/voce.mp3.'),
  name,
  consent: z.literal(true, { error: 'Prima chiedi all’utente se ha il diritto di usare questa voce.' }),
}) satisfies z.ZodType<AgentVoiceRequest>;

// Le voci del brand dallo studio (Impostazioni → Voci): il brand deve essere dell'utente, tutto con la sua identità.
export function registerVoiceRoutes(app: FastifyInstance, pool: pg.Pool, voices: VoiceService): void {
  const runFor = (identity: Identity): Run => (fn) => withIdentity(pool, identity, fn);

  const own = async (identity: Identity, brandId: string) => {
    const { rows } = await withIdentity(pool, identity, (db) => db.query('select 1 from presenza.brands where id = $1', [brandId]));
    if (rows.length === 0) throw ApiError.notFound('Brand non trovato.');
    return { accountId: identity.accountId, brandId };
  };

  app.get('/v1/brands/:brandId/voices', async (request): Promise<VoicesResponse> => {
    const { brandId } = brandParams.parse(request.params);
    await own(request.identity, brandId);
    return voices.list(runFor(request.identity), brandId);
  });

  app.get('/v1/voices/library', async (request): Promise<VoiceLibraryResponse> => {
    const { q, language, gender } = searchQuery.parse(request.query);
    return { voices: await voices.search({ query: q, language, gender }) };
  });

  app.post('/v1/brands/:brandId/voices/library', async (request, reply) => {
    const { brandId } = brandParams.parse(request.params);
    const owner = await own(request.identity, brandId);
    const voice: BrandVoice = await voices.addLibrary(runFor(request.identity), owner, libraryBody.parse(request.body));
    return reply.code(201).send(voice);
  });

  // L'audio arriva così com'è (file o registrazione del browser), non in JSON; nome e consenso nella query.
  void app.register(async (scope) => {
    scope.addContentTypeParser('*', (_request, payload, done) => done(null, payload));
    scope.post('/v1/brands/:brandId/voices/clone', async (request, reply) => {
      const { brandId } = brandParams.parse(request.params);
      const { name: voiceName } = cloneQuery.parse(request.query);
      const owner = await own(request.identity, brandId);
      const voice = await withMp3({ stream: request.body as Readable }, (mp3, seconds) =>
        voices.clone(runFor(request.identity), owner, voiceName, mp3, seconds),
      );
      return reply.code(201).send(voice);
    });
  });

  app.patch('/v1/brands/:brandId/voices/:voiceId', async (request): Promise<BrandVoice> => {
    const { brandId, voiceId } = voiceParams.parse(request.params);
    await own(request.identity, brandId);
    return voices.update(runFor(request.identity), brandId, voiceId, updateBody.parse(request.body));
  });

  app.delete('/v1/brands/:brandId/voices/:voiceId', async (request, reply) => {
    const { brandId, voiceId } = voiceParams.parse(request.params);
    await own(request.identity, brandId);
    await voices.remove(runFor(request.identity), brandId, voiceId);
    return reply.code(204).send();
  });
}

// I tool della chat (voci_brand, salva_voce), dentro le rotte del job: il token dice account e brand.
export function registerAgentVoiceRoutes(app: FastifyInstance, pool: pg.Pool, files: BrandFiles, voices: VoiceService): void {
  const run: Run = (fn) => fn(pool);

  app.get('/v1/agent/voices', (request) => voices.list(run, request.agent.brandId));

  app.post('/v1/agent/voices', async (request, reply) => {
    const parsed = agentBody.safeParse(request.body);
    if (!parsed.success) throw ApiError.invalid(z.prettifyError(parsed.error));
    const { accountId, brandId } = request.agent;
    const bytes = await files.read(brandId, parsed.data.file).catch(() => {
      throw ApiError.notFound(`Non trovo ${parsed.data.file} nella cartella del brand.`);
    });
    const voice = await withMp3({ bytes: new Uint8Array(bytes) }, (mp3, seconds) => voices.clone(run, { accountId, brandId }, parsed.data.name, mp3, seconds));
    return reply.code(201).send(voice);
  });
}
