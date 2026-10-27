// Una generazione con il suo costo, per ai_usage. I tool della chat (servizi ed export su Lambda) la mandano al worker
// sullo stdout, una riga JSON accanto ai messaggi di Claude.

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

export function reportUsage(usage: Usage): void {
  process.stdout.write(`${JSON.stringify({ type: USAGE_MESSAGE, ...usage })}\n`);
}
