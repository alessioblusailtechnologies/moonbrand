import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import pg from 'pg';

import type { AiStep } from '@moonbrand/shared/ai/steps';
import type {
  ContentEditJobInput,
  ContentJobInput,
  IdeasJobInput,
  VisualEditJobInput,
  VisualJobRequest,
  WebsiteJobRequest,
} from '@moonbrand/shared/api/contract';

import { saveContent } from './results/content';
import { saveIdeas } from './results/ideas';

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BRANDS_DIR = path.resolve(process.env.BRANDS_DIR || path.join(ROOT, '../../moonbrand-brands'));
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 2;
const POLL_MS = 2000;
const LEASE = '5 minutes';
const HEARTBEAT_MS = 60_000;
const MAX_ATTEMPTS = 3;

interface Job {
  id: string;
  kind: string;
  input: unknown;
  account_id: string;
}

// Ogni tipo di job è uno script autonomo in src/jobs: qui come lanciarlo e,
// quando il risultato va salvato altrove oltre al job, come salvarlo.
interface JobKind {
  launch: (input: unknown) => { script: string; args: string[] };
  save?: (job: Job, result: unknown) => Promise<void>;
}

const JOBS: Record<string, JobKind> = {
  website: { launch: (input) => ({ script: 'src/jobs/website.ts', args: [(input as WebsiteJobRequest).site] }) },
  visual: {
    launch: (input) => {
      const { brandId, brand } = input as VisualJobRequest;
      return { script: 'src/jobs/visual.ts', args: [path.join(BRANDS_DIR, brandId), JSON.stringify(brand)] };
    },
  },
  'visual-edit': {
    launch: (input) => {
      const { brandId, sessionId, channels, instruction } = input as VisualEditJobInput;
      return { script: 'src/jobs/visual-edit.ts', args: [path.join(BRANDS_DIR, brandId), sessionId, JSON.stringify(channels), instruction] };
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
     returning id, kind, input, account_id`,
    [LEASE],
  );
  return rows[0] ?? null;
}

function detailOf(input: Record<string, unknown>): string | undefined {
  const value = input.url ?? input.query ?? input.description ?? input.command ?? input.pattern ?? input.file_path;
  return typeof value === 'string' ? value : undefined;
}

async function run(job: Job): Promise<void> {
  const kind = JOBS[job.kind];
  if (!kind) {
    await finish(job.id, { status: 'failed', error: `Tipo di lavoro sconosciuto: ${job.kind}` });
    return;
  }
  const { script, args } = kind.launch(job.input);
  console.log(`[${job.id}] ${job.kind} avviato`);

  const steps = new Map<string, AiStep>();
  let outcome: { result?: unknown; error?: string; cost?: number; sessionId?: string } = {};

  let flushTimer: NodeJS.Timeout | undefined;
  const flush = () => {
    flushTimer = undefined;
    void pool
      .query('update presenza.ai_jobs set steps = $2::jsonb where id = $1', [job.id, JSON.stringify([...steps.values()])])
      .catch((error: unknown) => console.error(`[${job.id}] steps non salvati`, error));
  };
  const changed = () => (flushTimer ??= setTimeout(flush, 300));

  const heartbeat = setInterval(() => {
    void pool.query(`update presenza.ai_jobs set locked_until = now() + $2::interval where id = $1`, [job.id, LEASE]).catch(() => undefined);
  }, HEARTBEAT_MS);

  const child = spawn(process.execPath, ['--import', 'tsx', script, ...args], { cwd: ROOT, env: jobEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  running.set(job.id, child);

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));

  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let message: SDKMessage;
    try {
      message = JSON.parse(line) as SDKMessage;
    } catch {
      return;
    }
    if (message.type === 'assistant') {
      message.message.content.forEach((block, index) => {
        if (block.type === 'text' && block.text.trim()) {
          steps.set(`${message.uuid}-${index}`, { id: `${message.uuid}-${index}`, label: block.text.trim(), status: 'done' });
        } else if (block.type === 'tool_use') {
          const detail = detailOf(block.input as Record<string, unknown>);
          steps.set(block.id, { id: block.id, label: block.name, ...(detail && { detail }), status: 'running' });
        }
      });
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
        sessionId: message.session_id,
        ...(message.subtype === 'success'
          ? { result: message.structured_output }
          : { error: `${message.subtype}: ${message.errors.join('; ')}` }),
      };
    }
  });

  const code = await new Promise<number | null>((resolve) => child.on('close', resolve));
  running.delete(job.id);
  clearInterval(heartbeat);
  clearTimeout(flushTimer);
  if (stopping) return;

  for (const step of steps.values()) if (step.status === 'running') steps.set(step.id, { ...step, status: 'done' });
  let error = outcome.error ?? (outcome.result === undefined ? `Processo terminato (codice ${code}) senza risultato. ${stderr.trim()}` : undefined);
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
    sessionId: outcome.sessionId,
  });
  console.log(`[${job.id}] ${error ? `fallito: ${error}` : 'completato'}${outcome.cost ? ` ($${outcome.cost.toFixed(4)})` : ''}`);
}

async function finish(
  jobId: string,
  fields: { status: 'done' | 'failed'; result?: unknown; error?: string; steps?: AiStep[]; cost?: number; sessionId?: string },
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
console.log(`worker pronto: ${CONCURRENCY} lavori in parallelo, tipi: ${Object.keys(JOBS).join(', ')}`);
void tick();
