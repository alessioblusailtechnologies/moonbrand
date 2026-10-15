import { query } from '@anthropic-ai/claude-agent-sdk';

import type { WelcomeJobInput } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { SLOT_STATUS_LABELS } from '@moonbrand/shared/domain/plan';
import { DAY_PARTS, WELCOME_ICONS } from '@moonbrand/shared/domain/welcome';
import { formatWeekdayLong, formatWeekdayShort, planNow } from '@moonbrand/shared/lib/dates';

import { describeBrand } from '../lib/brand-brief';
import { replyRule } from '../lib/language';
import { GREETINGS_PER_PART, SUGGESTIONS } from '../lib/welcome-rules';

// Il benvenuto della chat per un brand: i saluti di oggi per ogni fascia oraria e gli spunti per la prima domanda.
// Tutto quello che serve è nel prompt, quindi Sonnet senza tool e senza la cartella del brand: una risposta sola.

const [inputJson] = process.argv.slice(2);
if (!inputJson) {
  console.error('Uso: npm run welcome -- <input del job in JSON>');
  process.exit(1);
}

const { day, name, brand, signals } = JSON.parse(inputJson) as Omit<WelcomeJobInput, 'brandId'>;
const { GEMINI_API_KEY: _gemini, ...env } = process.env;

const firstName = name.trim().split(/\s+/)[0] ?? '';
const list = (lines: string[], empty: string) => (lines.length > 0 ? lines.join('\n') : empty);

const PARTS: Record<(typeof DAY_PARTS)[number], string> = {
  mattina: 'mattina, dalle 5 a mezzogiorno',
  pranzo: 'ora di pranzo, da mezzogiorno alle 14:30',
  pomeriggio: 'pomeriggio, dalle 14:30 alle 18:30',
  sera: 'sera, dalle 18:30 alle 23',
  notte: 'notte, dalle 23 alle 5',
};

const SYSTEM = `Sei l'assistente di moonbrand, l'app con cui persone e aziende curano i loro social: idee, post, caroselli, video e il piano delle uscite.
Scrivi il benvenuto che la persona vede quando apre la chat con te per un suo brand: i saluti e gli spunti per la prima domanda.

I saluti:
- Sono il titolo della pagina, la prima cosa che la persona legge: un saluto, non un rapporto. Brevi, al massimo 55 caratteri, una frase sola.
- Caldi, leggeri, da mezzo sorriso: come ti saluta un collega simpatico quando entri in ufficio. Mai sdolcinati, mai da venditore, mai battute forzate.
- Niente lavoro da fare nei saluti: niente piano, uscite, post da preparare, bozze, numeri, settimane «da riempire», «indietro» o «vuote». Niente che suoni come un promemoria o un rimprovero. Di quello si occupano gli spunti, subito sotto.
- Si appoggiano al momento: l'ora, il giorno della settimana (il lunedì che riparte, il venerdì che arriva, il sabato in cui si lavora lo stesso), la ricorrenza di oggi. Il brand o il suo settore al massimo in un saluto per fascia, e con leggerezza, mai per dire cosa manca.
- Il nome della persona in circa metà dei saluti, mai il cognome, tra virgole come si fa con chi si chiama («Buongiorno, Marta»).
- Mai un aggettivo o un participio riferito alla persona che ne indovini il genere («bentornato», «bentrovata», «pronta», «stanco», «benvenuto», «sveglio», «carica»): scegli formule che valgono per chiunque («che bello rivederti», «eccoci qui», «ancora al lavoro?»).
- Niente emoji, niente punti esclamativi di fila, niente virgolette.
- Frasi che una persona direbbe davvero: se un saluto suona forzato, meglio uno semplice.
- Solo fatti che trovi qui: non inventare il meteo, partite, eventi o lanci.
- Ogni fascia oraria i suoi: di sera non si dice buongiorno, di notte si nota con garbo e un sorriso che è tardi.
- Il registro: una domanda o una constatazione leggera sul momento, che fa sorridere senza fare la battuta, come
  «Ancora al lavoro, Marta?» a mezzanotte. Non descrizioni del giorno («Il martedì volge al termine», «Una sera di
  ottobre»): quelle non sorridono.
- Per fascia al massimo un saluto semplice («Buongiorno, Marta»): gli altri hanno un guizzo.
- Sotto, per ogni fascia, qualche saluto nel tono giusto: puoi riprenderne uno, gli altri scrivili tu sullo stesso
  registro, legati a oggi quando si può (il giorno della settimana, la stagione, la ricorrenza).

Gli spunti:
- Sono schede che la persona tocca per riempire la casella della chat: il label è quello che legge, il draft è il messaggio che ti manda, in prima persona e dando del tu a te (es. «Prepara il carosello di giovedì sul tema Formazione»).
- Nascono da quello che succede nel brand: uscite da preparare o da approvare nei prossimi giorni, una settimana sotto il ritmo, bozze ferme, idee tenute e mai usate, una ricorrenza o una data del brand in arrivo, da quanto non esce niente.
- Almeno due devono partire da un fatto preciso del piano o dello stato del brand, citandolo (il giorno, il titolo, il tema). Gli altri possono essere idee utili adesso per il settore del brand.
- Label e draft dicono la stessa cosa: il draft è il label detto per esteso.
- Al massimo uno spunto può restare aperto perché la persona lo completi: allora il label finisce con i puntini e il draft si ferma allo stesso punto (label «Scrivi un post su…», draft «Scrivi un post su »). Uno spunto che parte da un fatto preciso non resta mai aperto.
- Label al massimo 60 caratteri, niente emoji. Cose diverse tra loro: non quattro modi di dire «fai un post».
- Cose che sai fare: proporre idee, scrivere post, caroselli e video (anche dalle foto che ti mandano), ritoccare i contenuti, riempire e spostare le uscite del piano, dire cosa è uscito e cosa manca. Approvare no: lo fa la persona in Contenuti, quindi per una bozza lo spunto è rivederla o ritoccarla con te.

${replyRule()}`;

