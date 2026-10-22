import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import type { ChatJobInput } from '@moonbrand/shared/api/contract';
import type { BrandCategory } from '@moonbrand/shared/domain/brand';

import { estimatesFromEnv } from '../../lib/estimate';
import { LISTINO } from '../../lib/prices';
import { lambdaKeys, lambdaTools } from './lambda';
import { moonbrandTools } from './moonbrand';
import { Editor, Shell, type EditorInput, type ToolOutcome } from './strumenti';

// La chat del prototipo API (22/10): niente Claude Code. Il giro con Opus lo fa questo script con la Messages API: manda
// la conversazione, esegue i tool che Claude chiede (shell, editor dei file, tool di moonbrand, export su Lambda) e gli
// rimanda i risultati. Al worker scrive le stesse righe JSON di Claude Code, così passi, testo e costo arrivano allo studio
// come con il v2.
// La conversazione resta in sessioni/<brand>/<id>.json, fuori dalla cartella del brand; oltre 150K token l'API la
// riassume. Con VIDEO_ENGINE=ae i video si fanno con After Effects (gli strumenti di moonbrand-ai-ae in AE_TOOLKIT) al
// posto di Remotion su Lambda.

const MODEL = 'claude-opus-5-5';
const BETAS = ['thinking-display-updates-2026-08-18', 'compact-2026-01-12', 'server-side-fallback-2026-07-01'];
// Opus 5.5 per milione di token: entrata, uscita, scrittura in cache (5 minuti), lettura dalla cache; ricerca web a richiesta.
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2, webSearch: 0.01 };
const SESSIONS = fileURLToPath(new URL('../../../sessioni', import.meta.url));

const AFTER_EFFECTS = process.env.VIDEO_ENGINE === 'ae';
const AE = (process.env.AE_TOOLKIT ?? 'C:/moonbrand-ae').replaceAll('\\', '/');
const VIDEO_AE = `I video li fai con After Effects 2026, che è aperto, e ne usi a fondo gli effetti. Scrivi uno script TypeScript con l'API di scripting di AE, in un file .ts dentro lavoro/, e:
- node ${AE}/prepara.mjs <file.ts> lo controlla con i tipi di AE e lo converte in ExtendScript, in una cartella con il nome dello script accanto al file; se ci sono errori li elenca;
- node ${AE}/esegui.mjs <file.ts> [quanti fotogrammi] lo esegue in AE partendo da un progetto vuoto, renderizza la composizione che si chiama «Video» e lascia in quella cartella video.mp4, alcuni fotogrammi in fotogrammi/ e il progetto progetto.aep. AE è uno per tutti i brand: gli script girano uno alla volta;
- node ${AE}/installa-font.mjs <file.ttf|.otf> installa un font, che AE vede subito (app.fonts per trovarne il nome PostScript).
Il JavaScript può essere moderno: viene convertito in ES3, con forEach/map/filter/reduce/indexOf, Object.keys, trim e JSON aggiunti. File esterni (immagini, audio) si importano con percorsi assoluti.
Documentazione, da leggere con la shell: ${AE}/docs/after-effects-scripting-guide/docs/ (scripting), ${AE}/docs/after-effects-expression-reference/docs/ (espressioni), ${AE}/docs/javascript-tools-guide/docs/ (ExtendScript), ${AE}/node_modules/types-for-adobe/AfterEffects/26.0/index.d.ts (firme esatte).`;

const { carousel, video } = estimatesFromEnv(process.env);
const range = ({ typical, high }: { typical: number; high: number }) => `${typical}-${high}`;

