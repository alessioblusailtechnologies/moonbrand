import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';
import type { BrandCategory } from '@moonbrand/shared/domain/brand';

import { estimatesFromEnv } from '../../lib/estimate';
import { LISTINO } from '../../lib/prices';
import { ARCHIVE } from '../cartella/migrate';
import { audioServer } from './audio';
import { guardaServer } from './guarda';
import { lambdaKeys, lambdaServer } from './lambda';
import { mediaServer } from './media';
import { moonbrandServer } from './moonbrand';

// La chat: Claude Code nella cartella del brand, che si presenta da sé con il CLAUDE.md. Immagini, clip, musica, voce e
// gli occhi su video e audio sono tool (media, audio, guarda): le chiavi restano in questo processo e ogni generazione
// riporta il suo costo. Poche righe dicono quanto consumano caroselli e video, da dire prima di farli. I tool di moonbrand
// salvano i contenuti e gestiscono piano e idee.

const { carousel, video } = estimatesFromEnv(process.env);
const range = ({ typical, high }: { typical: number; high: number }) => `${typical}-${high}`;

const STRUMENTI = `Immagini, clip, musica, voce ed effetti li fai con i tool media e audio; video e audio li guardi con guarda_file, che vede movimento e suono. ffmpeg è nel PATH.
Prima di fare un carosello o un video, di' all'utente cosa farai e quanti crediti consumerà, e aspetta il suo ok. Di solito un carosello nuovo consuma ${range(carousel)} crediti e un video nuovo ${range(video)}. Per le modifiche stima tu: conta il tuo lavoro, che è spesso la parte più grande, e le generazioni (${LISTINO}).
La copertina di un video è un contenuto a sé, quello che si vede nella griglia e fa fermare chi scorre: non un fotogramma preso dal video, ma un'immagine pensata, con il momento più forte reso nitido, un titolo che si legge da piccolo e lo stile del brand.
Un video per TikTok ha le scritte a schermo nello stile di TikTok, copertina compresa, nei colori e nei caratteri del brand: salvalo con canale tiktok accanto alla versione per gli altri canali.
Quello che salvi deve essere pubblicabile così com'è: foto e video nitidi come uno scatto fatto bene. Se il materiale dell'utente non lo è, lo migliori con l'AI partendo da quello, tenendo uguali persone e colori.
Lavora in lavoro/; i file finiti vanno in contenuti/. Quando un contenuto è pronto salvalo con salva_contenuto; per cambiarlo passa il suo id. Contenuti, piano e idee li leggi e li cambi con gli altri tool di moonbrand.`;

// Una riga per categoria, quando serve: un fatto del mestiere che Claude non può sapere dalla cartella del brand.
const CATEGORIA: Partial<Record<BrandCategory, string>> = {
  bellezza:
    'Il brand vende un lavoro fatto dalle sue mani: risultati e scene di lavoro si mostrano con foto e riprese vere del salone. Se non ci sono, chiedile o scegli un formato che non ne ha bisogno; l’AI serve a migliorarle, non a inventarle.',
};

// Il repo, con il codice e i .env di tutti i servizi: la chat non lo legge, tranne la cartella del brand.
const REPO = fileURLToPath(new URL('../../../../..', import.meta.url));

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

// Read, Grep e Glob non passano dal sandbox e un divieto vince su ogni eccezione: la cartella del brand sta dentro il
// repo e la home, quindi si vieta tutto quello che sta attorno al percorso che porta al brand, livello per livello.
// Altrimenti la chat usa il codice del repo per capire i servizi e ne prende i programmi (ffmpeg dei pacchetti Remotion).
function aroundBrand(root: string, brand: string): string[] {
  const relative = path.relative(root, brand);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return [root];
  const denied: string[] = [];
  let dir = root;
  for (const step of relative.split(path.sep).filter(Boolean)) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name !== step) denied.push(path.join(dir, entry.name) + (entry.isDirectory() ? `${path.sep}**` : ''));
    }
    dir = path.join(dir, step);
  }
  return denied;
}

