import { spawn, type ChildProcess } from 'node:child_process';
import { hostname } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import pg from 'pg';

import { toolStep, type AiStep } from '@moonbrand/shared/ai/steps';
import type { ChatJobInput, IdeasJobInput, StyleJobInput, WebsiteJobRequest } from '@moonbrand/shared/api/contract';
import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import { withLogo } from './jobs/brand/logo';
import type { FolderBrand } from './jobs/cartella/cartella';
import { saveIdeas } from './jobs/ideas/save';
import { writeBrandLogo } from './lib/brand-logo';
import { pullBrand, pushBrand } from './lib/brand-sync';
import { estimatesEnv, measureEstimates } from './lib/estimate';
import { startProxy, type Usage } from './lib/proxy';
import { createStepReader } from './lib/step-reader';

// Il motore v2: l'onboarding e la chat. La coda è la stessa di moonbrand-ai (presenza.ai_jobs), con gli stessi tipi
// di job che mette in coda l'API, quindi per provarlo basta far girare questo worker al posto dell'altro.

process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)));

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BRANDS_DIR = path.resolve(process.env.BRANDS_DIR || path.join(ROOT, '../../moonbrand-brands'));
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 2;
// Il nome di questo worker in presenza.brand_workers: deve restare lo stesso tra un riavvio e l'altro.
const WORKER_ID = process.env.WORKER_ID || hostname();
const POLL_MS = 2000;
const LEASE = '5 minutes';
const HEARTBEAT_MS = 60_000;
const MAX_ATTEMPTS = 3;
const FLUSH_MS = 250;
const CANCEL_POLL_MS = 1000;
const STOP_GRACE_MS = 15_000;
// Quanto si aspettano, a job finito, le letture degli step ancora in corso.
const READ_GRACE_MS = 3000;

interface Job {
  id: string;
  kind: string;
  input: unknown;
  account_id: string;
  locale: Locale;
  agent_token: string | null;
}

// Ogni tipo di job è uno script in src/jobs: qui come lanciarlo e, quando serve, come completare e salvare il risultato.
// folder: il job lavora nella cartella del brand, che arriva dallo storage prima e ci torna dopo (con le sessioni).
// reply: il job non ha uno schema, il risultato è la risposta finale di Claude, che si mostra mentre arriva.
// env: variabili in più per lo script, come il token del job per i tool che chiamano l'API.
// proxy: il job chiama Gemini, Atlas ed ElevenLabs attraverso il proxy del worker, che ne conta i costi.
interface JobKind {
  launch: (input: unknown, job: Job) => Promise<{ script: string; args: string[]; env?: Record<string, string> }>;
  finish?: (result: unknown, input: unknown) => Promise<unknown>;
  save?: (job: Job, result: unknown) => Promise<void>;
  folder?: true;
  reply?: true;
  proxy?: true;
}

const JOBS: Record<string, JobKind> = {
  // Il brand dal sito, all'inizio dell'onboarding: il logo che indica Claude lo scarica il worker.
  website: {
    launch: async (input) => ({ script: 'src/jobs/brand/brand.ts', args: [(input as WebsiteJobRequest).site] }),
    finish: withLogo,
  },
  ideas: {
    launch: async (input) => {
      const { brandId: _brand, ...rest } = input as IdeasJobInput;
      return { script: 'src/jobs/ideas/ideas.ts', args: [JSON.stringify(rest)] };
    },
    save: async (job, result) => {
      const saved = await saveIdeas(pool, job.account_id, job.input as IdeasJobInput, result);
      console.log(`[${job.id}] ${saved} idee salvate`);
    },
  },
  // Il tipo è quello che l'API mette in coda a fine onboarding e quando cambiano i riferimenti: in v2 prepara la cartella
  // del brand. style_guide vuoto dice all'API che non serve rimetterlo in coda.
  style: {
    launch: async (input) => {
      const { brandId } = input as StyleJobInput;
      return { script: 'src/jobs/cartella/cartella.ts', args: [path.join(BRANDS_DIR, brandId), JSON.stringify(await folderBrand(brandId))] };
    },
    save: async (job) => {
      await pool.query(`update presenza.brands set style_guide = '' where id = $1 and style_guide is null`, [(job.input as StyleJobInput).brandId]);
    },
    folder: true,
  },
  // La chat: Claude Code nella cartella del brand, con la sessione della conversazione. Il token del job serve al tool che
  // salva i contenuti con l'API; le stime dicono quanto consumano di solito caroselli e video.
  chat: {
    launch: async (input, job) => {
      const { brandId, ...rest } = input as ChatJobInput;
      return {
        script: 'src/jobs/chat/chat.ts',
        args: [path.join(BRANDS_DIR, brandId), JSON.stringify(rest)],
        env: { MOONBRAND_AGENT_TOKEN: job.agent_token ?? '', ...estimatesEnv(await measureEstimates(pool)) },
      };
    },
    folder: true,
    reply: true,
    proxy: true,
  },
};