const STRUMENTI = `Nell'ambiente hai, per ogni servizio, l'indirizzo da usare al posto di quello pubblico e la chiave: GEMINI_BASE_URL e GEMINI_API_KEY (immagini; i video si guardano con Gemini, che vede movimento e audio), ATLASCLOUD_BASE_URL e ATLASCLOUD_API_KEY (clip video), ELEVENLABS_BASE_URL e ELEVENLABS_API_KEY (voce e musica). Chiamali tu con node o curl. I modelli di Atlas con i prezzi sono in GET /api/v1/models. ffmpeg è nel PATH.
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

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run chat -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}
const root = path.resolve(brandDir);
const brandId = path.basename(root);

// La chiave dell'API è solo di questo script (gli altri job girano con Claude Code e l'abbonamento); il token del job e
// le credenziali dello storage servono ai tool di moonbrand. Niente di questo arriva ai comandi della shell.
const {
  CHAT_ANTHROPIC_API_KEY,
  MOONBRAND_AGENT_TOKEN = '',
  API_URL = 'http://localhost:3012',
  S3_ACCESS_KEY_ID: _s3Key,
  S3_SECRET_ACCESS_KEY: _s3Secret,
  S3_SESSION_TOKEN: _s3Session,
  ANTHROPIC_API_KEY: _anthropic,
  ...env
} = process.env;
if (!CHAT_ANTHROPIC_API_KEY) {
  console.error('Manca CHAT_ANTHROPIC_API_KEY nel .env del motore.');
  process.exit(1);
}

// ffmpeg: su Linux quello del sistema; su Windows (il collaudo) quello dei pacchetti Remotion, messo nel PATH.
function withFfmpeg(environment: Record<string, string | undefined>) {
  if (process.platform !== 'win32') return environment;
  const dir = path.dirname(createRequire(import.meta.url).resolve('@remotion/compositor-win32-x64-msvc/package.json'));
  const key = Object.keys(environment).find((name) => name.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...environment, [key]: `${dir}${path.delimiter}${environment[key] ?? ''}` };
}

const { sessionId: previous, message, attachments, idea = null, slot = null, brand } = JSON.parse(inputJson) as Omit<ChatJobInput, 'brandId'>;
const category = brand.identity.category ? CATEGORIA[brand.identity.category] : undefined;

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

// Il prompt: il CLAUDE.md del brand (chi è moonbrand, come parla, il brand), poi l'ambiente e i servizi. Resta uguale per
// tutta la conversazione, così sta in cache.
const claudeMd = existsSync(path.join(root, 'CLAUDE.md')) ? await readFile(path.join(root, 'CLAUDE.md'), 'utf8') : '';
const AMBIENTE = `Lavori nella cartella del brand, ${root.replaceAll('\\', '/')}: ogni comando della shell parte da lì, in una shell nuova (cd e variabili non restano da un comando all'altro). La shell è bash${process.platform === 'win32' ? ' di Git su Windows' : ' su Linux'}, con node e npm. Un comando che per 3 minuti non stampa niente e non scrive file si ferma da solo, come uno che dura più di 30 minuti: in quelli lunghi stampa l'avanzamento. Con l'editor leggi, scrivi e modifichi i file del brand e guardi le immagini.
Prima di cominciare un lavoro di' in una riga cosa farai; mentre lavori, brevi aggiornamenti quando trovi qualcosa che conta o cambi strada; alla fine un riepilogo che si capisce da solo.`;
const system: Anthropic.Beta.BetaTextBlockParam[] = [
  { type: 'text', text: [claudeMd, AMBIENTE, STRUMENTI, AFTER_EFFECTS && VIDEO_AE, category].filter(Boolean).join('\n\n'), cache_control: { type: 'ephemeral' } },
];

// I tool di moonbrand e l'export su Lambda arrivano come definizioni dell'Agent SDK (schema Zod e funzione): qui diventano
// tool della Messages API.
interface SdkTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  handler: (args: unknown, extra: unknown) => Promise<{ content: { type: string; text?: string }[]; isError?: boolean }>;
}
const lambda = AFTER_EFFECTS ? null : lambdaKeys();
const sdkTools = [...moonbrandTools(API_URL, MOONBRAND_AGENT_TOKEN, brandDir), ...(lambda ? lambdaTools(brandDir, lambda) : [])] as unknown as SdkTool[];
const byName = new Map(sdkTools.map((item) => [item.name, item]));
const tools: Anthropic.Beta.BetaToolUnion[] = [
  { type: 'bash_20250124', name: 'bash' },
  { type: 'text_editor_20250728', name: 'str_replace_based_edit_tool' },
  { type: 'web_search_20260209', name: 'web_search' },
  { type: 'web_fetch_20260209', name: 'web_fetch' },
  ...sdkTools.map((item) => {
    const { $schema: _schema, ...schema } = z.toJSONSchema(z.object(item.inputSchema)) as Record<string, unknown>;
    return { name: item.name, description: item.description, input_schema: schema as Anthropic.Beta.BetaTool.InputSchema };
  }),
];

