import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';

import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import { STEP_MODEL } from '../config/env';

// I passaggi che la tabella di moonbrand-shared non sa tradurre (Bash, Read, il testo che Claude si scrive tra un
// passaggio e l'altro) li legge Haiku, sullo stesso login di Claude Code. Una sessione per job: il contesto ha solo i
// passaggi di quel job, e il processo parte con il job, così alla prima richiesta è già pronto. Le richieste che
// arrivano mentre Haiku risponde partono tutte insieme alla volta dopo.

// null: lo step non dice niente a chi aspetta e non si mostra.
export type StepReading = { label: string } | null;

export interface StepRequest {
  tool: string;
  input: unknown;
}

export interface StepReader {
  // onRead riceve undefined se Haiku non c'è o risponde male: allora chi chiede usa la sua etichetta di riserva.
  read(request: StepRequest, onRead: (reading: StepReading | undefined) => void): void;
  // Aspetta al massimo graceMs le letture in corso, poi chiude la sessione.
  close(graceMs: number): Promise<void>;
}

const MAX_STRING = 200;
const MAX_INPUT = 600;
const MAX_LABEL = 60;
const CACHE_SIZE = 500;
// Se nella risposta resta qualcosa di tecnico (percorsi, file, nomi di tool, di servizi e di modelli, misure, id) la
// lettura si butta e lo step prende l'etichetta di riserva.
const TECHNICAL =
  /[\\/]|\.(md|json|ts|js|mjs|tsx|html|css|png|jpe?g|webp|mp4|mp3|wav|txt|sh)\b|mcp__|_[a-z]|\d+x\d+|\w-\d|\b[a-f0-9]{8,}\b|\b(bash|grep|glob|npm|npx|pnpm|node|curl|ffmpeg|remotion|json|tool|lambda|aws|gemini|elevenlabs|claude|anthropic|haiku|sonnet|opus|chrome|cartell[ae]|file|folder|fichiers?|dossiers?)\b/i;

