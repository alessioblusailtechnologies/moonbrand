import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import pg from 'pg';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type {
  ChatJobInput,
  ContentEditJobInput,
  ContentJobInput,
  IdeasJobInput,
  VisualEditJobInput,
  VisualJobRequest,
  WebsiteJobRequest,
} from '@moonbrand/shared/api/contract';

import { examplesDir } from './lib/examples';
import { saveContent } from './results/content';
import { saveIdeas } from './results/ideas';
import { withLogo } from './results/website';

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BRANDS_DIR = path.resolve(process.env.BRANDS_DIR || path.join(ROOT, '../../moonbrand-brands'));
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 2;
const POLL_MS = 2000;
const LEASE = '5 minutes';
const HEARTBEAT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const FLUSH_MS = 250;
const CANCEL_POLL_MS = 1000;
const STOP_GRACE_MS = 15_000;

interface Job {
  id: string;
  kind: string;
  input: unknown;
  account_id: string;
  agent_token: string | null;
}

// Ogni tipo di job è uno script autonomo in src/jobs: qui come lanciarlo (env: variabili in più per lo script) e,
// quando il risultato va salvato altrove oltre al job, come salvarlo.
// reply: il job non ha uno schema, il risultato è la risposta finale di Claude.
// finish: completa il risultato prima di salvarlo (per esempio scarica un file che Claude ha indicato).
interface JobKind {
  launch: (input: unknown, job: Job) => { script: string; args: string[]; env?: Record<string, string> };
  finish?: (result: unknown) => Promise<unknown>;
  save?: (job: Job, result: unknown) => Promise<void>;
  reply?: boolean;
}

const JOBS: Record<string, JobKind> = {
  website: { launch: (input) => ({ script: 'src/jobs/website.ts', args: [(input as WebsiteJobRequest).site] }), finish: withLogo },
  visual: {
    launch: (input, job) => {
      const { brandId, brand } = input as VisualJobRequest;
      return { script: 'src/jobs/visual.ts', args: [path.join(BRANDS_DIR, brandId), examplesDir(job.id), JSON.stringify(brand)] };
    },
  },
  'visual-edit': {
    launch: (input) => {
      const { brandId, dir, sessionId, channels, instruction } = input as VisualEditJobInput;
      return { script: 'src/jobs/visual-edit.ts', args: [path.join(BRANDS_DIR, brandId), dir, sessionId, JSON.stringify(channels), instruction] };
    },
  },
  ideas: {
    launch: (input) => {
      const { brandId, ...rest } = input as IdeasJobInput;
      return { script: 'src/jobs/ideas.ts', args: [path.join(BRANDS_DIR, brandId), JSON.stringify(rest)] };
    },
    save: async (job, result) => {
      const saved = await saveIdeas(pool, job.account_id, job.input as IdeasJobInput, result);
      console.log(`[${job.id}] ${saved} idee salvate`);
    },
  },
  content: {
    launch: (input) => {
      const { brandId, ...rest } = input as ContentJobInput;
      return { script: 'src/jobs/content.ts', args: [path.join(BRANDS_DIR, brandId), JSON.stringify(rest)] };
    },
    save: (job, result) => saveContent(pool, BRANDS_DIR, job.input as ContentJobInput, result),
  },
  'content-edit': {
    launch: (input) => {
      const { brandId, ...rest } = input as ContentEditJobInput;
      return { script: 'src/jobs/content-edit.ts', args: [path.join(BRANDS_DIR, brandId), JSON.stringify(rest)] };
    },
    save: (job, result) => saveContent(pool, BRANDS_DIR, job.input as ContentEditJobInput, result),
  },
  // Il token arriva allo script per variabile d'ambiente: i tool della chat lo usano per chiamare l'API.
  chat: {
    launch: (input, job) => {
      const { brandId, ...rest } = input as ChatJobInput;
      return {
        script: 'src/jobs/chat.ts',
        args: [path.join(BRANDS_DIR, brandId), JSON.stringify(rest)],
        env: { MOONBRAND_AGENT_TOKEN: job.agent_token ?? '' },
      };
    },
    reply: true,
  },
};

const url = process.env.DATABASE_URL ?? '';

// Il DB è del worker: gli script dei job (e quindi Claude) non ne ricevono l'indirizzo.
const { DATABASE_URL: _database, ...jobEnv } = process.env;
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }), max: CONCURRENCY + 2 });

const running = new Map<string, ChildProcess>();
let stopping = false;

