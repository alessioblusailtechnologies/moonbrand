import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { IdeasJobInput } from '@moonbrand/shared/api/contract';

import { replyRule } from '../../lib/language';
import { HORIZON_DAYS, MAX_PER_THEME, MAX_TRENDS } from './rules';

// Le idee per il brand: tutto quello che serve è nel prompt (il brand arriva con il job), le regole sono poche righe
// qui sotto. Niente cartella del brand e niente skill: Claude cerca sul web e risponde con lo schema.

const inputJson = process.argv[2];
if (!inputJson) {
  console.error('Uso: npm run ideas -- <input del job in JSON>');
  process.exit(1);
}

const { count, brand, recent, preferences } = JSON.parse(inputJson) as Omit<IdeasJobInput, 'brandId'>;

const STATUS = { new: 'da decidere', saved: 'tenuta', discarded: 'scartata' } as const;
const SIGNALS = { theme: 'tema', trend: 'trend', recurrence: 'ricorrenza', season: 'stagione' } as Record<string, string>;

const day = (date: Date) => date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const today = new Date();
const horizon = new Date(today.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000);
const themeName = (id: string | null) => brand.themes.find((theme) => theme.id === id)?.name ?? 'nessun tema';
const score = (value: number) => `${value > 0 ? '+' : ''}${String(value).replace('.', ',')}`;
const list = (items: string[]) => (items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- nessuno');

const { identity, positioning } = brand;
const brandLines = [
  `${identity.name}${identity.sector ? `, ${identity.sector}` : ''}${identity.site ? ` (${identity.site})` : ''}`,
  identity.pitch,
  '',
  'Obiettivi:',
  list(positioning.goals),
  'Pubblico:',
  list(positioning.audiences),
  'Temi, con il loro id e il peso:',
  list(brand.themes.map((theme) => `${theme.name} (id ${theme.id}, peso ${theme.weight})`)),
  ...(brand.instructions.trim() ? ['', 'Istruzioni del brand:', brand.instructions.trim()] : []),
].join('\n');

function describeHistory(): string {
  const tastes =
    preferences.decided > 0
      ? [
          `Idee decise finora: ${preferences.decided}, tenute ${preferences.saved}.`,
          `Punteggio dei temi (+1 per ogni idea tenuta, -0,5 per ogni scartata): ${
            preferences.themes.map((item) => `${themeName(item.themeId)} ${score(item.score)}`).join('; ') || 'nessuno'
          }`,
          `Punteggio dei segnali: ${preferences.signals.map((item) => `${SIGNALS[item.kind] ?? item.kind} ${score(item.score)}`).join('; ') || 'nessuno'}`,
        ].join('\n')
      : 'Nessuna idea ancora decisa.';
  const titles =
    recent.length > 0 ? recent.map((idea) => `- [${STATUS[idea.status]}] ${idea.title} (${themeName(idea.themeId)}, ${SIGNALS[idea.signal] ?? idea.signal})`) : ['Nessuna.'];
  return ['## Gusti', tastes, '', '## Idee già proposte: non ripeterle', ...titles].join('\n');
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['ideas'],
  properties: {
    ideas: {
      type: 'array',
      minItems: 1,
      maxItems: count,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'angleLabel', 'angle', 'rationale', 'themeId', 'signal'],
        properties: {
          title: { type: 'string', description: 'L’idea in una frase specifica, massimo 110 caratteri, con la voce del brand' },
          angleLabel: { type: 'string', description: 'Il taglio in 2-4 parole, es. «Il dietro le quinte», «Prima e dopo», «La domanda frequente»' },
          angle: { type: 'string', description: 'Cosa raccontare e con quali elementi, in due o tre frasi, senza formato né canale' },
          rationale: { type: 'string', description: 'Perché ha senso adesso, in una frase che cita il segnale da cui nasce' },
          themeId: {
            type: ['string', 'null'],
            enum: [...brand.themes.map((theme) => theme.id), null],
            description: 'L’id del tema del brand che tocca, null se non ne tocca nessuno',
          },
          signal: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'sourceUrl'],
            description: 'Da dove nasce l’idea',
            properties: {
              kind: {
                type: 'string',
                enum: ['theme', 'trend', 'recurrence', 'season'],
                description: 'theme: un tema del brand; trend: una notizia trovata sul web; recurrence: una ricorrenza; season: il periodo dell’anno',
              },
              label: { type: 'string', description: 'Facoltativo: la fonte, la ricorrenza con il giorno o il periodo, in poche parole' },
              sourceUrl: { type: ['string', 'null'], description: 'Per un trend, l’indirizzo dell’articolo trovato; null per gli altri segnali' },
            },
          },
        },
      },
    },
  },
};

const prompt = `Proponi fino a ${count} idee di contenuto social nuove per questo brand. Oggi è ${day(today)}.

## Il brand
${brandLines}

## Come
- Meglio meno idee ma forti: specifiche di questo brand, con un gancio concreto, utili a un obiettivo e a un pubblico. Niente formati né canali.
- Prima cerca sul web notizie delle ultime settimane su settore e pubblico del brand. Un trend vale solo con una fonte vera, recente e pertinente; al massimo ${MAX_TRENDS}.
- Ricorrenze con la data esatta entro ${day(horizon)}, del paese del brand (se non è chiaro, l'Italia).
- Al massimo ${MAX_PER_THEME} idee sullo stesso tema; più spazio ai temi con più peso e più graditi.

${replyRule()}

${describeHistory()}`;

const workDir = await mkdtemp(path.join(tmpdir(), 'moonbrand-ideas-'));

try {
  for await (const message of query({
    prompt,
    options: {
      cwd: workDir,
      allowedTools: ['WebSearch', 'WebFetch'],
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      outputFormat: { type: 'json_schema', schema },
    },
  })) {
    console.log(JSON.stringify(message));
  }
} finally {
  await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
}
