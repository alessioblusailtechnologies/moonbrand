// Le generazioni dei tool (immagini, voce, effetti, musica, clip) finiscono in ai_usage con il job che le ha chieste.
// Lo script del job non ha il DB: le scrive sullo stdout, una riga JSON accanto ai messaggi di Claude, e le salva il worker.

export const USAGE_MESSAGE = 'moonbrand_usage';

// units e unit: quanto si è generato (immagini, secondi, caratteri); costUsd in dollari, detto dal servizio o calcolato
// con i listini di prices.ts.
export interface ToolUsage {
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

export function reportUsage(usage: ToolUsage): void {
  process.stdout.write(`${JSON.stringify({ type: USAGE_MESSAGE, ...usage })}\n`);
}

// Esegue una generazione e la registra, anche se fallisce: una generazione fallita non ha costo.
// extra: quanto si è generato e quanto è costato, anche da quello che si sa solo dal risultato (i token, la durata).
export async function measure<T>(
  usage: { task: string; model: string; extra?: (result: T) => Partial<ToolUsage> },
  run: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await run();
    reportUsage({ task: usage.task, model: usage.model, outcome: 'ok', durationMs: Date.now() - start, ...usage.extra?.(result) });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportUsage({ task: usage.task, model: usage.model, outcome: 'error', error: message, durationMs: Date.now() - start });
    throw error;
  }
}
