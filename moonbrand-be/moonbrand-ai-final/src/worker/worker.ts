import { CONCURRENCY, WORKER_ID } from '../config/env';
import { createPool } from '../repository/db';
import { claimJob, failStaleJobs, finishJob, requeueJobs, stopRequests } from '../repository/jobs';
import { createRegistry } from './registry';
import { runJob, type RunningJob } from './runner';

// Il worker: ogni POLL_MS prende dalla coda i lavori dei suoi brand, fino a CONCURRENCY insieme, e ogni secondo guarda
// se lo studio ha chiesto di fermarne uno. Allo spegnimento i lavori in corso tornano in coda.

const POLL_MS = 2000;
const CANCEL_POLL_MS = 1000;

export function startWorker(): void {
  const pool = createPool(CONCURRENCY + 2);
  const registry = createRegistry(pool);
  const running = new Map<string, RunningJob>();
  let stopping = false;

  async function tick(): Promise<void> {
    while (!stopping && running.size < CONCURRENCY) {
      await failStaleJobs(pool).catch(() => undefined);
      const job = await claimJob(pool, WORKER_ID).catch((error: unknown) => {
        console.error('coda non raggiungibile', error);
        return null;
      });
      if (!job) return;
      const kind = registry[job.kind];
      if (!kind) {
        await finishJob(pool, job.id, { status: 'failed', error: `Tipo di lavoro sconosciuto: ${job.kind}` }).catch(() => undefined);
        continue;
      }
      const { running: handle, done } = runJob(pool, job, kind, { stopping: () => stopping });
      running.set(job.id, handle);
      void done
        .catch(async (error: unknown) => {
          console.error(`[${job.id}] errore del worker`, error);
          await finishJob(pool, job.id, { status: 'failed', error: String(error) }).catch(() => undefined);
        })
        .finally(() => running.delete(job.id));
    }
  }

  async function watchStops(): Promise<void> {
    for (const id of await stopRequests(pool, [...running.keys()])) running.get(id)?.stop();
  }

  const shutdown = async () => {
    stopping = true;
    clearInterval(poller);
    clearInterval(canceller);
    const interrupted = [...running.keys()];
    for (const job of running.values()) job.kill();
    await requeueJobs(pool, interrupted);
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  const poller = setInterval(() => void tick(), POLL_MS);
  const canceller = setInterval(() => void watchStops().catch(() => undefined), CANCEL_POLL_MS);
  console.log(`worker ${WORKER_ID} pronto: ${CONCURRENCY} lavori in parallelo, tipi: ${Object.keys(registry).join(', ')}`);
  void tick();
}
