import type { ContentPhotosJobInput } from '@moonbrand/shared/api/contract';

import { contentDir, runContentAgent, slotFile } from '../lib/content';

const [brandDir, inputJson] = process.argv.slice(2);
if (!brandDir || !inputJson) {
  console.error('Uso: npm run content-photos -- <cartella del brand> <input del job in JSON>');
  process.exit(1);
}

const { contentId, sessionId, format, channels, slots } = JSON.parse(inputJson) as Omit<ContentPhotosJobInput, 'brandId'>;

// Una riga per slot: la foto caricata da sistemare, oppure da generare.
const lines = slots.map((slot) => {
  const target = slotFile(contentId, slot.id);
  return slot.upload
    ? `- Slot «${slot.id}» (${slot.description}, ${slot.aspect}): usa la foto caricata in ${slot.upload} e salvala in ${target}. Sistemala solo se serve, con un ritaglio o con genera_immagine passandola come riferimento: inquadratura, proporzioni del riquadro, sfondo esteso, luce e colori in linea con il brand. Il soggetto resta quello della foto: non cambiare persone, oggetti, luoghi né il risultato che mostra.`
    : `- Slot «${slot.id}» (${slot.description}, ${slot.aspect}): generala con genera_immagine dalla sua descrizione, nello stile del brand, e salvala in ${target}.`;
});

const prompt = `Riempi questi slot foto del contenuto:
${lines.join('\n')}

Poi ricomponi le immagini finali in ${contentDir(contentId)} che li contengono e controllale: la foto al suo posto, niente tagli, testo leggibile.
Restituisci il contenuto completo, anche le parti che non hai cambiato: negli slot riempiti file è la foto dello slot.`;

await runContentAgent({ brandDir, contentId, format, channels, prompt, resume: sessionId });