async function folderBrand(brandId: string): Promise<FolderBrand> {
  const { rows } = await pool.query<{ identity: FolderBrand['identity']; positioning: FolderBrand['positioning']; themes: FolderBrand['themes'] | null; instructions: string | null; visual: { palette?: { colors?: string[] }; references?: { path?: string }[] } | null }>(
    'select identity, positioning, themes, instructions, visual from presenza.brands where id = $1',
    [brandId],
  );
  const row = rows[0];
  if (!row) throw new Error('Brand non trovato.');
  return {
    identity: row.identity,
    positioning: row.positioning,
    themes: row.themes ?? [],
    instructions: row.instructions ?? '',
    palette: row.visual?.palette?.colors ?? [],
    references: (row.visual?.references ?? []).flatMap((file) => (file.path ? [file.path] : [])),
  };
}

const url = process.env.DATABASE_URL ?? '';

// Il DB e le chiavi dei servizi sono del worker: gli script dei job (e quindi Claude) non le ricevono, la chat passa dal
// proxy.
// I connettori dell'account claude.ai di questa macchina non servono ai job: accesi, finirebbero nel contesto.
process.env.ENABLE_CLAUDEAI_MCP_SERVERS = 'false';
const { DATABASE_URL: _database, GEMINI_API_KEY, ATLASCLOUD_API_KEY, ELEVENLABS_API_KEY, ...jobEnv } = process.env;
const SERVICE_KEYS = { gemini: GEMINI_API_KEY, atlas: ATLASCLOUD_API_KEY, elevenlabs: ELEVENLABS_API_KEY };
const local = url.includes('localhost') || url.includes('127.0.0.1');
const pool = new pg.Pool({ connectionString: url, ...(local ? {} : { ssl: { rejectUnauthorized: false } }), max: CONCURRENCY + 2 });

const running = new Map<string, ChildProcess>();
let stopping = false;