// Un prompt per lingua, scritto per intero nella lingua di chi aspetta, esempi compresi: con il prompt in italiano e una
// riga «scrivi in inglese» in coda Haiku rispondeva comunque in italiano.
const PROMPTS: Record<Locale, string> = {
  it: `Traduci i passaggi di un agente che prepara i social di un brand in righe per il cliente, che le vede scorrere mentre aspetta.

Ti arriva un array JSON di passaggi: id, tool (lo strumento usato; "testo" è quello che l'agente si scrive tra un passaggio e l'altro) e input.
Rispondi solo con un array JSON, un oggetto per ogni id, senza altro testo: {"id": "...", "label": "..."} oppure {"id": "...", "hide": true}.

- label: cosa sta facendo, in prima persona singolare, al presente, al massimo 7 parole, senza punto finale. Per esempio: «Rileggo la voce del brand», «Guardo le foto che mi hai mandato», «Cerco i colori nel codice del sito», «Monto il video», «Controllo le immagini finali».
- Mai percorsi, cartelle, file, estensioni, comandi, codice, nomi di strumenti, di modelli o di servizi (anche quelli che leggi nei comandi, come Lambda, Gemini o Remotion), termini tecnici inglesi. Il lavoro si dice con parole da cliente: «Esporto i video finali», non dove o con cosa.
- hide: true per i passaggi che al cliente non dicono niente: creare cartelle, installare, controllare che un file ci sia, organizzarsi il lavoro, riprovare la stessa cosa, e il testo che non dice cosa sta per fare (saluti, resoconti, conferme).
- Per il testo dell'agente la label è quello che sta per fare, detto in breve («Scrivo il post»).
- I passaggi arrivano in ordine: usa quelli già visti per capire il filo. Se un passaggio continua lo stesso lavoro del precedente con la stessa label, hide.
- Non inventare: se non si capisce cosa fa, «${translate('it', 'steps.fallback')}».`,
  en: `Turn the steps of an agent preparing a brand's social media into lines for the customer, who watches them scroll by while waiting.

You receive a JSON array of steps: id, tool (the tool used; "testo" is what the agent writes to itself between one step and the next) and input. The agent works in Italian: its text, commands and file names are Italian.
Reply only with a JSON array, one object per id, no other text: {"id": "...", "label": "..."} or {"id": "...", "hide": true}.

- label: what it is doing, in English, with the gerund and no subject, at most 7 words, no full stop. For example: "Rereading the brand voice", "Looking at the photos you sent", "Looking for the colours in the site code", "Editing the video", "Checking the final images".
- Never paths, folders, files, extensions, commands, code, names of tools, models or services (even those you read in commands, such as Lambda, Gemini or Remotion), technical terms. Say the work in the customer's words: "Exporting the final videos", not where or with what.
- hide: true for steps that mean nothing to the customer: creating folders, installing, checking that a file exists, organising the work, retrying the same thing, and text that does not say what it is about to do (greetings, reports, confirmations).
- For the agent's text the label is what it is about to do, in short ("Writing the post").
- The steps arrive in order: use the ones already seen to follow the thread. If a step continues the same work as the previous one with the same label, hide.
- Do not make things up: if it is not clear what it does, "${translate('en', 'steps.fallback')}".`,
  fr: `Transformez les étapes d'un agent qui prépare les réseaux sociaux d'une marque en lignes pour le client, qui les voit défiler pendant qu'il attend.

Vous recevez un tableau JSON d'étapes : id, tool (l'outil utilisé ; « testo » est ce que l'agent s'écrit entre une étape et la suivante) et input. L'agent travaille en italien : son texte, ses commandes et les noms de fichiers sont en italien.
Répondez uniquement avec un tableau JSON, un objet par id, sans autre texte : {"id": "...", "label": "..."} ou {"id": "...", "hide": true}.

- label : ce qu'il est en train de faire, en français, à la première personne, au présent, en vouvoyant le client, 7 mots au maximum, sans point final. Par exemple : « Je relis la voix de la marque », « Je regarde les photos que vous avez envoyées », « Je cherche les couleurs dans le code du site », « Je monte la vidéo », « Je vérifie les images finales ».
- Jamais de chemins, dossiers, fichiers, extensions, commandes, code, noms d'outils, de modèles ou de services (même ceux lus dans les commandes, comme Lambda, Gemini ou Remotion), ni de termes techniques. Le travail se dit avec les mots du client : « J'exporte les vidéos finales », pas où ni avec quoi.
- hide : true pour les étapes qui ne disent rien au client : créer des dossiers, installer, vérifier qu'un fichier existe, s'organiser, réessayer la même chose, et le texte qui ne dit pas ce qu'il va faire (salutations, comptes rendus, confirmations).
- Pour le texte de l'agent, le label est ce qu'il va faire, en bref (« J'écris la publication »).
- Les étapes arrivent dans l'ordre : servez-vous de celles déjà vues pour suivre le fil. Si une étape continue le même travail que la précédente avec le même label, hide.
- N'inventez rien : si l'on ne comprend pas ce qu'il fait, « ${translate('fr', 'steps.fallback')} ».`,
};

// Le letture valgono per tutti i job della stessa lingua: la chiave è la lingua e il passaggio, con i percorsi già senza la
// cartella del brand.
const cache = new Map<string, StepReading>();

function remember(key: string, reading: StepReading): void {
  cache.set(key, reading);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!);
}

function readingOf(item: { hide?: unknown; label?: unknown }): StepReading | undefined {
  if (item.hide === true) return null;
  if (typeof item.label !== 'string') return undefined;
  const label = item.label.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  return label && label.length <= MAX_LABEL && !TECHNICAL.test(label) ? { label } : undefined;
}