// Il nome con cui lo studio conosce ogni tool: quelli di Claude Code, per avere le stesse etichette dei passi.
function studioTool(block: Anthropic.Beta.BetaToolUseBlock | Anthropic.Beta.BetaServerToolUseBlock): { name: string; input: Record<string, unknown> } {
  const input = block.input as Record<string, unknown>;
  if (block.name === 'bash') return { name: 'Bash', input: { command: input.command } };
  if (block.name === 'str_replace_based_edit_tool') {
    const name = input.command === 'view' ? 'Read' : input.command === 'create' ? 'Write' : 'Edit';
    return { name, input: { file_path: input.path } };
  }
  if (block.name === 'web_search') return { name: 'WebSearch', input };
  if (block.name === 'web_fetch') return { name: 'WebFetch', input };
  if (block.name === 'esporta_video') return { name: 'mcp__lambda__esporta_video', input };
  return { name: `mcp__moonbrand__${block.name}`, input };
}

const sessionId = previous && existsSync(path.join(SESSIONS, brandId, `${previous}.json`)) ? previous : randomUUID();
const sessionFile = path.join(SESSIONS, brandId, `${sessionId}.json`);
const messages: Anthropic.Beta.BetaMessageParam[] = sessionId === previous ? (JSON.parse(await readFile(sessionFile, 'utf8')) as Anthropic.Beta.BetaMessageParam[]) : [];
// Un turno fermato a metà lascia tool senza risultato: li chiude il messaggio nuovo.
const last = messages.at(-1);
const pending = last?.role === 'assistant' && Array.isArray(last.content) ? last.content.filter((block) => block.type === 'tool_use') : [];
messages.push({
  role: 'user',
  content: [
    ...pending.map((block) => ({ type: 'tool_result' as const, tool_use_id: (block as Anthropic.Beta.BetaToolUseBlockParam).id, content: 'Interrotto dall’utente.', is_error: true })),
    { type: 'text' as const, text: prompt },
  ],
});
const saveSession = async () => {
  await mkdir(path.dirname(sessionFile), { recursive: true });
  await writeFile(sessionFile, JSON.stringify(messages));
};

const emit = (line: Record<string, unknown>) => console.log(JSON.stringify({ ...line, session_id: sessionId, parent_tool_use_id: null }));

// Lo stop arriva dal worker sullo stdin: si fermano la richiesta e i comandi, la conversazione resta salvata.
const abort = new AbortController();
const shell = new Shell(root, { ...withFfmpeg(env), MOONBRAND_LOCALE: undefined });
const editor = new Editor(root);
process.stdin.on('data', (chunk: Buffer) => {
  if (!chunk.toString().includes('stop')) return;
  abort.abort();
  shell.stop();
});

async function runTool(block: Anthropic.Beta.BetaToolUseBlock): Promise<ToolOutcome> {
  const input = block.input as Record<string, unknown>;
  if (block.name === 'bash') {
    if (input.restart) return { content: 'Ogni comando parte già in una shell nuova.' };
    if (typeof input.command !== 'string') return { content: 'Manca il comando.', isError: true };
    return shell.run(input.command, abort.signal);
  }
  if (block.name === 'str_replace_based_edit_tool') return editor.run(input as unknown as EditorInput);
  const item = byName.get(block.name);
  if (!item) return { content: `Tool ${block.name} sconosciuto.`, isError: true };
  const parsed = z.object(item.inputSchema).safeParse(input);
  if (!parsed.success) return { content: `Parametri non validi: ${parsed.error.message}`, isError: true };
  try {
    const result = await item.handler(parsed.data, {});
    const text = result.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n');
    return { content: text || '(fatto)', ...(result.isError && { isError: true }) };
  } catch (error) {
    return { content: error instanceof Error ? error.message : String(error), isError: true };
  }
}

const client = new Anthropic({ apiKey: CHAT_ANTHROPIC_API_KEY });
let cost = 0;
let reply = '';

