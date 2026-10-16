import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type pg from 'pg';

import { BRANDS_DIR, ROOT } from '../config/env';
import { extendLease, finishJob, insertUsage, findBrandLogo, measureContentCosts, saveSteps, type Job } from '../repository/jobs';
import { pullBrand, pushBrand } from '../repository/storage';
import { writeLogoFile } from '../service/brand';
import { creditsEnv, estimatesFrom, FALLBACK } from '../service/estimate';
import { USAGE_MESSAGE, type ToolUsage } from '../service/usage';
import type { JobKind } from './registry';
import { createStepTracker } from './steps';

// Un lavoro dall'inizio alla fine: la cartella del brand arriva dallo storage, lo script parte come processo a parte, i
// suoi messaggi diventano i passaggi che lo studio mostra, e alla fine il risultato si salva e la cartella torna sullo
// storage. Lo stop arriva scrivendo «stop» sullo stdin del processo.

const HEARTBEAT_MS = 60_000;
const FLUSH_MS = 250;
const STOP_GRACE_MS = 15_000;

export interface RunningJob {
  stop(): void;
  kill(): void;
}

export interface RunOptions {
  // true mentre il worker si sta spegnendo: i job interrotti tornano in coda, non si chiudono.
  stopping: () => boolean;
}

// Il DB resta al worker: gli script non ne ricevono l'indirizzo. I connettori dell'account claude.ai di questa macchina
// (Canva, Drive…) non servono ai job: accesi, i nomi dei loro tool entravano nel contesto e si rileggevano a ogni chiamata.
process.env.ENABLE_CLAUDEAI_MCP_SERVERS = 'false';
const { DATABASE_URL: _database, ...jobEnv } = process.env;

