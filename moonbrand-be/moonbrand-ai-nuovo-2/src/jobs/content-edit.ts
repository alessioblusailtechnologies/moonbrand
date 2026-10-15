import type { ContentEditJobInput } from '@moonbrand/shared/api/contract';

import { channelList, CONTENT_RULES, contentDir, neededFiles, runContentAgent } from '../lib/content';
import { languageRules } from '../lib/language';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content-edit -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const { contentId, sessionId, format, channels, instruction, scriptOnly } = JSON.parse(inputJson) as Omit<ContentEditJobInput, 'brandId'>;
if (format === 'video' || scriptOnly) {
  console.error('I video non sono ancora nel motore nuovo 2.');
  process.exit(1);
}

// I canali possono essere cambiati (un canale aggiunto): il risultato vale per quelli di adesso.
// La sessione riprende quella che ha fatto il contenuto, con le regole già dentro: qui si ripetono in breve, perché la
// sessione può venire da una chat.
const prompt = `${instruction}

Aggiorna il contenuto di conseguenza: testi e immagini in ${contentDir(contentId)}. Rifai solo le immagini che la correzione tocca (HTML e renderizza, poi guardale); le altre restano quelle di prima. Restituisci il contenuto completo, anche le parti che non hai cambiato.
Canali: ${channelList(channels)}, con una variante di testo per ciascuno. File: ${neededFiles(format, channels)}.

${CONTENT_RULES}

${languageRules()}`;

await runContentAgent({ brandDir, contentId, format, channels, prompt, resume: sessionId });
