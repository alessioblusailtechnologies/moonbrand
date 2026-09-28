import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import { query, type McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

import { writeBrandGuide } from '../lib/brand-guide';
import { MOONBRAND_PLUGINS } from '../lib/plugin';
import { imageTools } from '../tools/immagini';
import { moonbrandTools } from '../tools/moonbrand';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Chiavi e token restano in questo processo: Claude vede solo i tool.
const { GEMINI_API_KEY, MOONBRAND_AGENT_TOKEN, API_URL, ...env } = process.env;
if (!MOONBRAND_AGENT_TOKEN) {
  console.error('Manca il token del job: la chat parte solo dal worker.');
  process.exit(1);
}

const { conversationId, sessionId, brand, message, attachments } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;
const workDir = `chat/${conversationId}`;
const temp = path.join(brandDir, workDir, 'tmp');
await mkdir(temp, { recursive: true });
await writeBrandGuide(brandDir, brand);

const mcpServers: Record<string, McpServerConfig> = { moonbrand: moonbrandTools(API_URL || 'http://localhost:3012', MOONBRAND_AGENT_TOKEN) };
if (GEMINI_API_KEY) mcpServers.immagini = imageTools(brandDir, GEMINI_API_KEY);

const guide = `# moonbrand

Sei l’assistente di moonbrand per il brand descritto in CLAUDE.md. Chi ti scrive cura la presenza del brand sui social: con te pensa, fa domande, parte dalle idee e prepara i contenuti.

- Rispondi in italiano, diretto e concreto. Se ti manca qualcosa di importante per fare bene il lavoro, chiedilo invece di inventarlo.
- La cartella di lavoro di questa conversazione è ${workDir}: lì bozze, HTML, script e immagini. Le cartelle dei contenuti si cambiano solo con i tool di moonbrand.
- Per scrivere o ritoccare un contenuto segui la skill moonbrand:contenuti; per proporre idee la skill moonbrand:idee.
- Quando prepari un contenuto, salvalo con contenuto_salva appena testi e immagini finali sono pronti e controllati: finisce subito nella sezione Contenuti, come bozza. Per cambiare un contenuto già salvato usa contenuto_aggiorna con il suo id.
- Le idee proponile in chat; salva con idea_salva solo quelle che l’utente vuole tenere: finiscono nella sezione Idee.
- Le foto che l’utente allega al messaggio sono in allegati/: guardale prima di rispondere.
- Dopo un salvataggio di’ all’utente dove lo trova.`;

const prompt = attachments.length > 0 ? `${message}\n\nFoto allegate:\n${attachments.map((file) => `- ${file}`).join('\n')}` : message;

// Lo stop arriva dal worker sullo stdin: Claude si ferma e la sessione resta riprendibile.
const abort = new AbortController();
process.stdin.on('data', (chunk: Buffer) => {
  if (chunk.toString().includes('stop')) abort.abort();
});

try {
  for await (const item of query({
    prompt,
    options: {
      cwd: brandDir,
      env: { ...env, TEMP: temp, TMP: temp, TMPDIR: temp },
      mcpServers,
      plugins: MOONBRAND_PLUGINS,
      includePartialMessages: true,
      abortController: abort,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      systemPrompt: { type: 'preset', preset: 'claude_code', append: guide },
      ...(sessionId && { resume: sessionId }),
    },
  })) {
    console.log(JSON.stringify(item));
  }
} catch (error) {
  if (!abort.signal.aborted) throw error;
} finally {
  // Senza lo stdin aperto il processo si chiude da solo, dopo aver scritto tutto l'output.
  process.stdin.destroy();
}
