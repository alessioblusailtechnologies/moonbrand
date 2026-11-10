import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';
import { matchLocale } from '@moonbrand/shared/i18n/locales';

import { estimatesFromEnv } from '../../lib/estimate';
import { languageName, uiLocale } from '../../lib/language';
import { measuredPrices } from '../../lib/prices';
import { modelSettings } from '../../lib/settings';
import { USAGE_MESSAGE } from '../../lib/usage';
import { MOONBRAND } from '../cartella/moonbrand';
import { handover } from './passaggio';
import { brandMemory, MEMORY_FILE } from './web';

// La chat del motore v4: Pi nella cartella del brand, con il modello e il ragionamento scelti dall'admin (di default Opus
// e ragionamento alto), i tool del v3 (estensione pi/moonbrand.ts) e una sola istruzione nostra, come parlare all'utente.
// Il CLAUDE.md del brand Pi lo legge da sé. Il worker è quello del v3 e legge i messaggi dell'Agent SDK: qui gli eventi
// di Pi diventano messaggi di quella forma.

// Dalla sezione Modelli dell'admin (lib/settings.ts, dal worker in MOONBRAND_MODELLI); a mano PI_MODEL e PI_THINKING.
const { model: PI_MODEL, thinking: PI_THINKING } = modelSettings().chat;
const EXTENSION = fileURLToPath(new URL('../../../pi/moonbrand.ts', import.meta.url));
const PI_CLI = process.env.PI_CLI || path.join(process.env.APPDATA ?? '', 'npm/node_modules/@earendil-works/pi-coding-agent/dist/cli.js');

// Il blocco «Come parli all'utente» dell'inizio del CLAUDE.md dei brand.
const VOICE = MOONBRAND.slice(MOONBRAND.indexOf('## Come parli'));

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const { sessionId: previous, message, attachments, idea = null, slot = null, brand } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;

// Il turno dell'utente, uguale a quello del v3: il messaggio, l'uscita del piano e l'idea da cui è partito, gli allegati.
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
// Pi, a differenza di Claude Code, non dice al modello che giorno è; alcuni CLAUDE.md di brand hanno ancora una data
// vecchia scritta dai motori di prima. La data va nel turno, non nel prompt di sistema, così la cache non si rompe.
const now = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());
// I riferimenti di stile del brand, a ogni turno come gli allegati: li ha davanti senza doverli cercare.
const REFERENCE_FILES = /\.(png|jpe?g|webp|gif|mp4|mov|pdf)$/i;
const references = (existsSync(path.join(brandDir, 'riferimenti')) ? readdirSync(path.join(brandDir, 'riferimenti')) : [])
  .filter((name) => REFERENCE_FILES.test(name))
  .sort()
  .slice(0, 20)
  .map((name) => `riferimenti/${name}`);
// Le due lingue, a ogni turno come la data: alcuni CLAUDE.md di brand nati con i motori di prima non hanno la riga della
// lingua dei post, e quella dell'account non ce l'ha nessuno. Senza lingua, il brand pubblica in italiano.
const postLanguage = languageName(matchLocale(brand?.identity.language) ?? 'it');
const turn = [
  `(Adesso è ${now}, ora di Roma. Lingua dei post del brand: ${postLanguage}. Lingua dell’account dell’utente: ${languageName(uiLocale)}.)`,
  message,
  slotBlock,
  ideaBlock,
  attachments.length > 0 && `Allegati:\n${attachments.map((file) => `- ${file}`).join('\n')}`,
  references.length > 0 && `I riferimenti di stile del brand:\n${references.map((file) => `- ${file}`).join('\n')}`,
]
  .filter(Boolean)
  .join('\n\n');

// Dove stanno i file, come nel v3: i passaggi in lavoro/ (il passaggio di sessione elenca le sue cartelle), quelli finiti
// in contenuti/, da dove salva_contenuto li prende.
const FOLDERS = 'Lavora in lavoro/; i file finiti vanno in contenuti/. Quando un contenuto è pronto salvalo con salva_contenuto; per cambiarlo passa il suo id.';

