import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

// La chat: Claude Code nella cartella del brand, che si presenta da sé con il CLAUDE.md. Niente tool di moonbrand: poche
// righe dicono quali chiavi ha nell'ambiente, e Claude le usa da sé con node o curl.

const STRUMENTI = `Nell'ambiente hai GEMINI_API_KEY (immagini, e per guardare i video), ATLASCLOUD_API_KEY (clip video) ed ELEVENLABS_API_KEY (voce e musica): chiamale tu con node o curl.
Lavora in lavoro/; i file finiti vanno in contenuti/.`;

// Il repo, con il codice e i .env di tutti i servizi: la chat non lo legge, tranne la cartella del brand.
const REPO = fileURLToPath(new URL('../../../../..', import.meta.url));

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Il token del job e le credenziali dello storage servono al worker, non a Claude.
const {
  MOONBRAND_AGENT_TOKEN: _token,
  S3_ACCESS_KEY_ID: _s3Key,
  S3_SECRET_ACCESS_KEY: _s3Secret,
  S3_SESSION_TOKEN: _s3Session,
  ...env
} = process.env;
const { sessionId, message, attachments } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;

const prompt = [message, attachments.length > 0 && `Allegati:\n${attachments.map((file) => `- ${file}`).join('\n')}`].filter(Boolean).join('\n\n');

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
      env,
      // Solo le impostazioni della cartella, che portano il CLAUDE.md del brand: niente di quelle dell'utente della macchina.
      settingSources: ['project'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: STRUMENTI },
      // Bash gira nel sandbox: scrive solo nella cartella del brand e non legge il repo né la home, tranne il brand.
      // Su Windows (il collaudo) il sandbox non c'è: lì Bash resta libero, su Linux senza sandbox la chat non parte.
      sandbox: {
        enabled: process.platform === 'linux',
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        filesystem: { denyRead: [REPO, homedir()], allowRead: [path.resolve(brandDir)] },
      },
      // Read, Grep e Glob non passano dal sandbox: niente .env né credenziali di Claude, ovunque siano.
      settings: { permissions: { deny: ['Read(//**/.env)', 'Read(//**/.env.*)', 'Read(~/.claude/**)'] } },
      includePartialMessages: true,
      abortController: abort,
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
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
