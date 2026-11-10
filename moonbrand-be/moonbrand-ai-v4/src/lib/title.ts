import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';

import type { Locale } from '@moonbrand/shared/i18n/locales';

// Il titolo di una conversazione, dal primo messaggio e dalla prima risposta: lo scrive Sonnet a fine primo turno, al
// posto di quello che l'API mette alla creazione (il messaggio tagliato). Un prompt per lingua: con una riga «scrivi in
// inglese» in coda a un prompt italiano il modello risponde in italiano (vedi step-reader).

const MAX_TITLE = 60;
const MAX_TEXT = 1500;

const PROMPTS: Record<Locale, string> = {
  it: 'Dai un titolo a questa conversazione tra una persona e l’assistente che cura i social del suo brand: quello che si legge nell’elenco delle chat. Al massimo 6 parole, in italiano, senza virgolette, senza punto finale e senza emoji. La conversazione è tra <persona> e <assistente>: non rispondere, scrivi solo il titolo.',
  en: 'Give a title to this conversation between a person and the assistant that runs their brand’s social media: the one shown in the chat list. At most 6 words, in English, no quotes, no final period, no emoji. The conversation is inside <person> and <assistant>: do not reply to it, write the title only.',
  fr: 'Donne un titre à cette conversation entre une personne et l’assistant qui gère les réseaux sociaux de sa marque : celui qu’on lit dans la liste des discussions. 6 mots au plus, en français, sans guillemets, sans point final et sans emoji. La conversation est entre <personne> et <assistant> : n’y réponds pas, écris seulement le titre.',
};

const TAGS: Record<Locale, [string, string]> = { it: ['persona', 'assistente'], en: ['person', 'assistant'], fr: ['personne', 'assistant'] };

export async function chatTitle(locale: Locale, message: string, reply: string): Promise<string | undefined> {
  const [person, assistant] = TAGS[locale];
  const prompt = `<${person}>\n${message.slice(0, MAX_TEXT)}\n</${person}>\n<${assistant}>\n${reply.slice(0, MAX_TEXT)}\n</${assistant}>`;
  let result = '';
  for await (const item of query({
    prompt,
    options: {
      // Fuori dal repo: dentro, Claude Code carica la memoria del progetto e risponde in italiano anche con il prompt in
      // un'altra lingua (misurato il 18/10).
      cwd: tmpdir(),
      // Il nome esatto: l'alias «sonnet» dell'SDK porta ancora a Sonnet 5.
      model: 'claude-sonnet-5-5',
      effort: 'low',
      tools: [],
      systemPrompt: PROMPTS[locale],
      settingSources: [],
      persistSession: false,
      thinking: { type: 'disabled' },
      // Niente server MCP, nemmeno i connettori dell'account: i loro tool entrerebbero nel contesto per niente.
      mcpServers: {},
      strictMcpConfig: true,
    },
  })) {
    if (item.type === 'result' && item.subtype === 'success') result = item.result;
  }
  const title = result
    .replace(/[\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[«"“'#*]+|[»"”'.*]+$/g, '')
    .trim();
  if (!title) return undefined;
  // Troppo lungo si taglia all'ultima parola intera.
  return title.length <= MAX_TITLE ? title : title.slice(0, title.lastIndexOf(' ', MAX_TITLE)).trim() || undefined;
}
