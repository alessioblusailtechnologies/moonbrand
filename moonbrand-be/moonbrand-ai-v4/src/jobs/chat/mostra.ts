import { stat } from 'node:fs/promises';

import { z } from 'zod';

// Percorso relativo: dentro Pi l'alias @moonbrand/shared non si risolve.
import { fileKind } from '../../../../../moonbrand-shared/src/ai/steps';

import { createSdkMcpServer, tool } from './sdk';
import { brandFolder, failure, text } from './servizi';

// Il tool mostra: un file della cartella del brand nel pannello accanto alla chat, per quello che il modello vuole far
// vedere di sua iniziativa (un documento di strategia, una pagina HTML). Il tool controlla solo il file: a farne un
// artefatto è il worker, quando il passaggio finisce (lib/artifacts.ts, toolMedia in moonbrand-shared).
const FILE = /^[a-z0-9-]+(\/[A-Za-z0-9_-][A-Za-z0-9._-]*)+$/;

export function mostraServer(brandDir: string) {
  const { inside, save } = brandFolder(brandDir);
  const show = tool(
    'mostra',
    'Mostra all’utente un file nel pannello accanto alla chat: un documento (Markdown, PDF o testo), una pagina HTML, un’immagine, un video o un audio. ' +
      'Con testo scrive prima il file. Le immagini, le clip, le musiche e i video che fai con gli altri tool compaiono da soli.',
    {
      file: z.string().regex(FILE).describe('Relativo alla cartella del brand, dentro una cartella, es. lavoro/strategia.md o lavoro/bozza.html'),
      titolo: z.string().min(1).max(120).describe('Il titolo che legge l’utente'),
      testo: z.string().min(1).optional().describe('Il contenuto del file, se è un documento o una pagina da scrivere ora'),
    },
    async ({ file, testo }) => {
      try {
        if (!fileKind(file)) return failure(new Error('Si mostrano documenti (.md, .pdf, .txt), pagine .html, immagini, video e audio.'));
        if (testo !== undefined) await save(file, Buffer.from(testo, 'utf8'));
        const info = await stat(inside(file)).catch(() => null);
        if (!info?.isFile()) return failure(new Error(`${file} non c’è.`));
        return text(`${file} è nel pannello dell’utente.`);
      } catch (error) {
        return failure(error);
      }
    },
  );
  return createSdkMcpServer({ name: 'mostra', tools: [show] });
}