// Si prendono solo i tipi che questo worker sa fare, dei brand di questo worker o di brand che non hanno ancora un
// worker: il brand diventa suo (presenza.brand_workers). Se nel frattempo un altro worker ha preso lo stesso brand nuovo,
// il job resta a lui e si cerca il prossimo.
async function claim(): Promise<Job | null> {
  await pool.query(
    `update presenza.ai_jobs set status = 'failed', error = 'Interrotto troppe volte.', finished_at = now(), locked_until = null
     where status = 'running' and locked_until < now() and attempts >= $1`,
    [MAX_ATTEMPTS],
  );
  const client = await pool.connect();
  try {
    for (;;) {
      await client.query('begin');
      const { rows: candidates } = await client.query<{ id: string; brand_id: string | null }>(
        `select j.id, j.input->>'brandId' as brand_id from presenza.ai_jobs j
         left join presenza.brand_workers w on w.brand_id = j.input->>'brandId'
         where (j.status = 'queued' or (j.status = 'running' and j.locked_until < now()))
           and j.kind = any($2)
           and (w.worker_id is null or w.worker_id = $1)
         order by j.created_at
         for update of j skip locked
         limit 1`,
        [WORKER_ID, Object.keys(JOBS)],
      );
      const candidate = candidates[0];
      if (!candidate) {
        await client.query('commit');
        return null;
      }
      if (candidate.brand_id) {
        await client.query('insert into presenza.brand_workers (brand_id, worker_id) values ($1, $2) on conflict (brand_id) do nothing', [
          candidate.brand_id,
          WORKER_ID,
        ]);
        const { rows: owners } = await client.query<{ worker_id: string }>('select worker_id from presenza.brand_workers where brand_id = $1', [
          candidate.brand_id,
        ]);
        if (owners[0]?.worker_id !== WORKER_ID) {
          await client.query('rollback');
          continue;
        }
      }
      const { rows } = await client.query<Job>(
        `update presenza.ai_jobs set status = 'running', attempts = attempts + 1, started_at = now(), locked_until = now() + $2::interval
         where id = $1
         returning id, kind, input, account_id, agent_token, (select locale from presenza.accounts where id = ai_jobs.account_id) as locale`,
        [candidate.id, LEASE],
      );
      await client.query('commit');
      return rows[0] ?? null;
    }
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

// I job di cui è stato chiesto lo stop: lo script riceve «stop» sullo stdin e ferma Claude (la chat lo fa, così la
// sessione resta riprendibile); se non si chiude da solo entro STOP_GRACE_MS, si termina il processo.
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
  const kind = JOBS[job.kind]!;
  console.log(`[${job.id}] ${job.kind} avviato`);

  // hidden: gli step che non si mostrano, perché non dicono niente a chi aspetta o perché Haiku non li ha ancora letti.
  const steps = new Map<string, AiStep>();
  const hidden = new Set<string>();
  const visible = () => [...steps.values()].filter((step) => !hidden.has(step.id));
  const reader = createStepReader(BRANDS_DIR, job.locale);
  const fallbackStep = translate(job.locale, 'steps.fallback');
  let outcome: { result?: unknown; error?: string; cost?: number } = {};
  // La sessione si sa dal primo messaggio: anche un job fermato a metà si può riprendere.
  let sessionId: string | undefined;

  // Gli step vanno sul DB al massimo ogni FLUSH_MS; saved è l'ultimo salvataggio, da aspettare prima di chiudere il job.
  let flushTimer: NodeJS.Timeout | undefined;
  let saved = Promise.resolve();
  const flush = () => {
    flushTimer = undefined;
    const snapshot = JSON.stringify(visible());
    saved = saved
      .then(() => pool.query('update presenza.ai_jobs set steps = $2::jsonb where id = $1', [job.id, snapshot]))
      .then(() => undefined)
      .catch((error: unknown) => console.error(`[${job.id}] steps non salvati`, error));
  };
  const changed = () => (flushTimer ??= setTimeout(flush, FLUSH_MS));

  // Quando arriva la lettura di Haiku lo step prende la sua etichetta, o resta nascosto; senza lettura prende quella di
  // riserva, se ce l'ha.
  const readStep = (id: string, tool: string, input: unknown, fallback?: string) => {
    hidden.add(id);
    reader.read({ tool, input }, (reading) => {
      const step = steps.get(id);
      const shown = reading === undefined ? fallback && { label: fallback } : reading;
      if (!step || !shown) return;
      steps.set(id, { ...step, label: shown.label });
      hidden.delete(id);
      changed();
    });
  };

  const heartbeat = setInterval(() => {
    void pool.query(`update presenza.ai_jobs set locked_until = now() + $2::interval where id = $1`, [job.id, LEASE]).catch(() => undefined);
  }, HEARTBEAT_MS);
  const fail = async (error: string) => {
    clearInterval(heartbeat);
    await finish(job.id, { status: 'failed', error });
    console.log(`[${job.id}] fallito: ${error}`);
  };

  // La cartella del brand arriva dallo storage prima del job e ci torna dopo.
  const brandId = kind.folder ? (job.input as { brandId?: string } | null)?.brandId : undefined;
  if (brandId) {
    const pullError = await pullBrand(BRANDS_DIR, brandId).then(
      () => undefined,
      (error: unknown) => `File del brand non scaricati: ${error instanceof Error ? error.message : String(error)}`,
    );
    if (pullError) return fail(pullError);
    await writeBrandLogo(pool, path.join(BRANDS_DIR, brandId), brandId).catch((error: unknown) => console.error(`[${job.id}] logo non scritto`, error));
  }

  let launch: Awaited<ReturnType<JobKind['launch']>>;
  try {
    launch = await kind.launch(job.input, job);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  // Ogni generazione che passa dal proxy va in ai_usage con il job.
  const proxy = kind.proxy ? await startProxy(SERVICE_KEYS, (usage) => void saveUsage(job, usage)) : undefined;
  const child = spawn(process.execPath, ['--import', 'tsx', launch.script, ...launch.args], {
    cwd: ROOT,
    env: { ...jobEnv, ...launch.env, ...proxy?.env, MOONBRAND_LOCALE: job.locale },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stdin.on('error', () => undefined);
  running.set(job.id, child);

  let stderr = '';
  child.stderr.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));

  // Un blocco di testo ha come chiave l'id del messaggio dell'API e la sua posizione: Claude Code manda i blocchi di un
  // messaggio uno alla volta, quindi la posizione si conta per id del messaggio.
  const blockCount = new Map<string, number>();
  let streaming: string | undefined;
  let lastEventAt = Date.now();

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
      // Il testo che arriva a pezzi si mostra solo nella chat, dove è la risposta.
      if (message.parent_tool_use_id || !kind.reply) return;
      const { event } = message;
      if (event.type === 'message_start') {
        streaming = event.message.id;
      } else if (event.type === 'content_block_start' && event.content_block.type === 'text' && streaming) {
        const id = `${streaming}-${event.index}`;
        steps.set(id, { id, label: event.content_block.text, status: 'running', kind: 'text', startedAt: Date.now() });
        changed();
      } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta' && streaming) {
        const step = steps.get(`${streaming}-${event.index}`);
        if (step) steps.set(step.id, { ...step, label: step.label + event.delta.text });
        changed();
      }
    } else if (message.type === 'assistant') {
      const messageId = message.message.id;
      const now = Date.now();
      for (const block of message.message.content) {
        const index = blockCount.get(messageId) ?? 0;
        blockCount.set(messageId, index + 1);
        if (block.type === 'text') {
          const id = `${messageId}-${index}`;
          const text = block.text.trim();
          if (!text) {
            steps.delete(id);
            continue;
          }
          steps.set(id, { id, label: text, status: 'done', kind: 'text', startedAt: steps.get(id)?.startedAt ?? lastEventAt, endedAt: now });
          // Fuori dalla chat il testo è Claude che si parla tra un passaggio e l'altro: si mostra come lo legge Haiku.
          if (!kind.reply) readStep(id, 'testo', text);
        } else if (block.type === 'tool_use') {
          const input = block.input as Record<string, unknown>;
          const known = toolStep(block.name, input, job.locale);
          steps.set(block.id, {
            id: block.id,
            label: known?.label ?? fallbackStep,
            ...(known?.detail && { detail: known.detail }),
            status: 'running',
            kind: 'tool',
            tool: block.name,
            startedAt: now,
          });
          if (known === null) hidden.add(block.id);
          else if (known === undefined) readStep(block.id, block.name, input, fallbackStep);
        }
      }
      lastEventAt = now;
      changed();
    } else if (message.type === 'user' && Array.isArray(message.message.content)) {
      lastEventAt = Date.now();
      for (const block of message.message.content) {
        if (block.type !== 'tool_result') continue;
        const step = steps.get(block.tool_use_id);
        if (step) steps.set(step.id, { ...step, status: block.is_error ? 'failed' : 'done', endedAt: lastEventAt });
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
  await proxy?.close().catch((error: unknown) => console.error(`[${job.id}] proxy non chiuso`, error));
  // Le ultime letture di Haiku finiscono negli step del job; se il job è stato fermato non si aspettano.
  await reader.close(stopping || cancelled.has(job.id) ? 0 : READ_GRACE_MS);
  clearTimeout(flushTimer);
  await saved;
  const wasCancelled = cancelled.delete(job.id);
  if (stopping) {
    clearInterval(heartbeat);
    return;
  }

  for (const step of steps.values()) if (step.status === 'running') steps.set(step.id, { ...step, status: 'done', endedAt: Date.now() });
  if (wasCancelled) {
    clearInterval(heartbeat);
    // Anche fermata, la sessione torna sullo storage: si può riprendere.
    if (brandId) await pushBrand(BRANDS_DIR, brandId).catch((error: unknown) => console.error(`[${job.id}] file del brand non caricati`, error));
    await finish(job.id, { status: 'stopped', steps: visible(), cost: outcome.cost, sessionId });
    console.log(`[${job.id}] fermato`);
    return;
  }
  let error = outcome.error ?? (outcome.result === undefined ? `Processo terminato (codice ${code}) senza risultato. ${stderr.trim()}` : undefined);
  if (!error && kind.finish) outcome.result = await kind.finish(outcome.result, job.input);
  if (!error && kind.save) {
    error = await kind
      .save(job, outcome.result)
      .then(() => undefined)
      .catch((saveError: unknown) => `Risultato non salvato: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
  }
  // Il battito va avanti finché la cartella non è sullo storage.
  if (brandId) {
    error ??= await pushBrand(BRANDS_DIR, brandId).then(
      () => undefined,
      (pushError: unknown) => `File del brand non caricati: ${pushError instanceof Error ? pushError.message : String(pushError)}`,
    );
  }
  clearInterval(heartbeat);
  await finish(job.id, { status: error ? 'failed' : 'done', result: outcome.result, error, steps: visible(), cost: outcome.cost, sessionId });
  console.log(`[${job.id}] ${error ? `fallito: ${error}` : 'completato'}${outcome.cost ? ` ($${outcome.cost.toFixed(4)})` : ''}`);
}

// cost: il costo che riporta Claude Code, cioè il totale della sessione anche quando il job ne riprende una.
async function finish(
  jobId: string,
  fields: { status: 'done' | 'failed' | 'stopped'; result?: unknown; error?: string; steps?: AiStep[]; cost?: number; sessionId?: string },
): Promise<void> {
  const own = fields.cost !== undefined && fields.sessionId ? await ownCost(jobId, fields.sessionId, fields.cost) : fields.cost;
  await pool.query(
    `update presenza.ai_jobs set status = $2, result = $3::jsonb, error = $4, steps = coalesce($5::jsonb, steps),
       cost_usd = $6, session_cost_usd = $7, session_id = $8, finished_at = now(), locked_until = null
     where id = $1`,
    [
      jobId,
      fields.status,
      fields.result === undefined ? null : JSON.stringify(fields.result),
      fields.error ?? null,
      fields.steps ? JSON.stringify(fields.steps) : null,
      own ?? null,
      fields.cost ?? null,
      fields.sessionId ?? null,
    ],
  );
}

async function saveUsage(job: Job, usage: Usage): Promise<void> {
  const brandId = (job.input as { brandId?: string } | null)?.brandId ?? null;
  await pool
    .query(
      `insert into presenza.ai_usage
         (account_id, brand_id, job_id, task, model, outcome, error, duration_ms, cost_usd, input_tokens, output_tokens, units, unit)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        job.account_id,
        brandId,
        job.id,
        usage.task,
        usage.model,
        usage.outcome,
        usage.error ?? null,
        Math.round(usage.durationMs),
        usage.costUsd ?? null,
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
        usage.units ?? null,
        usage.unit ?? null,
      ],
    )
    .catch((error: unknown) => console.error(`[${job.id}] generazione non registrata`, error));
}

// La parte del job: il totale della sessione meno quello del job prima nella stessa sessione.
async function ownCost(jobId: string, sessionId: string, total: number): Promise<number> {
  const { rows } = await pool.query<{ before: string }>(
    `select coalesce(session_cost_usd, cost_usd) as before from presenza.ai_jobs
     where session_id = $1 and id <> $2 and coalesce(session_cost_usd, cost_usd) is not null
       and created_at < (select created_at from presenza.ai_jobs where id = $2)
     order by created_at desc limit 1`,
    [sessionId, jobId],
  );
  const before = Number(rows[0]?.before ?? 0);
  return total >= before ? total - before : total;
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
console.log(`worker v2 ${WORKER_ID} pronto: ${CONCURRENCY} lavori in parallelo, tipi: ${Object.keys(JOBS).join(', ')}`);
void tick();