// Saluti nel tono giusto, da cui il prompt pesca a caso: il modello prende il registro dagli esempi, e con pochi esempi
// sempre uguali scriverebbe ogni giorno gli stessi saluti. Il nome è Marta, al posto di quello vero.
const TONE: Record<(typeof DAY_PARTS)[number], string[]> = {
  mattina: [
    'Caffè fatto? Si comincia',
    'Buongiorno, Marta: si parte con calma',
    'Eccoci qui, di buon\'ora',
    'Mattina presto, idee fresche',
    'Buongiorno, Marta. Com\'è il cielo da te?',
    'Lunedì, piano piano si ingrana',
    'Venerdì mattina: si vede il traguardo',
    'Che bello rivederti di prima mattina',
  ],
  pranzo: [
    'Pausa pranzo o si tira dritto?',
    'Un\'idea al volo prima di mangiare?',
    'Buon pranzo, Marta. O è ancora un caffè?',
    'Mezzogiorno passato: com\'è andata finora?',
    'Si mangia o si scrive, Marta?',
    'Pranzo veloce e poi idee lente?',
  ],
  pomeriggio: [
    'Come va la giornata, Marta?',
    'Pomeriggio da idee, si direbbe',
    'Secondo tempo della giornata, Marta',
    'Un caffè del pomeriggio e ci siamo',
    'Eccoci qui, a metà pomeriggio',
    'Il pomeriggio è giovane, Marta',
  ],
  sera: [
    'Ultime cose prima di staccare?',
    'Che bello rivederti, anche a quest\'ora',
    'Buonasera, Marta. Giornata lunga?',
    'Un\'ultima idea e poi a cena?',
    'Si chiude la giornata, Marta, o si apre qualcosa?',
    'Venerdì sera e ancora qui: rispetto',
  ],
  notte: [
    'Ancora al lavoro, Marta?',
    'Si è fatto tardi, Marta',
    'Le idee migliori arrivano di notte?',
    'Il mondo dorme, tu scrivi',
    'Notte fonda, idee chiare?',
    'A quest\'ora si lavora solo per passione',
  ],
};

// Tre per fascia, a caso: ogni giorno e ogni brand ne vedono altri.
function toneExamples(part: (typeof DAY_PARTS)[number]): string {
  const pool = [...TONE[part]];
  const picked: string[] = [];
  while (picked.length < 3 && pool.length > 0) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  return picked.map((text) => `«${text}»`).join(', ');
}

