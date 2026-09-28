import type { ContentEditJobInput } from '@moonbrand/shared/api/contract';

import { contentDir, runContentAgent } from '../lib/content';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content-edit -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const { contentId, sessionId, format, channels, instruction, scriptOnly } = JSON.parse(inputJson) as Omit<ContentEditJobInput, 'brandId'>;

// Di un video senza ancora il video si ritocca il copione; di un video fatto, video e testi.
const task = scriptOnly
  ? `Aggiorna il copione del video di conseguenza, seguendo la skill moonbrand:video. Non generare ancora immagini, clip o audio: il video si fa quando l’utente approva il copione. Restituisci il copione completo, anche le inquadrature che non hai cambiato.`
  : format === 'video'
    ? `Aggiorna il contenuto di conseguenza, seguendo le skill moonbrand:video e moonbrand:contenuti: riesporta video e copertine in ${contentDir(contentId)} e aggiorna testi e copione se cambiano. Restituisci il contenuto completo, anche le parti che non hai cambiato.`
    : `Aggiorna il contenuto di conseguenza, sempre seguendo la skill moonbrand:contenuti: testi e immagini in ${contentDir(contentId)}. Restituisci il contenuto completo, anche le parti che non hai cambiato.`;

await runContentAgent({ brandDir, contentId, format, channels, prompt: `${instruction}\n\n${task}`, scriptOnly, resume: sessionId });
