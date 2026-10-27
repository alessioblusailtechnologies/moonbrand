import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { WelcomeJobInput } from '@moonbrand/shared/api/contract';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { SLOT_STATUS_LABELS } from '@moonbrand/shared/domain/plan';
import { DAY_PARTS, WELCOME_ICONS } from '@moonbrand/shared/domain/welcome';
import { formatWeekdayLong, formatWeekdayShort, planNow } from '@moonbrand/shared/lib/dates';

import { replyRule } from '../../lib/language';
import { GREETINGS_PER_PART, SUGGESTIONS } from './save';

// Il benvenuto della chat per un brand: i saluti di oggi per ogni fascia oraria e gli spunti per la prima domanda.
// Tutto quello che serve è nel prompt, quindi Sonnet senza tool e senza la cartella del brand: una risposta sola.

const [inputJson] = process.argv.slice(2);
if (!inputJson) {
  console.error('Uso: npm run welcome -- <input del job in JSON>');
  process.exit(1);
}

const { day, name, brand, signals } = JSON.parse(inputJson) as Omit<WelcomeJobInput, 'brandId'>;

const firstName = name.trim().split(/\s+/)[0] ?? '';
const list = (lines: string[]) => (lines.length > 0 ? lines.join('\n') : 'Niente.');

const PARTS: Record<(typeof DAY_PARTS)[number], string> = {
  mattina: 'dalle 5 a mezzogiorno',
  pranzo: 'da mezzogiorno alle 14:30',
  pomeriggio: 'dalle 14:30 alle 18:30',
  sera: 'dalle 18:30 alle 23',
  notte: 'dalle 23 alle 5',
};

const SYSTEM = `Sei l'assistente di moonbrand, l'app con cui persone e aziende curano i loro social. Scrivi il benvenuto che la persona vede quando apre la chat con te per un suo brand.
Il tono è il tuo, quello di Claude: simpatico ma professionale, caldo senza essere sdolcinato, mai da venditore.
I saluti sono il titolo della pagina: una frase breve, al massimo 55 caratteri, legata al momento della giornata. Il nome della persona in circa metà. Niente lavoro da fare, niente emoji, niente parole che indovinano il genere di chi legge (bentornato, pronta).
Gli spunti sono schede che la persona tocca: label è quello che legge (al massimo 60 caratteri), draft il messaggio che ti manda, in prima persona. Partono da quello che succede nel brand.
${replyRule()}`;

const { identity } = brand;
const prompt = `Oggi è ${formatWeekdayLong(day)} ${day.slice(0, 4)}, ora di Roma (adesso sono le ${planNow().time}, ma i saluti valgono per tutto il giorno).
La persona si chiama ${firstName || '(nome non indicato: non usarlo)'}.

# Il brand
${identity.name}${identity.sector ? `, ${identity.sector}` : ''}${identity.pitch ? `: ${identity.pitch}` : ''}

# Il piano delle prossime due settimane
${list(
  brand.plan.map(
    (slot) =>
      `- ${formatWeekdayShort(slot.date)} ${slot.time} · ${slot.channels.map(channelName).join(', ')} · ${SLOT_STATUS_LABELS[slot.status]}` +
      `${slot.title ? ` · «${slot.title}»` : ''}${slot.theme ? ` · tema ${slot.theme}` : ''}`,
  ),
)}

# Lo stato del brand
- Questa settimana: ${signals.week.planned} uscite con qualcosa dentro, il ritmo del brand ne chiede ${signals.week.target}.
- Ultima uscita pubblicata: ${signals.lastPublished ? formatWeekdayLong(signals.lastPublished) : 'nessuna finora'}.
- Bozze da approvare: ${signals.drafts.length > 0 ? signals.drafts.map((draft) => `«${draft.title}»`).join('; ') : 'nessuna'}.
- Idee tenute e non ancora usate: ${signals.savedIdeas.length > 0 ? signals.savedIdeas.map((title) => `«${title}»`).join('; ') : 'nessuna'}.
- Ricorrenze e date del brand da qui a una settimana: ${
  [
    ...signals.occasions.map((occasion) => `${formatWeekdayLong(occasion.date)} ${occasion.name}`),
    ...signals.milestones.map((milestone) => `${formatWeekdayLong(milestone.date)} ${milestone.anniversary ? 'anniversario di ' : ''}${milestone.label}`),
  ].join('; ') || 'nessuna'
}.

# Cosa scrivere
${GREETINGS_PER_PART} saluti per ciascuna fascia oraria (${DAY_PARTS.map((part) => `${part} ${PARTS[part]}`).join(', ')}) e ${SUGGESTIONS} spunti.`;

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
        properties: { part: { type: 'string', enum: [...DAY_PARTS] }, text: { type: 'string' } },
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
          label: { type: 'string' },
          draft: { type: 'string' },
        },
      },
    },
  },
};

for await (const message of query({
  prompt,
  options: {
    // Fuori dal repo: dentro, Claude Code carica la memoria del progetto, che porta l'italiano.
    cwd: tmpdir(),
    // Il nome esatto: l'alias «sonnet» dell'SDK porta ancora a Sonnet 5.
    model: 'claude-sonnet-5-5',
    tools: [],
    systemPrompt: SYSTEM,
    settingSources: [],
    persistSession: false,
    thinking: { type: 'disabled' },
    mcpServers: {},
    strictMcpConfig: true,
    outputFormat: { type: 'json_schema', schema },
  },
})) {
  console.log(JSON.stringify(message));
}
