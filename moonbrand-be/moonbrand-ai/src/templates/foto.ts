import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GoogleGenAI } from '@google/genai';

import { findTemplate } from '@moonbrand/shared/domain/templates';

import { TEMPLATES_DIR } from '../lib/templates';

// Le foto d'esempio di un template, solo per le anteprime: generate una volta, in esempio/ dentro il template.
// Nei contenuti dei brand non vanno mai (lo dice la sezione del template nel CLAUDE.md).

process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
const FORMATS = ['1:1', '4:5', '3:4', '2:3', '9:16', '16:9', '4:3', '3:2', '5:4'] as const;

const [id, file, format, description] = process.argv.slice(2);
if (!findTemplate(id) || !file || !/^[a-z0-9-]+\.jpg$/.test(file) || !FORMATS.includes(format as (typeof FORMATS)[number]) || !description) {
  console.error(`Uso: npm run template-foto -- <id del template> <nome.jpg> <${FORMATS.join('|')}> "<soggetto, inquadratura, luce, stile>"`);
  process.exit(1);
}
const { GEMINI_API_KEY } = process.env;
if (!GEMINI_API_KEY) {
  console.error('Manca GEMINI_API_KEY nel .env di moonbrand-ai.');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const interaction = await ai.interactions.create({
  model: 'gemini-3.1-flash-image',
  input: [{ type: 'text', text: description }],
  response_format: { type: 'image', aspect_ratio: format, image_size: '1K', mime_type: 'image/jpeg' },
});
const image = interaction.output_image;
if (!image?.data) {
  console.error('Gemini non ha restituito un’immagine: riformula la descrizione.');
  process.exit(1);
}
const target = path.join(TEMPLATES_DIR, id, 'esempio', file);
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, Buffer.from(image.data, 'base64'));
console.log(`Salvata ${path.relative(TEMPLATES_DIR, target)}`);
