import type { ChannelId } from '@moonbrand/shared/domain/brand';

import { runExamples } from '../lib/examples';

// Una modifica agli esempi dell'onboarding: riprende la sessione della generazione e lavora nella sua cartella.
const [brandDir, dir, sessionId, channelsJson, instruction] = process.argv.slice(2);
if (!brandDir || !dir || !sessionId || !channelsJson || !instruction) {
  console.error('Uso: npm run visual-edit -- <cartella del brand> <cartella degli esempi> <sessione> <canali in JSON> <istruzione>');
  process.exit(1);
}

const channels = JSON.parse(channelsJson) as ChannelId[];
const prompt = `${instruction}

Aggiorna gli esempi di conseguenza: rifai in ${dir} quelli che cambiano (HTML e renderizza, poi guardali). Restituisci tutti gli esempi, anche quelli che non hai cambiato.`;

await runExamples({ brandDir, dir, channels, prompt, resume: sessionId });