// Le regole vogliono percorsi assoluti in stile POSIX con // davanti: su Windows C:\Users diventa //c/Users.
const readRule = (target: string) => `Read(/${target.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll('\\', '/')})`;
const brandRoot = path.resolve(brandDir);
const home = homedir();
const outer = path.relative(home, REPO).startsWith('..') ? [REPO, home] : [home];
// Anche v1/, la roba della v1 archiviata al passaggio del brand al v2.
const archive = path.join(brandRoot, ARCHIVE);
const readDeny = [...outer.flatMap((root) => aroundBrand(root, brandRoot)), `${archive}${path.sep}**`].map(readRule);

// ffmpeg: su Linux quello del sistema; su Windows (il collaudo) quello dei pacchetti Remotion, messo nel PATH perché
// la chat non lo vada a cercare nel repo.
function withFfmpeg(environment: Record<string, string | undefined>) {
  if (process.platform !== 'win32') return environment;
  const dir = path.dirname(createRequire(import.meta.url).resolve('@remotion/compositor-win32-x64-msvc/package.json'));
  const key = Object.keys(environment).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...environment, [key]: `${dir}${path.delimiter}${environment[key] ?? ''}` };
}

// Il token del job, le chiavi dei servizi e le credenziali dello storage servono ai tool e al worker, non a Claude.
const {
  MOONBRAND_AGENT_TOKEN = '',
  MOONBRAND_GEMINI_KEY,
  MOONBRAND_ATLAS_KEY,
  MOONBRAND_ELEVENLABS_KEY,
  API_URL = 'http://localhost:3012',
  S3_ACCESS_KEY_ID: _s3Key,
  S3_SECRET_ACCESS_KEY: _s3Secret,
  S3_SESSION_TOKEN: _s3Session,
  ...env
} = process.env;
const { sessionId, message, attachments, idea = null, slot = null, brand } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;
const category = brand.identity.category ? CATEGORIA[brand.identity.category] : undefined;

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
const media = mediaServer(brandDir, { gemini: MOONBRAND_GEMINI_KEY, atlas: MOONBRAND_ATLAS_KEY });

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
      // Niente comandi in background: con un prompt solo l'SDK chiude il canale alla fine del turno, e se Claude aspetta un
      // comando in background il turno che riparte dalla notifica non ha più i tool di moonbrand (salva_contenuto fallisce).
      env: { ...withFfmpeg(env), CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' },
      // Solo le impostazioni della cartella, che portano il CLAUDE.md del brand: niente di quelle dell'utente della macchina.
      settingSources: ['project'],
      systemPrompt: { type: 'preset', preset: 'claude_code', append: [STRUMENTI, category].filter(Boolean).join('\n') },
      // L'export dei video nel cloud c'è solo con le chiavi di Lambda; senza, Claude esporta in locale.
      mcpServers: {
        moonbrand: moonbrandServer(API_URL, MOONBRAND_AGENT_TOKEN, brandDir),
        media: media.server,
        ...(MOONBRAND_GEMINI_KEY && { guarda: guardaServer(brandDir, MOONBRAND_GEMINI_KEY) }),
        ...(MOONBRAND_ELEVENLABS_KEY && { audio: audioServer(brandDir, MOONBRAND_ELEVENLABS_KEY) }),
        ...(lambda && { lambda: lambdaServer(brandDir, lambda) }),
      },
      // Con BASH_SANDBOX=on Bash gira nel sandbox: scrive solo nella cartella del brand e non legge il repo né la home,
      // tranne il brand (senza v1/); se il sandbox non parte, la chat non parte. Per ora è spento, come nella v1: su
      // Ubuntu 26.04 serve prima un profilo AppArmor per bwrap (SANDBOX-BASH.md). Su Windows il sandbox non c'è comunque.
      sandbox: {
        enabled: process.platform === 'linux' && process.env.BASH_SANDBOX === 'on',
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        filesystem: { denyRead: [REPO, homedir(), archive], allowRead: [brandRoot] },
      },
      // Read, Grep e Glob non passano dal sandbox: niente .env né credenziali di Claude, ovunque siano, e niente fuori
      // dalla cartella del brand nel repo e nella home.
      settings: { permissions: { deny: ['Read(//**/.env)', 'Read(//**/.env.*)', 'Read(~/.claude/**)', ...readDeny] } },
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
  // Le clip avviate e non aspettate si pagano lo stesso, se Atlas le ha fatte.
  await media.close().catch((error: unknown) => console.error('clip in sospeso non controllate', error));
  // Senza lo stdin aperto il processo si chiude da solo, dopo aver scritto tutto l'output.
  process.stdin.destroy();
}