export function runJob(pool: pg.Pool, job: Job, kind: JobKind, options: RunOptions): { running: RunningJob; done: Promise<void> } {
  let child: ChildProcess | undefined;
  let cancelled = false;
  const running: RunningJob = {
    stop() {
      if (!child || cancelled) return;
      cancelled = true;
      console.log(`[${job.id}] stop richiesto`);
      child.stdin?.write('stop\n');
      setTimeout(() => child?.exitCode === null && child.kill(), STOP_GRACE_MS).unref();
    },
    kill() {
      child?.kill();
    },
  };

  const done = (async () => {
    const { script, args, env } = kind.launch(job.input, job);
    console.log(`[${job.id}] ${job.kind} avviato`);
    const heartbeat = setInterval(() => void extendLease(pool, job.id).catch(() => undefined), HEARTBEAT_MS);

    // La cartella del brand arriva dallo storage prima del job e ci torna dopo, con le sessioni di Claude Code.
    const brandId = kind.folder === false ? undefined : (job.input as { brandId?: string } | null)?.brandId;
    const brandDir = brandId && path.join(BRANDS_DIR, brandId);
    const push = async (): Promise<string | undefined> =>
      brandId ? pushBrand(BRANDS_DIR, brandId).then(() => undefined, (error: unknown) => `File del brand non caricati: ${error instanceof Error ? error.message : String(error)}`) : undefined;
    if (brandId && brandDir) {
      const pullError = await pullBrand(BRANDS_DIR, brandId).then(() => undefined, (error: unknown) => `File del brand non scaricati: ${error instanceof Error ? error.message : String(error)}`);
      if (pullError) {
        clearInterval(heartbeat);
        await finishJob(pool, job.id, { status: 'failed', error: pullError });
        console.log(`[${job.id}] fallito: ${pullError}`);
        return;
      }
      await findBrandLogo(pool, brandId)
        .then((logo) => writeLogoFile(brandDir, logo))
        .catch((error: unknown) => console.error(`[${job.id}] logo non scritto`, error));
    }

    // Il consumo stimato per formato, misurato sui contenuti recenti: lo dice la chat e lo scrive la proposta.
    const credits = kind.credits ? await measureContentCosts(pool).then(estimatesFrom, () => FALLBACK) : FALLBACK;
    // Le due lingue arrivano a ogni script: senza un brand (o se il brand non l'ha scelta) si scrive nella lingua dell'account.
    const languages = { MOONBRAND_LOCALE: job.locale, MOONBRAND_CONTENT_LANGUAGE: job.content_language ?? job.locale };

    // Gli step vanno sul DB al massimo ogni FLUSH_MS; saved è l'ultimo salvataggio, da aspettare prima di chiudere il job.
    let flushTimer: NodeJS.Timeout | undefined;
    let saved = Promise.resolve();
    const flush = () => {
      flushTimer = undefined;
      const snapshot = tracker.visible();
      saved = saved.then(() => saveSteps(pool, job.id, snapshot)).catch((error: unknown) => console.error(`[${job.id}] passaggi non salvati`, error));
    };
    const tracker = createStepTracker({
      jobId: job.id,
      locale: job.locale,
      brandsDir: BRANDS_DIR,
      brandDir: brandDir || undefined,
      reply: kind.reply ?? false,
      onChange: () => (flushTimer ??= setTimeout(flush, FLUSH_MS)),
    });

    child = spawn(process.execPath, ['--import', 'tsx', script, ...args], {
      cwd: ROOT,
      env: { ...jobEnv, ...languages, ...creditsEnv(credits), ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    child.stdin?.on('error', () => undefined);
    let stderr = '';
    child.stderr?.on('data', (chunk: Buffer) => (stderr = (stderr + chunk.toString()).slice(-2000)));

    // La sessione si sa dal primo messaggio: anche un job fermato a metà si può riprendere.
    let sessionId: string | undefined;
    let outcome: { result?: unknown; error?: string; cost?: number } = {};
    const lines = createInterface({ input: child.stdout! });
    lines.on('line', (line) => {
      let message: SDKMessage;
      try {
        message = JSON.parse(line) as SDKMessage;
      } catch {
        return;
      }
      // Le generazioni dei tool arrivano sulla stessa uscita dei messaggi di Claude.
      if ((message as { type: string }).type === USAGE_MESSAGE) {
        void insertUsage(pool, job, message as unknown as ToolUsage).catch((error: unknown) => console.error(`[${job.id}] generazione non registrata`, error));
        return;
      }
      if ('session_id' in message && message.session_id) sessionId = message.session_id;
      if (message.type === 'result') {
        outcome = {
          cost: message.total_cost_usd,
          ...(message.subtype === 'success' ? { result: kind.reply ? { text: message.result } : message.structured_output } : { error: `${message.subtype}: ${message.errors.join('; ')}` }),
        };
      } else tracker.handle(message);
    });

    const code = await new Promise<number | null>((resolve) => child!.on('close', resolve));
    await tracker.close(options.stopping() || cancelled);
    clearTimeout(flushTimer);
    await saved;
    if (options.stopping()) {
      clearInterval(heartbeat);
      return;
    }
    tracker.settle();
    if (cancelled) {
      const pushError = await push();
      if (pushError) console.error(`[${job.id}] ${pushError}`);
      clearInterval(heartbeat);
      await finishJob(pool, job.id, { status: 'stopped', steps: tracker.visible(), cost: outcome.cost, sessionId });
      console.log(`[${job.id}] fermato`);
      return;
    }
    let error = outcome.error ?? (outcome.result === undefined ? `Processo terminato (codice ${code}) senza risultato. ${stderr.trim()}` : undefined);
    if (!error && kind.finish) outcome.result = await kind.finish(outcome.result);
    if (!error && kind.save) {
      error = await kind.save(job, outcome.result, credits).then(() => undefined, (saveError: unknown) => `Risultato non salvato: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    }
    // Anche un job fallito carica la sua sessione: si può riprendere. Il battito va avanti finché non è sullo storage.
    const pushError = await push();
    error ??= pushError;
    clearInterval(heartbeat);
    await finishJob(pool, job.id, { status: error ? 'failed' : 'done', result: outcome.result, error, steps: tracker.visible(), cost: outcome.cost, sessionId });
    console.log(`[${job.id}] ${error ? `fallito: ${error}` : 'completato'}${outcome.cost ? ` ($${outcome.cost.toFixed(4)})` : ''}`);
  })();

  return { running, done };
}