async function claim(): Promise<Job | null> {
  await pool.query(
    `update presenza.ai_jobs set status = 'failed', error = 'Interrotto troppe volte.', finished_at = now(), locked_until = null
     where status = 'running' and locked_until < now() and attempts >= $1`,
    [MAX_ATTEMPTS],
  );
  const { rows } = await pool.query<Job>(
    `update presenza.ai_jobs set status = 'running', attempts = attempts + 1, started_at = now(), locked_until = now() + $1::interval
     where id = (
       select id from presenza.ai_jobs
       where status = 'queued' or (status = 'running' and locked_until < now())
       order by created_at
       for update skip locked
       limit 1
     )
     returning id, kind, input, account_id, agent_token`,
    [LEASE],
  );
  return rows[0] ?? null;
}

function detailOf(input: Record<string, unknown>): string | undefined {
  const value = input.url ?? input.query ?? input.description ?? input.command ?? input.pattern ?? input.file_path ?? input.title;
  return typeof value === 'string' ? value : undefined;
}

// I job di cui è stato chiesto lo stop: lo script riceve «stop» sullo stdin e ferma Claude;
// se non si chiude da solo entro STOP_GRACE_MS, si termina il processo.
const cancelled = new Set<string>();

async function watchCancellations(): Promise<void> {
  const ids = [...running.keys()].filter((id) => !cancelled.has(id));
  if (ids.length === 0) return;
  const { rows } = await pool.query<{ id: string }>('select id from presenza.ai_jobs where id = any($1) and cancel_requested', [ids]);
  for (const { id } of rows) {
    const child = running.get(id);
    if (!child) continue;
    cancelled.add(id);
    console.log(`[${id}] stop richiesto`);
    child.stdin?.write('stop\n');
    setTimeout(() => child.exitCode === null && child.kill(), STOP_GRACE_MS).unref();
  }
}

