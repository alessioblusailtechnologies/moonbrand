import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import { BRAND_CATEGORIES } from '@moonbrand/shared/domain/brand';
import { categoryLabel } from '@moonbrand/shared/domain/catalog';

import { languageName, replyRule, uiLocale } from '../lib/language';

const site = process.argv[2];
if (!site) {
  console.error('Uso: npm run website -- <url>');
  process.exit(1);
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['site', 'name', 'sector', 'category', 'summary', 'pitch', 'themes', 'goals', 'audiences', 'colors', 'fonts', 'logo', 'language'],
  properties: {
    site: { type: 'string', description: 'Dominio del sito, senza protocollo né www' },
    name: { type: 'string', description: 'Nome del brand come appare sul sito' },
    sector: { type: 'string', description: `Settore in poche parole, in ${languageName(uiLocale)} (es. "Parrucchiere", "Panificio artigianale")` },
    category: {
      type: ['string', 'null'],
      enum: [...BRAND_CATEGORIES, null],
      description: `Il tipo di attività, tra: ${BRAND_CATEGORIES.map((id) => `${id} (${categoryLabel(id)})`).join(', ')}. Quella che fa davvero il brand, non i clienti a cui si rivolge; null se nessuna è adatta`,
    },
    summary: { type: 'string', description: 'Cosa fa il brand, 2-3 frasi' },
    pitch: { type: 'string', description: 'Il pitch del brand in una frase, in prima persona' },
    themes: { type: 'array', items: { type: 'string' }, description: 'Temi editoriali per i social, 3-5, dal più importante' },
    goals: { type: 'array', items: { type: 'string' }, description: 'Perché il brand pubblica sui social: obiettivi brevi, 3-5, dal più importante' },
    audiences: { type: 'array', items: { type: 'string' }, description: 'Chi vuole raggiungere con i social: pubblici brevi, 2-5, dal più importante' },
    colors: {
      type: 'array',
      items: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      minItems: 4,
      maxItems: 4,
      description: 'Palette del sito in esadecimale: primario, secondario, accento, sfondo',
    },
    fonts: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['titles', 'text', 'found'],
      properties: {
        titles: { type: 'string', description: 'La famiglia di Google Fonts per i titoli, scritta come su fonts.google.com (es. "Playfair Display")' },
        text: { type: 'string', description: 'La famiglia di Google Fonts per i testi, scritta come su fonts.google.com (es. "Work Sans")' },
        found: {
          type: ['string', 'null'],
          description: 'I font che usa davvero il sito, se sono diversi da quelli scelti (di sistema, a pagamento o di bassa qualità); null se coincidono',
        },
      },
      description: 'I font del brand; null se il sito non ne ha di riconoscibili',
    },
    language: {
      type: 'string',
      pattern: '^[a-z]{2}$',
      description: 'La lingua principale dei testi del sito, come codice ISO 639-1 (es. it, en, fr, de, es); se il sito è in più lingue, quella della home',
    },
    logo: {
      type: ['string', 'null'],
      pattern: '^https?://',
      description: 'L’indirizzo completo dell’immagine del logo (PNG, JPEG, WebP o SVG), dopo averla guardata; null se il sito non ha un logo riconoscibile',
    },
  },
};

// Una cartella solo per questo job: i candidati per il logo si scaricano qui e si guardano, poi si butta tutto.
const workDir = await mkdtemp(path.join(tmpdir(), 'moonbrand-website-'));

const prompt = `Leggi il sito ${site} e ricava le informazioni sul brand. ${replyRule()}

Trova anche il logo: di solito è in testata o nel footer, a volte è la prima immagine della pagina o un'immagine con il nome del brand; l'immagine dell'anteprima social e la favicon sono ripieghi. Scarica i candidati con curl nella cartella corrente e guardali con Read prima di scegliere: il logo è il marchio o la scritta del brand, non un banner, una foto o un'icona generica.

Trova anche i font: scarica con curl l'HTML e i fogli di stile, e cerca la font-family dei titoli (h1, h2) e dei testi (body, p), i link a Google Fonts o Adobe Fonts e le regole @font-face. Per titoli e testi scegli una famiglia di Google Fonts:
- la stessa del sito, se è su Google Fonts ed è un font curato;
- se il sito usa un font di sistema (Arial, Helvetica, Times New Roman, Georgia, Verdana, Tahoma, system-ui e simili), un font a pagamento o non disponibile, o un font di bassa qualità, la famiglia di Google Fonts di alta qualità più simile per genere e carattere (grottesco, geometrico, umanista, con le grazie, slab, condensato), e scrivi in found quelli del sito.
Controlla su fonts.google.com che le famiglie scelte esistano, scritte esattamente così.`;

try {
  for await (const message of query({
    prompt,
    options: {
      cwd: workDir,
      allowedTools: ['WebFetch', 'WebSearch', 'Bash', 'Read'],
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
