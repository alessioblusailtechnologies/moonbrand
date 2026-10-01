import { prepareVideoProject } from '../lib/video';

// Il progetto Remotion del brand, preparato alla creazione del brand: copiare il kit e installare le dipendenze costa
// mezzo minuto, che altrimenti pagherebbe il primo messaggio in chat. Niente Claude: il worker legge solo il risultato.

const [brandDir] = process.argv.slice(2);
if (!brandDir) {
  console.error('Uso: npm run video-setup -- <cartella del brand>');
  process.exit(1);
}

await prepareVideoProject(brandDir);
console.log(JSON.stringify({ type: 'result', subtype: 'success', structured_output: {} }));