// I crediti, come nel v3: prima di un carosello o di un video la chat dice quanto consumerà e aspetta l'ok. Le stime le
// misura il worker sui contenuti degli ultimi 30 giorni (lib/estimate.ts) e arrivano in MOONBRAND_STIME.
const { carousel, video } = estimatesFromEnv(process.env);
const range = ({ typical, high }: { typical: number; high: number }) => `${typical}-${high}`;
// I crediti delle generazioni: misurati sugli ultimi lavori (ai_usage, dal worker in MOONBRAND_PREZZI), non da un listino.
// Un lavoro entra nella riga quando ha delle misure; prima la chat si affida a quanto i tool dicono nei loro risultati.
const GENERATIONS: Record<string, { label: string; per: number }> = {
  image: { label: 'un’immagine', per: 1 },
  clip: { label: 'un secondo di clip', per: 1 },
  upscale: { label: 'un secondo di upscale', per: 1 },
  music: { label: 'una musica o una canzone', per: 1 },
  voice: { label: 'la voce ogni 1000 caratteri', per: 1000 },
  effect: { label: 'un secondo di effetto sonoro', per: 1 },
  'word-timing': { label: 'un minuto di trascrizione', per: 60 },
  'web-search': { label: 'una ricerca web', per: 1 },
  'video-export': { label: 'un export video nel cloud', per: 1 },
};
const measured = measuredPrices().tasks;
const listino = Object.entries(GENERATIONS)
  .flatMap(([task, { label, per }]) => (measured[task] ? [`${label} ${Math.max(1, Math.round(measured[task].usdPerUnit * per * 100))}`] : []))
  .join(', ');
const CREDITS = `Prima di fare un carosello o un video, di' all'utente cosa farai e quanti crediti consumerà, e aspetta il suo ok. Di solito un carosello nuovo consuma ${range(carousel)} crediti e un video nuovo ${range(video)}. Per le modifiche stima tu: conta il tuo lavoro, che è spesso la parte più grande, e le generazioni${listino ? ` (in crediti, misurati sugli ultimi lavori: ${listino})` : ' (ogni tool dice quanto costa nel suo risultato)'}.`;

// La memoria del brand (tool ricorda), nel prompt di sistema dopo l'istruzione.
const memory = await brandMemory(brandDir);
// Com'è la grafica: l'HTML è il mezzo, non deve vedersi.
const GRAPHICS = 'Post, caroselli, foto e video devono sembrare fatti da un grafico e un montatore professionisti, senza l’aspetto di una pagina HTML/CSS.';

// I testi li scrive un altro modello (testi.ts): la chat li chiede ai tool e li usa così come sono.
const WRITING = 'Caption e scritte dei post, brief di caroselli e video, parlati e testi delle canzoni li scrivono scrivi_copy, scrivi_brief_carosello, scrivi_brief_video, scrivi_parlato e scrivi_testo_canzone: seguili e usa i testi così come sono, al massimo accorciali perché stiano nella grafica. Per cambiarli richiama il tool con il testo di prima e la modifica.';

const SYSTEM = [VOICE, FOLDERS, GRAPHICS, WRITING, CREDITS, memory &&`## Cosa ricordi di questo brand\n\nCose imparate nelle conversazioni passate (${MEMORY_FILE}):\n\n${memory}`].filter(Boolean).join('\n\n');

// Le sessioni stanno nella cartella del brand, così tornano sullo storage con lei.
// Pi dà un costo per risposta: il totale della sessione, che il worker si aspetta, si tiene in un file accanto.
const sessionDir = path.join(brandDir, '.pi-sessioni');
mkdirSync(sessionDir, { recursive: true });

// Con un contesto grande o dopo una pausa lunga non si riprende la sessione: se ne apre una nuova con il dialogo fin qui
// (passaggio.ts), e il costo riparte da zero.
const passing = previous ? await handover(brandDir, sessionDir, previous) : null;
if (passing) console.error(`[chat] sessione nuova invece di ${previous}: ${passing.reason}`);
const sessionId = previous && !passing ? previous : randomUUID();
const prompt = passing ? `${passing.prompt}\n\n${turn}` : turn;
const costFile = path.join(sessionDir, `${sessionId}.costo`);
const costBefore = existsSync(costFile) ? Number(readFileSync(costFile, 'utf8')) || 0 : 0;

// ffmpeg: su Linux quello del sistema; su Windows (il collaudo) quello dei pacchetti Remotion, nel PATH.
function withFfmpeg(environment: NodeJS.ProcessEnv) {
  if (process.platform !== 'win32') return environment;
  const dir = path.dirname(createRequire(import.meta.url).resolve('@remotion/compositor-win32-x64-msvc/package.json'));
  const key = Object.keys(environment).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...environment, [key]: `${dir}${path.delimiter}${environment[key] ?? ''}` };
}