function addCost(usage: Anthropic.Beta.BetaUsage) {
  const parts = usage.iterations?.length ? usage.iterations : [usage];
  for (const part of parts) {
    if (!('input_tokens' in part)) continue;
    cost +=
      (part.input_tokens * PRICE.input + part.output_tokens * PRICE.output + (part.cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (part.cache_read_input_tokens ?? 0) * PRICE.cacheRead) /
      1_000_000;
  }
  cost += (usage.server_tool_use?.web_search_requests ?? 0) * PRICE.webSearch;
}

try {
  for (;;) {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64_000,
        betas: BETAS,
        fallbacks: 'default',
        thinking: { type: 'adaptive', display: 'updates' },
        // xhigh come Claude Code: con high il reel di Velia del 23/10 era venuto peggio di quello del v2.
        output_config: { effort: 'xhigh' },
        system,
        tools,
        messages,
        cache_control: { type: 'ephemeral' },
        // Oltre 150K token la conversazione si riassume. Niente taglio dei risultati vecchi dei tool: toglieva a Claude gli
        // screen di riferimento e i fotogrammi già guardati, e la qualità calava.
        context_management: { edits: [{ type: 'compact_20260112', trigger: { type: 'input_tokens', value: 150_000 } }] },
      },
      { signal: abort.signal },
    );

    // Allo studio: il testo e gli aggiornamenti tra un tool e l'altro (blocchi thinking con testo) arrivano come testo.
    for await (const event of stream) {
      if (event.type === 'message_start') emit({ type: 'stream_event', event: { type: 'message_start', message: { id: event.message.id } } });
      else if (event.type === 'content_block_start' && (event.content_block.type === 'text' || event.content_block.type === 'thinking'))
        emit({ type: 'stream_event', event: { type: 'content_block_start', index: event.index, content_block: { type: 'text', text: '' } } });
      else if (event.type === 'content_block_delta' && (event.delta.type === 'text_delta' || event.delta.type === 'thinking_delta'))
        emit({
          type: 'stream_event',
          event: { type: 'content_block_delta', index: event.index, delta: { type: 'text_delta', text: event.delta.type === 'text_delta' ? event.delta.text : event.delta.thinking } },
        });
    }
    const response = await stream.finalMessage();
    addCost(response.usage);
    messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });

    // Un blocco per ogni blocco della risposta, così le posizioni combaciano con quelle dello stream.
    const serverResults: { tool_use_id: string }[] = [];
    const shown = response.content.map((block) => {
      if (block.type === 'text') return { type: 'text', text: block.text };
      if (block.type === 'thinking') return { type: 'text', text: block.thinking };
      if (block.type === 'tool_use' || block.type === 'server_tool_use') {
        if (block.type === 'server_tool_use') serverResults.push({ tool_use_id: block.id });
        return { type: 'tool_use', id: block.id, ...studioTool(block) };
      }
      return { type: block.type };
    });
    emit({ type: 'assistant', message: { id: response.id, content: shown } });
    if (serverResults.length > 0) emit({ type: 'user', message: { content: serverResults.map((item) => ({ type: 'tool_result', ...item })) } });

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
    if (text) reply = text;

    if (response.stop_reason === 'pause_turn') continue;
    const calls = response.content.filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || calls.length === 0) {
      await saveSession();
      if (response.stop_reason === 'max_tokens') reply ||= 'La risposta si è interrotta perché troppo lunga.';
      if (response.stop_reason === 'refusal') reply ||= 'Su questa richiesta non posso aiutarti.';
      break;
    }

    // I tool della stessa risposta girano insieme; i risultati tornano tutti in un messaggio.
    const results = await Promise.all(
      calls.map(async (block) => {
        const outcome = await runTool(block);
        return { type: 'tool_result' as const, tool_use_id: block.id, content: outcome.content, ...(outcome.isError && { is_error: true }) };
      }),
    );
    messages.push({ role: 'user', content: results });
    emit({ type: 'user', message: { content: results.map(({ tool_use_id, is_error }) => ({ type: 'tool_result', tool_use_id, is_error })) } });
    await saveSession();
    if (abort.signal.aborted) break;
  }
  if (!abort.signal.aborted) emit({ type: 'result', subtype: 'success', result: reply, total_cost_usd: cost });
} catch (error) {
  if (!abort.signal.aborted) {
    await saveSession().catch(() => undefined);
    emit({ type: 'result', subtype: 'error_during_execution', errors: [error instanceof Error ? error.message : String(error)], total_cost_usd: cost });
  }
} finally {
  process.stdin.destroy();
}