const plan = list(
  brand.plan.map(
    (slot) =>
      `- ${formatWeekdayShort(slot.date)} ${slot.time} · ${slot.channels.map(channelName).join(', ')} · ${SLOT_STATUS_LABELS[slot.status]}` +
      `${slot.title ? ` · «${slot.title}»` : ''}${slot.theme ? ` · tema ${slot.theme}` : ''}`,
  ),
  'Nessuna uscita nei prossimi 14 giorni.',
);

const prompt = `Oggi è ${formatWeekdayLong(day)} ${day.slice(0, 4)}, ora di Roma (adesso sono le ${planNow().time}, ma i saluti valgono per tutto il giorno).
La persona si chiama ${firstName || '(nome non indicato: non usarlo)'}.

# Il brand
${describeBrand(brand)}

# Le prossime due settimane del piano
${plan}

# Lo stato del brand
- Questa settimana: ${signals.week.planned} uscite con qualcosa dentro, il ritmo del brand ne chiede ${signals.week.target}.
- Ultima uscita pubblicata: ${signals.lastPublished ? formatWeekdayLong(signals.lastPublished) : 'nessuna finora'}.
- Bozze da approvare: ${signals.drafts.length > 0 ? signals.drafts.map((draft) => `«${draft.title}» (ferma dal ${formatWeekdayShort(draft.updatedAt.slice(0, 10))})`).join('; ') : 'nessuna'}.
- Idee tenute e non ancora usate: ${signals.savedIdeas.length > 0 ? signals.savedIdeas.map((title) => `«${title}»`).join('; ') : 'nessuna'}.
- Ultime conversazioni con te: ${signals.recentChats.length > 0 ? signals.recentChats.map((title) => `«${title}»`).join('; ') : 'nessuna'}.

# Ricorrenze e date del brand da oggi a una settimana
${list(
  [
    ...signals.occasions.map((occasion) => `- ${formatWeekdayLong(occasion.date)}: ${occasion.name}`),
    ...signals.milestones.map((milestone) => `- ${formatWeekdayLong(milestone.date)}: ${milestone.anniversary ? 'anniversario di ' : ''}${milestone.label} (data del brand)`),
  ],
  'Nessuna.',
)}

# Cosa scrivere
${GREETINGS_PER_PART} saluti per ciascuna fascia oraria:
${DAY_PARTS.map((part) => `- ${part}: ${PARTS[part]}. Nel tono di ${toneExamples(part)}`).join('\n')}
E ${SUGGESTIONS} spunti.`;

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['greetings', 'suggestions'],
  properties: {
    greetings: {
      type: 'array',
      minItems: DAY_PARTS.length,
      maxItems: DAY_PARTS.length * GREETINGS_PER_PART,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['part', 'text'],
        properties: {
          part: { type: 'string', enum: [...DAY_PARTS] },
          text: { type: 'string', description: 'Il saluto, al massimo 55 caratteri' },
        },
      },
    },
    suggestions: {
      type: 'array',
      minItems: 2,
      maxItems: SUGGESTIONS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['icon', 'label', 'draft'],
        properties: {
          icon: {
            type: 'string',
            enum: [...WELCOME_ICONS],
            description:
              'sparkle: idee; layers: carosello; pen: scrivere o ritoccare; bar-chart: com’è andata; lightbulb: un’idea tenuta; calendar: il piano; clock: una scadenza vicina; file-text: una bozza; image-plus: dalle foto; check: da approvare',
          },
          label: { type: 'string', description: 'Il testo della scheda, al massimo 60 caratteri' },
          draft: { type: 'string', description: 'Il messaggio che finisce nella casella' },
        },
      },
    },
  },
};

for await (const message of query({
  prompt,
  options: {
    model: 'sonnet',
    tools: [],
    systemPrompt: SYSTEM,
    settingSources: [],
    persistSession: false,
    thinking: { type: 'disabled' },
    // Niente server MCP, nemmeno i connettori dell'account: i loro tool entrerebbero nel contesto per niente.
    mcpServers: {},
    strictMcpConfig: true,
    settings: { disableClaudeAiConnectors: true },
    env,
    outputFormat: { type: 'json_schema', schema },
  },
})) {
  console.log(JSON.stringify(message));
}
