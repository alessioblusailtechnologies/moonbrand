// Una generazione con il suo costo, per ai_usage. Quelle di Gemini, Atlas ed ElevenLabs le registra il proxy nel worker;
// quelle che fa il processo della chat (l'export su Lambda) arrivano al worker sullo stdout, una riga JSON accanto ai
// messaggi di Claude.

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