// brandsDir: la cartella dei brand, che con l'id del brand si toglie dai percorsi prima di mandarli a Haiku.
export function createStepReader(brandsDir: string, locale: Locale): StepReader {
  const root = brandsDir.replaceAll('\\', '/').replace(/\/+$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const brandDir = new RegExp(`${root}/[^/]+/?`, 'gi');
  // L'input accorciato: di un file scritto basta l'inizio, di un comando la prima parte.
  const shortInput = (input: unknown): string =>
    (
      JSON.stringify(input, (_key, value: unknown) => {
        if (typeof value !== 'string') return value;
        const plain = value.replaceAll('\\', '/').replace(brandDir, '');
        return plain.length > MAX_STRING ? `${plain.slice(0, MAX_STRING)}…` : plain;
      }) ?? ''
    ).slice(0, MAX_INPUT);

  type Pending = { id: string; key: string; request: StepRequest; onRead: (reading: StepReading | undefined) => void };
  let queued: Pending[] = [];
  let sent: Pending[] = [];
  let counter = 0;
  let closed = false;
  let failed = false;
  // wake: è arrivata una richiesta; answered: Haiku ha risposto; idle: non c'è più niente in corso.
  let wake: (() => void) | undefined;
  let answered: (() => void) | undefined;
  let idle: (() => void) | undefined;
  const abort = new AbortController();

  // Il prompt della sessione: un messaggio per ogni gruppo di richieste, il successivo solo dopo la risposta.
  async function* messages(): AsyncGenerator<SDKUserMessage> {
    while (!closed) {
      if (queued.length === 0) {
        idle?.();
        await new Promise<void>((resolve) => (wake = resolve));
        continue;
      }
      sent = queued;
      queued = [];
      const content = JSON.stringify(sent.map(({ id, request }) => ({ id, tool: request.tool, input: shortInput(request.input) })));
      yield { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null };
      await new Promise<void>((resolve) => (answered = resolve));
    }
  }

  function answer(text: string): void {
    let items: unknown;
    try {
      items = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
    } catch {
      items = [];
    }
    const byId = new Map<string, Record<string, unknown>>(Array.isArray(items) ? items.map((item: Record<string, unknown>) => [String(item?.id), item]) : []);
    for (const { id, key, onRead } of sent) {
      const item = byId.get(id);
      const reading = item && typeof item === 'object' ? readingOf(item) : undefined;
      if (reading !== undefined) remember(key, reading);
      onRead(reading);
    }
    sent = [];
    answered?.();
  }

  void (async () => {
    try {
      for await (const message of query({
        prompt: messages(),
        options: { model: STEP_MODEL, effort: 'low', tools: [], systemPrompt: PROMPTS[locale], settingSources: [], persistSession: false, thinking: { type: 'disabled' }, abortController: abort },
      })) {
        if (message.type === 'result') answer(message.subtype === 'success' ? message.result : '');
      }
    } catch (error) {
      if (!abort.signal.aborted) console.error('Lettura dei passaggi interrotta', error);
    } finally {
      // Se la sessione cade prima di close, le richieste in sospeso e quelle dopo restano senza lettura.
      failed = !abort.signal.aborted;
      closed = true;
      const pending = [...sent, ...queued];
      queued = [];
      sent = [];
      if (failed) for (const { onRead } of pending) onRead(undefined);
      idle?.();
    }
  })();

  return {
    read(request, onRead) {
      const key = `${locale} ${request.tool} ${shortInput(request.input)}`;
      const known = cache.get(key);
      if (known !== undefined) {
        onRead(known);
        return;
      }
      if (closed) {
        if (failed) onRead(undefined);
        return;
      }
      queued.push({ id: String(++counter), key, request, onRead });
      wake?.();
    },
    async close(graceMs) {
      if (!closed && (queued.length > 0 || sent.length > 0)) {
        await Promise.race([new Promise<void>((resolve) => (idle = resolve)), new Promise((resolve) => setTimeout(resolve, graceMs))]);
      }
      closed = true;
      wake?.();
      answered?.();
      abort.abort();
    },
  };
}
