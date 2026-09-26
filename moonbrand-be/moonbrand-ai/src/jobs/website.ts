import { query } from '@anthropic-ai/claude-agent-sdk';

const site = process.argv[2];
if (!site) {
  console.error('Uso: npm run website -- <url>');
  process.exit(1);
}

const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['site', 'name', 'sector', 'summary', 'pitch', 'themes', 'goals', 'audiences', 'colors'],
  properties: {
    site: { type: 'string', description: 'Dominio del sito, senza protocollo né www' },
    name: { type: 'string', description: 'Nome del brand come appare sul sito' },
    sector: { type: 'string', description: 'Settore in poche parole, in italiano (es. "Parrucchiere", "Panificio artigianale")' },
    summary: { type: 'string', description: 'Cosa fa il brand, 2-3 frasi' },
    pitch: { type: 'string', description: 'Il pitch del brand in una frase, in prima persona' },
    themes: { type: 'array', items: { type: 'string' }, description: 'Temi editoriali per i social, 4-8' },
    goals: { type: 'array', items: { type: 'string' }, description: 'Perché il brand pubblica sui social: obiettivi brevi, 3-5, dal più importante' },
    audiences: { type: 'array', items: { type: 'string' }, description: 'Chi vuole raggiungere con i social: pubblici brevi, 2-5, dal più importante' },
    colors: {
      type: 'array',
      items: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
      minItems: 4,
      maxItems: 4,
      description: 'Palette del sito in esadecimale: primario, secondario, accento, sfondo',
    },
  },
};

const prompt = `Leggi il sito ${site} e ricava le informazioni sul brand. Rispondi in italiano.`;

for await (const message of query({
  prompt,
  options: {
    allowedTools: ['WebFetch', 'WebSearch'],
    permissionMode: 'bypassPermissions',
    allowDangerouslySkipPermissions: true,
    outputFormat: { type: 'json_schema', schema },
  },
})) {
  console.log(JSON.stringify(message));
}
