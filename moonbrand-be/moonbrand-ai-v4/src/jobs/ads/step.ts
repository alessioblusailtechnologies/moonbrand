import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { AdStepJobInput } from '@moonbrand/shared/api/contract';
import { AD_BID_STRATEGIES, AD_LIMITS as L, SNIPPET_HEADERS, type AdCampaignType, type AdStep } from '@moonbrand/shared/domain/ads';

import { replyRule } from '../../lib/language';

// Il wizard delle campagne Google: la persona scrive cosa vuole in un passaggio e qui si decide quali campi cambiare.
// Tutto è nel prompt: Sonnet senza tool, una risposta sola.

const [inputJson] = process.argv.slice(2);
if (!inputJson) {
  console.error('Uso: npm run ad-step -- <input del job in JSON>');
  process.exit(1);
}

const { step, instruction, draft, brand, today } = JSON.parse(inputJson) as Omit<AdStepJobInput, 'brandId'>;
const type: AdCampaignType = draft.campaignType ?? 'search';

const TYPES: Record<AdCampaignType, string> = {
  search: 'rete di ricerca (annunci di testo tra i risultati di Google)',
  display: 'Display (annunci con immagini sui siti e nelle app)',
  pmax: 'Performance Max (Google distribuisce su ricerca, YouTube, Display, Gmail, Maps)',
  demand_gen: 'Demand Gen (annunci con immagini o video su YouTube, Discover e Gmail)',
};

// Cosa si può cambiare in ogni passaggio. Nel primo e nell'ultimo tutto.
const STEPS: Record<AdStep, string> = {
  goal: 'Obiettivo: cosa promuovere. Prepara la campagna intera: nome, pagina di arrivo, testi, parole chiave se è sulla rete di ricerca, luoghi, lingua, budget e date.',
  ad: 'Annuncio: titoli, titoli lunghi, descrizioni, nome dell’attività, invito all’azione.',
  keywords: 'Parole chiave e parole escluse.',
  audience: 'Pubblico: luoghi, lingue, età, genere.',
  budget: 'Budget al giorno, date e offerta.',
  extras: 'Estensioni: sitelink, callout, snippet strutturato.',
  review: 'Riepilogo: qualsiasi campo.',
};

const limits = L[type];
const SYSTEM = `Aiuti a preparare una campagna Google Ads di tipo ${TYPES[type]} dentro moonbrand. La persona è nel passaggio «${STEPS[step]}» e ti scrive cosa vuole: cambia solo i campi di questo passaggio, salvo che chieda esplicitamente altro.
Limiti di Google per questo tipo: titoli da ${limits.headlines.min} a ${limits.headlines.max} di massimo ${limits.headlines.chars} caratteri; descrizioni da ${limits.descriptions.min} a ${limits.descriptions.max} di massimo ${limits.descriptions.chars}${type === 'search' ? '' : `; titoli lunghi fino a ${limits.longHeadlines.max} di massimo ${limits.longHeadlines.chars}; nome dell'attività di massimo ${L.businessName}`}${type === 'search' ? `; parole chiave di massimo ${L.keywords.chars} caratteri; sitelink con testo di massimo ${L.sitelinks.text} e righe di massimo ${L.sitelinks.description}; callout di massimo ${L.callouts.chars}; snippet con intestazione tra ${SNIPPET_HEADERS.join(', ')} e ${L.snippetValues.min}-${L.snippetValues.max} valori di massimo ${L.snippetValues.chars}` : ''}. Budget in unità intere al giorno tra ${L.dailyBudget.min} e ${L.dailyBudget.max}. Offerte possibili: ${AD_BID_STRATEGIES[type].join(', ')}. Date AAAA-MM-GG, oggi è ${today}, l'inizio non prima di oggi. endsOn null vuol dire senza fine.
I luoghi scrivili a parole in locationNames (es. «Milano», «Puglia», «Italia»): lo studio li cerca su Google. Le lingue con il codice di Google (it, en). Le immagini non le scegli tu.
Nel patch metti solo i campi che cambi, ciascuno intero (una lista si riscrive tutta). reply è una frase breve su cosa hai fatto, o una domanda se la richiesta non si capisce. I testi dell'annuncio sono nella lingua di chi cerca. ${replyRule()}`;

const prompt = `# Il brand
${brand.name}${brand.sector ? `, ${brand.sector}` : ''}${brand.pitch ? `: ${brand.pitch}` : ''}
Sito: ${brand.site || 'non indicato'}. Lingua dei post: ${brand.language}.

# La campagna com'è adesso
${JSON.stringify(draft, null, 2)}

# La richiesta
${instruction}`;

const strings = { type: 'array', items: { type: 'string' } };
const keyword = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'match'],
  properties: { text: { type: 'string' }, match: { type: 'string', enum: ['phrase', 'exact', 'broad'] } },
};

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'patch'],
  properties: {
    reply: { type: 'string' },
    patch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        goal: { type: 'string', enum: ['traffic', 'awareness', 'engagement'] },
        spec: {
          type: 'object',
          additionalProperties: false,
          properties: {
            linkUrl: { type: 'string' },
            headlines: strings,
            descriptions: strings,
            longHeadlines: strings,
            businessName: { type: 'string' },
            callToAction: { type: 'string' },
            keywords: { type: 'array', items: keyword },
            negativeKeywords: { type: 'array', items: keyword },
            sitelinks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'linkUrl'],
                properties: { text: { type: 'string' }, linkUrl: { type: 'string' }, description1: { type: 'string' }, description2: { type: 'string' } },
              },
            },
            callouts: strings,
            snippet: {
              type: 'object',
              additionalProperties: false,
              required: ['header', 'values'],
              properties: { header: { type: 'string', enum: [...SNIPPET_HEADERS] }, values: strings },
            },
            locationNames: { ...strings, description: 'Luoghi a parole, es. Milano, Puglia, Italia' },
            languages: { type: 'array', items: { type: 'string', description: 'Codice lingua di Google, es. it' } },
            ageMin: { type: 'integer' },
            ageMax: { type: 'integer' },
            genders: { type: 'array', items: { type: 'string', enum: ['male', 'female'] } },
            bidding: {
              type: 'object',
              additionalProperties: false,
              required: ['strategy'],
              properties: { strategy: { type: 'string', enum: [...AD_BID_STRATEGIES[type]] }, amount: { type: 'number' }, roas: { type: 'number' } },
            },
          },
        },
        dailyBudget: { type: 'integer' },
        startsOn: { type: 'string' },
        endsOn: { type: ['string', 'null'] },
      },
    },
  },
};

for await (const message of query({
  prompt,
  options: {
    // Fuori dal repo: dentro, Claude Code carica la memoria del progetto.
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
