import type { ContentEditJobInput } from '@moonbrand/shared/api/contract';

import { contentDir, runContentAgent } from '../lib/content';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content-edit -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const { contentId, sessionId, format, channels, instruction } = JSON.parse(inputJson) as Omit<ContentEditJobInput, 'brandId'>;

const prompt = `${instruction}

Aggiorna il contenuto di conseguenza: testi e immagini in ${contentDir(contentId)}. Restituisci il contenuto completo, anche le parti che non hai cambiato.`;

await runContentAgent({ brandDir, contentId, format, channels, prompt, resume: sessionId });
