// Prova 14/10: il post lo disegna un modello di immagini, non l'HTML.
// Uso: node genera.mjs <brand> <modello> [varianti]
//   modello Google: gemini-3-pro-image | gemini-nano-banana-2.1 | gemini-3.1-flash-image
//   modello OpenAI: gpt-image-2 | gpt-image-2.5-sunburst | gpt-image-2.5-flare | gpt-image-1.5
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { brands } from './brand.mjs';

const [name, model, count = '3'] = process.argv.slice(2);
const brand = brands[name];
if (!brand || !model) {
  console.error('Uso: node genera.mjs <oconnors|sunraise> <modello> [varianti]');
  process.exit(1);
}

// Le chiavi stanno nei .env dei motori: non si copiano qui.
const ENV = ['../../../moonbrand-ai/.env', '../../../moonbrand-ai-openai/.env'];
async function key(wanted) {
  for (const file of ENV) {
    const text = await readFile(file, 'utf8').catch(() => '');
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${wanted}=`));
    const value = line ? line.slice(wanted.length + 1).replace(/^"|"$/g, '').trim() : '';
    if (value.length > 10) return value;
  }
  throw new Error(`Manca ${wanted} nei .env`);
}

const mime = (file) => (file.endsWith('.png') ? 'image/png' : 'image/jpeg');
const files = [brand.logo, ...brand.refs].map((f) => path.join(brand.dir, f));
const images = await Promise.all(files.map(async (f) => ({ file: f, mime: mime(f), bytes: await readFile(f) })));
const outDir = path.join('uscite', name);
await mkdir(outDir, { recursive: true });

async function gemini(i) {
  const apiKey = await key('GEMINI_API_KEY');
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: brand.brief },
          ...images.map((img) => ({ inlineData: { mimeType: img.mime, data: img.bytes.toString('base64') } })),
        ],
      },
    ],
    generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '4:5', imageSize: '2K' } },
  };
  const started = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 500)}`);
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part) throw new Error(`Nessuna immagine: ${JSON.stringify(json).slice(0, 500)}`);
  const out = path.join(outDir, `${model}-${i}.png`);
  await writeFile(out, Buffer.from(part.inlineData.data, 'base64'));
  const u = json.usageMetadata ?? {};
  return { out, seconds: (Date.now() - started) / 1000, usage: `in ${u.promptTokenCount} out ${u.candidatesTokenCount}` };
}

async function openai(i) {
  const apiKey = await key('OPENAI_API_KEY');
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', brand.brief);
  form.append('size', '1024x1536');
  form.append('quality', 'high');
  form.append('n', '1');
  for (const img of images) form.append('image[]', new Blob([img.bytes], { type: img.mime }), path.basename(img.file));
  const started = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json).slice(0, 500)}`);
  const out = path.join(outDir, `${model}-${i}.png`);
  await writeFile(out, Buffer.from(json.data[0].b64_json, 'base64'));
  const u = json.usage ?? {};
  return { out, seconds: (Date.now() - started) / 1000, usage: `in ${u.input_tokens} out ${u.output_tokens}` };
}

const run = model.startsWith('gpt') ? openai : gemini;
const results = await Promise.allSettled(Array.from({ length: Number(count) }, (_, i) => run(i + 1)));
for (const r of results) {
  if (r.status === 'fulfilled') console.log(`ok ${r.value.out} ${r.value.seconds.toFixed(0)} s, token ${r.value.usage}`);
  else console.log(`errore: ${r.reason.message}`);
}