// Le chiavi servono ai tool, che girano dentro Pi: l'estensione le toglie ai comandi di bash.
const pi = spawn(
  process.execPath,
  [
    PI_CLI,
    '--mode',
    'json',
    '--session-dir',
    sessionDir,
    '--session-id',
    sessionId,
    '--model',
    PI_MODEL,
    '--thinking',
    PI_THINKING,
    // Niente estensioni, skill, template e server MCP della macchina: solo la nostra estensione.
    '--no-extensions',
    '--no-skills',
    '--no-prompt-templates',
    '--no-mcp',
    '-e',
    EXTENSION,
    '--append-system-prompt',
    SYSTEM,
    prompt,
  ],
  { cwd: brandDir, env: withFfmpeg(process.env), stdio: ['ignore', 'pipe', 'pipe'] },
);
pi.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

// Lo stop arriva dal worker sullo stdin: Pi si chiude, la sessione è già scritta e si riprende al turno dopo.
let stopped = false;
process.stdin.on('data', (chunk: Buffer) => {
  if (!chunk.toString().includes('stop')) return;
  stopped = true;
  pi.kill();
});

const out = (item: Record<string, unknown>) => console.log(JSON.stringify({ ...item, session_id: sessionId }));

let cost = 0;
let reply = '';
let failure: string | undefined;
let messageId = '';
let count = 0;

interface PiBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  arguments?: unknown;
}

function handle(event: Record<string, any>): void {
  switch (event.type) {
    case USAGE_MESSAGE:
      // Un costo arrivato fuori da una chiamata di tool (lib/usage.ts): passa così com'è.
      console.log(JSON.stringify(event));
      return;
    case 'message_start':
      if (event.message?.role !== 'assistant') return;
      messageId = `pi-${sessionId}-${Date.now()}-${count++}`;
      out({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'message_start', message: { id: messageId } } });
      return;
    case 'message_update': {
      const update = event.assistantMessageEvent;
      if (update?.type === 'text_start') {
        out({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_start', index: update.contentIndex, content_block: { type: 'text', text: '' } } });
      } else if (update?.type === 'text_delta') {
        out({ type: 'stream_event', parent_tool_use_id: null, event: { type: 'content_block_delta', index: update.contentIndex, delta: { type: 'text_delta', text: update.delta } } });
      }
      return;
    }
    case 'message_end': {
      const final = event.message;
      if (final?.role !== 'assistant') return;
      cost += final.usage?.cost?.total ?? 0;
      if (final.stopReason === 'error') failure = final.errorMessage ?? 'errore del modello';
      // Tutti i blocchi, nell'ordine, anche il ragionamento: il worker conta la posizione dei blocchi di testo.
      const content = ((final.content ?? []) as PiBlock[]).map((block) =>
        block.type === 'text'
          ? { type: 'text', text: block.text ?? '' }
          : block.type === 'toolCall'
            ? { type: 'tool_use', id: block.id, name: block.name, input: block.arguments ?? {} }
            : { type: block.type },
      );
      const text = content.flatMap((block) => (block.type === 'text' && block.text?.trim() ? [block.text.trim()] : [])).join('\n\n');
      if (text) reply = text;
      out({ type: 'assistant', parent_tool_use_id: null, message: { id: messageId, content } });
      return;
    }
    case 'tool_execution_end':
      // Le generazioni dei nostri tool riportano il costo nei details (pi/moonbrand.ts): va in ai_usage come nel v3.
      for (const usage of event.result?.details?.usages ?? []) console.log(JSON.stringify({ type: USAGE_MESSAGE, ...usage }));
      out({ type: 'user', parent_tool_use_id: null, message: { content: [{ type: 'tool_result', tool_use_id: event.toolCallId, is_error: Boolean(event.isError) }] } });
      return;
    case 'auto_retry_end':
      if (!event.success) failure = event.finalError ?? 'tentativi finiti';
      return;
  }
}

// JSONL di Pi: si divide solo sugli a capo (readline taglierebbe anche su U+2028 e U+2029, che stanno nelle stringhe).
let rest = '';
pi.stdout.setEncoding('utf8');
pi.stdout.on('data', (chunk: string) => {
  rest += chunk;
  const lines = rest.split('\n');
  rest = lines.pop() ?? '';
  for (const line of lines) {
    try {
      handle(JSON.parse(line.replace(/\r$/, '')));
    } catch {
      // righe non JSON: niente
    }
  }
});

const code = await new Promise<number | null>((resolve) => pi.on('close', resolve));
const total = costBefore + cost;
writeFileSync(costFile, String(total));
if (!stopped) {
  out(
    failure || (code !== 0 && !reply)
      ? { type: 'result', subtype: 'error_during_execution', errors: [failure ?? `pi terminato con codice ${code}`], total_cost_usd: total }
      : { type: 'result', subtype: 'success', result: reply, total_cost_usd: total },
  );
}
process.stdin.destroy();
