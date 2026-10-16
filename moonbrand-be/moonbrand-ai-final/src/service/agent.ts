import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import { agentEnv, MODEL } from '../config/env';

// Claude Code nella cartella del brand: è l'unico modo in cui il motore lancia Claude. Il worker legge sullo stdout i
// messaggi dell'SDK, una riga JSON ciascuno, e lo stop arriva dallo stdin («stop»): Claude si ferma e la sessione resta
// riprendibile.
export interface AgentOptions {
  // La cartella del brand (cwd): CLAUDE.md, riferimenti, contenuti.
  brandDir: string;
  prompt: string;
  // Quello che si aggiunge al prompt di Claude Code: la guida della chat, le regole di un job.
  guide?: string;
  // I tool in più (server MCP in questo processo) e la cartella temporanea del lavoro.
  tools: Record<string, McpServerConfig>;
  temp: string;
  // Lo schema del risultato; senza, il risultato è la risposta finale di Claude (la chat).
  schema?: Record<string, unknown>;
  resume?: string;
  // Variabili in più per i comandi che Claude lancia (per esempio il browser di Remotion).
  env?: Record<string, string>;
  // Il testo a pezzi mentre arriva: serve solo alla chat, dove è la risposta.
  stream?: boolean;
}

export async function runAgent(options: AgentOptions): Promise<void> {
  await mkdir(options.temp, { recursive: true });
  const abort = new AbortController();
  process.stdin.on('data', (chunk: Buffer) => {
    if (chunk.toString().includes('stop')) abort.abort();
  });
  try {
    for await (const message of query({
      prompt: options.prompt,
      options: {
        model: MODEL,
        cwd: options.brandDir,
        env: { ...agentEnv(), ...options.env, TEMP: options.temp, TMP: options.temp, TMPDIR: options.temp },
        mcpServers: options.tools,
        // Solo le impostazioni e il CLAUDE.md della cartella del brand: non quelle dell'utente di questa macchina.
        settingSources: ['project'],
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        abortController: abort,
        ...(options.guide && { systemPrompt: { type: 'preset', preset: 'claude_code', append: options.guide } }),
        ...(options.schema && { outputFormat: { type: 'json_schema', schema: options.schema } }),
        ...(options.resume && { resume: options.resume }),
        ...(options.stream && { includePartialMessages: true }),
      },
    })) {
      console.log(JSON.stringify(message));
    }
  } catch (error) {
    if (!abort.signal.aborted) throw error;
  } finally {
    // Senza lo stdin aperto il processo si chiude da solo, dopo aver scritto tutto l'output.
    process.stdin.destroy();
  }
}

// L'input di un job dalla riga di comando: la cartella del brand e il JSON dell'input (senza brandId).
export function jobArgs<T>(usage: string): { brandDir: string; input: T } {
  const [brandDir, inputJson] = process.argv.slice(2);
  if (!brandDir || !inputJson) {
    console.error(`Uso: ${usage}`);
    process.exit(1);
  }
  return { brandDir: path.resolve(brandDir), input: JSON.parse(inputJson) as T };
}
