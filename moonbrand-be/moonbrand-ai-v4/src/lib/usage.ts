import { AsyncLocalStorage } from 'node:async_hooks';

// Una generazione con il suo costo, per ai_usage. Nel v4 i tool girano dentro Pi, il cui stdout è il flusso degli
// eventi: ogni chiamata di tool raccoglie i suoi costi (usageSink) e l'estensione li mette nei details del risultato,
// che chat.ts manda al worker. Fuori da una chiamata di tool (lavori di altri job, o un costo che arriva dopo) la riga
// va sullo stdout come nel v3.

export const USAGE_MESSAGE = 'moonbrand_usage';

export interface Usage {
  task: string;
  model: string;
  outcome: 'ok' | 'error';
  error?: string;
  durationMs: number;
  units?: number;
  unit?: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
}

export const usageSink = new AsyncLocalStorage<Usage[]>();

export function reportUsage(usage: Usage): void {
  const sink = usageSink.getStore();
  if (sink) sink.push(usage);
  else process.stdout.write(`${JSON.stringify({ type: USAGE_MESSAGE, ...usage })}\n`);
}