async function run(job: Job): Promise<void> {
  const kind = JOBS[job.kind];
  if (!kind) {
    await finish(job.id, { status: 'failed', error: `Tipo di lavoro sconosciuto: ${job.kind}` });
    return;
  }
  const { script, args, env } = kind.launch(job.input, job);
  console.log(`[${job.id}] ${job.kind} avviato`);

  const steps = new Map<string, AiStep>();
  let outcome: { result?: unknown; error?: string; cost?: number } = {};
  // La sessione si sa dal primo messaggio: anche un job fermato a metà si può riprendere.
  let sessionId: string | undefined;

  // Gli step vanno sul DB al massimo ogni FLUSH_MS; saved è l'ultimo salvataggio, da aspettare prima di chiudere il job.
  let flushTimer: NodeJS.Timeout | undefined;
  let saved = Promise.resolve();
  const flush = () => {
    flushTimer = undefined;
    const snapshot = JSON.stringify([...steps.values()]);
    saved = saved
      .then(() => pool.query('update presenza.ai_jobs set steps = $2::jsonb where id = $1', [job.id, snapshot]))
      .then(() => undefined)
      .catch((error: unknown) => console.error(`[${job.id}] steps non salvati`, error));
  };
  const changed = () => (flushTimer ??= setTimeout(flush, FLUSH_MS));

  const heartbeat = setInterval(() => {
    void pool.query(`update presenza.ai_jobs set locked_until = now() + $2::interval where id = $1`, [job.id, LEASE]).catch(() => undefined);
  }, HEARTBEAT_MS);

  const child = spawn(process.execPath, ['--import', 'tsx', script, ...args], { cwd: ROOT, env: { ...jobEnv, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin.on('error', () => undefined);
  running.set(job.id, child);

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));

  // Un blocco di Claude ha la stessa chiave mentre arriva a pezzi (stream_event) e quando è completo (assistant):
  // l'id del messaggio dell'API e la posizione del blocco nel messaggio. Claude Code manda i blocchi di un messaggio
  // uno alla volta, quindi la posizione si conta per id del messaggio.
  const blockCount = new Map<string, number>();
  let streaming: string | undefined;

  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let message: SDKMessage;
    try {
      message = JSON.parse(line) as SDKMessage;
    } catch {
      return;
    }
    if ('session_id' in message && message.session_id) sessionId = message.session_id;
    if (message.type === 'stream_event') {
      if (message.parent_tool_use_id) return;
      const { event } = message;
      if (event.type === 'message_start') {
        streaming = event.message.id;
      } else if (event.type === 'content_block_start' && event.content_block.type === 'text' && streaming) {
        const id = `${streaming}-${event.index}`;
        steps.set(id, { id, label: event.content_block.text, status: 'running', kind: 'text' });
        changed();
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && streaming) {
        const step = steps.get(`${streaming}-${event.index}`);
        if (step) steps.set(step.id, { ...step, label: step.label + event.delta.text });
        changed();
      }
    } else if (message.type === 'assistant') {
      const messageId = message.message.id;
      for (const block of message.message.content) {
        const index = blockCount.get(messageId) ?? 0;
        blockCount.set(messageId, index + 1);
        if (block.type === 'text') {
          const id = `${messageId}-${index}`;
          if (block.text.trim()) steps.set(id, { id, label: block.text.trim(), status: 'done', kind: 'text' });
          else steps.delete(id);
        } else if (block.type === 'tool_use') {
          const detail = detailOf(block.input as Record<string, unknown>);
          steps.set(block.id, { id: block.id, label: block.name, ...(detail && { detail }), status: 'running', kind: 'tool' });
        }
      }
      changed();
    } else if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type !== 'tool_result') continue;
        const step = steps.get(block.tool_use_id);
        if (step) steps.set(step.id, { ...step, status: block.is_error ? 'failed' : 'done' });
      }
      changed();
    } else if (message.type === 'result') {
      outcome = {
        cost: message.total_cost_usd,
        ...(message.subtype === 'success'
          ? { result: kind.reply ? { text: message.result } : message.structured_output }
          : { error: `${message.subtype}: ${message.errors.join('; ')}` }),
      };
    }
  });

  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  running.delete(job.id);
  clearInterval(heartbeat);
  clearTimeout(flushTimer);
  await saved;
  const wasCancelled = cancelled.delete(job.id);
  if (stopping) return;

  for (const step of steps.values()) if (step.status === 'running') steps.set(step.id, { ...step, status: 'done' });
  if (wasCancelled) {
    await finish(job.id, { status: 'stopped', steps: [...steps.values()], cost: outcome.cost, sessionId });
    console.log(`[${job.id}] fermato`);
    return;
  }
  let error = outcome.error ?? (outcome.result === undefined ? `Processo terminato (codice ${code}) senza risultato. ${stderr.trim()}` : undefined);
  if (!error && kind.finish) outcome.result = await kind.finish(outcome.result);
  if (!error && kind.save) {
    error = await kind
      .save(job, outcome.result)
      .then(() => undefined)
      .catch((saveError: unknown) => `Risultato non salvato: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
  }
  await finish(job.id, {
    status: error ? 'failed' : 'done',
    result: outcome.result,
    error,
    steps: [...steps.values()],
    cost: outcome.cost,
    sessionId,
  });
  console.log(`[${job.id}] ${error ? `fallito: ${error}` : 'completato'}${outcome.cost ? ` ($${outcome.cost.toFixed(4)})` : ''}`);
}

async function finish(
  jobId: string,
  fields: { status: 'done' | 'failed' | 'stopped'; result?: unknown; error?: string; steps?: AiStep[]; cost?: number; sessionId?: string },
): Promise<void> {
  await pool.query(
    `update presenza.ai_jobs set status = $2, result = $3::jsonb, error = $4, steps = coalesce($5::jsonb, steps),
       cost_usd = $6, session_id = $7, finished_at = now(), locked_until = null
     where id = $1`,
    [
      jobId,
      fields.status,
      fields.result === undefined ? null : JSON.stringify(fields.result),
      fields.error ?? null,
      fields.steps ? JSON.stringify(fields.steps) : null,
      fields.cost ?? null,
      fields.sessionId ?? null,
    ],
  );
}

async function tick(): Promise<void> {
  while (!stopping && running.size < CONCURRENCY) {
    const job = await claim().catch((error: unknown) => {
      console.error('coda non raggiungibile', error);
      return null;
    });
    if (!job) return;
    void run(job).catch(async (error: unknown) => {
      running.delete(job.id);
      console.error(`[${job.id}] errore del worker`, error);
      await finish(job.id, { status: 'failed', error: String(error) }).catch(() => undefined);
    });
  }
}

const shutdown = async () => {
  stopping = true;
  clearInterval(poller);
  clearInterval(canceller);
  const interrupted = [...running.keys()];
  for (const child of running.values()) child.kill();
  if (interrupted.length > 0) {
    await pool.query(`update presenza.ai_jobs set status = 'queued', locked_until = null where id = any($1)`, [interrupted]);
  }
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const poller = setInterval(() => void tick(), POLL_MS);
const canceller = setInterval(() => void watchCancellations().catch(() => undefined), CANCEL_POLL_MS);
console.log(`worker pronto: ${CONCURRENCY} lavori in parallelo, tipi: ${Object.keys(JOBS).join(', ')}`);
void tick();
