import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';

import { estimatesFromEnv } from '../../lib/estimate';
import { LISTINO } from '../../lib/prices';
import { lambdaKeys, lambdaServer } from './lambda';
import { moonbrandServer } from './moonbrand';

// La chat: Claude Code nella cartella del brand, che si presenta da sé con il CLAUDE.md. Poche righe dicono quali servizi
// ha nell'ambiente, che Claude chiama da sé con node o curl attraverso il proxy del worker, e quanto consumano caroselli e
// video, da dire prima di farli. I tool di moonbrand salvano i contenuti e gestiscono piano e idee.

const { carousel, video } = estimatesFromEnv(process.env);
const range = ({ typical, high }: { typical: number; high: number }) => `${typical}-${high}`;

const STRUMENTI = `Nell'ambiente hai, per ogni servizio, l'indirizzo da usare al posto di quello pubblico e la chiave: GEMINI_BASE_URL e GEMINI_API_KEY (immagini, e per guardare i video), ATLASCLOUD_BASE_URL e ATLASCLOUD_API_KEY (clip video), ELEVENLABS_BASE_URL e ELEVENLABS_API_KEY (voce e musica). Chiamali tu con node o curl.
Prima di fare un carosello o un video, di' all'utente cosa farai e quanti crediti consumerà, e aspetta il suo ok. Di solito un carosello nuovo consuma ${range(carousel)} crediti e un video nuovo ${range(video)}. Per le modifiche stima tu: conta il tuo lavoro, che è spesso la parte più grande, e le generazioni (${LISTINO}).
Lavora in lavoro/; i file finiti vanno in contenuti/. Quando un contenuto è pronto salvalo con salva_contenuto; per cambiarlo passa il suo id. Contenuti, piano e idee li leggi e li cambi con gli altri tool di moonbrand.`;

// Il repo, con il codice e i .env di tutti i servizi: la chat non lo legge, tranne la cartella del brand.
const REPO = fileURLToPath(new URL('../../../../..', import.meta.url));

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Il token del job e le credenziali dello storage servono ai tool di moonbrand e al worker, non a Claude.
const {
  MOONBRAND_AGENT_TOKEN = '',
  API_URL = 'http://localhost:3012',
  S3_ACCESS_KEY_ID: _s3Key,
  S3_SECRET_ACCESS_KEY: _s3Secret,
  S3_SESSION_TOKEN: _s3Session,
  ...env
} = process.env;
const { sessionId, message, attachments, idea = null, slot = null } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;

// L'uscita del piano e l'idea da cui l'utente ha aperto la chat: il contenuto è per quell'uscita e nasce da quell'idea.
const slotBlock =
  slot && [`L’uscita del piano menzionata (slotId ${slot.id}): ${slot.date} alle ${slot.time} su ${slot.channels.join(', ')}`, slot.theme && `Tema: ${slot.theme}`].filter(Boolean).join('\n');
const ideaBlock =
  idea &&
  [
    `L’idea menzionata: ${idea.title}`,
    idea.angleLabel && `Taglio: ${idea.angleLabel}`,
    idea.angle && `Cosa raccontare: ${idea.angle}`,
    idea.rationale && `Perché adesso: ${idea.rationale}`,
    idea.theme && `Tema: ${idea.theme}`,
  ]
    .filter(Boolean)
    .join('\n');

const prompt = [message, slotBlock, ideaBlock, attachments.length > 0 && `Allegati:\n${attachments.map((file) => `- ${file}`).join('\n')}`].filter(Boolean).join('\n\n');

const lambda = lambdaKeys();

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
      // L'export dei video nel cloud c'è solo con le chiavi di Lambda; senza, Claude esporta in locale.
      mcpServers: { moonbrand: moonbrandServer(API_URL, MOONBRAND_AGENT_TOKEN, brandDir), ...(lambda && { lambda: lambdaServer(brandDir, lambda) }) },
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
