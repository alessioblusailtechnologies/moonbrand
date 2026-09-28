import { randomBytes, randomUUID } from 'node:crypto';

import type pg from 'pg';

import type { ChatAttachment, ChatJobInput, ChatTurnCreated, ConversationResponse, ConversationSummary } from '@moonbrand/shared/api/contract';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { insertJob } from '../ai/repository';
import { ATTACHMENTS_DIR, type BrandFiles } from '../brand-files/files';
import { listConversationContents } from '../contents/repository';
import { summarize } from '../contents/service';
import { findBrandForIdeas } from '../ideas/repository';
import { EXTENSIONS, parseImage } from '../media/routes';
import {
  activeJob,
  deleteConversation,
  findConversation,
  insertConversation,
  insertTurn,
  lastSession,
  listConversations,
  listTurns,
} from './repository';

const TITLE_MAX = 80;

// Un messaggio: il testo e le foto già caricate nella cartella del brand. Il testo può mancare se ci sono foto.
export interface ChatMessage {
  message: string;
  attachments: string[];
}

// Il titolo è il primo messaggio, accorciato.
function titleOf({ message }: ChatMessage): string {
  const line = message.replace(/\s+/g, ' ').trim();
  if (!line) return 'Foto allegate';
  return line.length > TITLE_MAX ? `${line.slice(0, TITLE_MAX - 1).trimEnd()}…` : line;
}

// Un turno: il job chat riprende la sessione della conversazione, con il brand com'è adesso.
// Il token è la chiave dei tool per l'API: vale solo per questo job e solo mentre gira.
async function queueTurn(
  db: Queryable,
  identity: Identity,
  conversation: Pick<ConversationSummary, 'id' | 'brandId'>,
  { message, attachments }: ChatMessage,
): Promise<ChatTurnCreated> {
  const brand = await findBrandForIdeas(db, conversation.brandId);
  if (!brand) throw ApiError.notFound('Brand non trovato.');
  const input: ChatJobInput = {
    brandId: conversation.brandId,
    conversationId: conversation.id,
    sessionId: await lastSession(db, conversation.id),
    brand: brand.context,
    message,
    attachments,
  };
  const jobId = await insertJob(db, identity.accountId, 'chat', input, randomBytes(32).toString('base64url'));
  const turnId = await insertTurn(db, { conversationId: conversation.id, accountId: identity.accountId, message, attachments, jobId });
  return { conversationId: conversation.id, turnId, jobId };
}

export function getConversations(pool: pg.Pool, identity: Identity, brandId: string): Promise<ConversationSummary[]> {
  return withIdentity(pool, identity, (db) => listConversations(db, brandId));
}

export function startConversation(pool: pg.Pool, identity: Identity, brandId: string, message: ChatMessage): Promise<ChatTurnCreated> {
  return withIdentity(pool, identity, async (db) => {
    const id = await insertConversation(db, brandId, identity.accountId, titleOf(message));
    return queueTurn(db, identity, { id, brandId }, message);
  });
}

export function sendMessage(pool: pg.Pool, identity: Identity, conversationId: string, message: ChatMessage): Promise<ChatTurnCreated> {
  return withIdentity(pool, identity, async (db) => {
    const conversation = await findConversation(db, conversationId);
    if (!conversation) throw ApiError.notFound('Conversazione non trovata.');
    if (conversation.busy) throw ApiError.conflict('BUSY', 'Sto ancora rispondendo al messaggio di prima.');
    return queueTurn(db, identity, conversation, message);
  });
}

export function getConversation(pool: pg.Pool, files: BrandFiles, identity: Identity, conversationId: string): Promise<ConversationResponse> {
  return withIdentity(pool, identity, async (db) => {
    const conversation = await findConversation(db, conversationId);
    if (!conversation) throw ApiError.notFound('Conversazione non trovata.');
    const [turns, contents] = await Promise.all([listTurns(db, conversationId), listConversationContents(db, conversationId)]);
    return {
      conversation,
      turns: turns.map((turn) => ({ ...turn, attachments: turn.attachments.map((file) => ({ file, url: files.url(conversation.brandId, file) })) })),
      contents: contents.map((content) => summarize(content, files, false)),
    };
  });
}

// Mentre risponde no: i tool del turno in corso salverebbero contenuti in una conversazione che non c'è più.
export function removeConversation(pool: pg.Pool, identity: Identity, conversationId: string): Promise<void> {
  return withIdentity(pool, identity, async (db) => {
    const conversation = await findConversation(db, conversationId);
    if (!conversation) throw ApiError.notFound('Conversazione non trovata.');
    if (conversation.busy) throw ApiError.conflict('BUSY', 'Sto ancora rispondendo: aspetta che finisca per eliminarla.');
    await deleteConversation(db, conversationId);
  });
}

// Una foto per la chat: finisce in allegati/ nella cartella del brand, e il messaggio la cita per percorso.
export async function uploadAttachment(files: BrandFiles, identity: Identity, brandId: string, dataUri: string): Promise<ChatAttachment> {
  const { bytes, mimeType } = parseImage(dataUri);
  await files.claim(brandId, identity.accountId);
  const file = `${ATTACHMENTS_DIR}/${randomUUID()}.${EXTENSIONS[mimeType]}`;
  await files.save(brandId, file, bytes);
  return { file, url: files.url(brandId, file) };
}

// Ferma il turno in corso: se è ancora in coda si chiude subito, altrimenti lo chiude il worker quando vede la richiesta.
// Il ruolo dell'utente non aggiorna i job: la conversazione si controlla con la sua identità, lo stop va col pool.
export async function stopTurn(pool: pg.Pool, identity: Identity, conversationId: string): Promise<void> {
  const jobId = await withIdentity(pool, identity, async (db) => {
    if (!(await findConversation(db, conversationId))) throw ApiError.notFound('Conversazione non trovata.');
    return activeJob(db, conversationId);
  });
  if (!jobId) return;
  await pool.query(
    `update presenza.ai_jobs set cancel_requested = true,
       status = case when status = 'queued' then 'stopped' else status end,
       finished_at = case when status = 'queued' then now() else finished_at end
     where id = $1 and status in ('queued', 'running')`,
    [jobId],
  );
}
