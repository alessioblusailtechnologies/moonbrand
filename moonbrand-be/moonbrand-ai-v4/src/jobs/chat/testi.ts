import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import { toolModel, toolThinking } from '../../lib/settings';
import { geminiClient } from './gemini';
import { createSdkMcpServer, tool } from './sdk';
import { brandFolder, failure, PARALLEL, text } from './servizi';
import { brandMemory } from './web';

// I testi li scrive un altro modello, non quello della chat: di default Gemini 4 Argon, dalla sezione Modelli dell'admin
// (lib/settings.ts). Un tool per tipo di testo, ognuno con la sua richiesta; il CLAUDE.md e la memoria del brand li
// aggiunge il tool, così il modello conosce voce e pubblico.

const MODEL = toolModel('testi');

const common = {
  richiesta: z.string().min(1).describe('Cosa scrivere e il contesto che conta: idea, cosa ha chiesto l’utente, cosa si vede nel contenuto.'),
  lingua: z.string().min(1).describe('La lingua dei post del brand.'),
  file: z.array(z.string()).optional().describe('Immagini o video della cartella del brand da guardare, se il testo parla di quelli.'),
  testo_precedente: z.string().optional().describe('Per un ritocco: il testo di prima.'),
  modifica: z.string().optional().describe('Per un ritocco: cosa cambiare.'),
};

type Common = { richiesta: string; lingua: string; file?: string[]; testo_precedente?: string; modifica?: string };

export function testiServer(brandDir: string, apiKey: string) {
  const { inside } = brandFolder(brandDir);
  const gemini = geminiClient(apiKey, inside);

  const write = async (task: string, compito: string, args: Common, extra: (string | number | false | undefined)[]) => {
    try {
      const brand = await readFile(path.join(brandDir, 'CLAUDE.md'), 'utf8').catch(() => '');
      const memory = await brandMemory(brandDir);
      const prompt = [
        compito,
        `Lingua: ${args.lingua}.`,
        ...extra,
        `Richiesta:\n${args.richiesta}`,
        args.testo_precedente && `Testo di prima:\n${args.testo_precedente}`,
        args.modifica && `Cosa cambiare:\n${args.modifica}`,
        brand && `Il brand:\n${brand}`,
        memory && `Cosa si sa del brand dalle conversazioni passate:\n${memory}`,
        'Rispondi solo con il testo richiesto, senza premesse.',
      ]
        .filter(Boolean)
        .join('\n\n');
      const response = await gemini.generate(task, MODEL, args.file ?? [], prompt, undefined, toolThinking('testi'));
      const result = response.text?.trim();
      if (!result) throw new Error(`nessun testo (${response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason ?? 'motivo non noto'})`);
      return text(result);
    } catch (error) {
      return failure(error);
    }
  };

  return createSdkMcpServer({
    name: 'testi',
    version: '1.0.0',
    tools: [
      tool(
        'scrivi_copy',
        'Scrive i testi di un post o di un contenuto: le scritte che vanno nella grafica e la caption per il canale.',
        { ...common, canale: z.string().min(1).describe('instagram, tiktok, facebook, linkedin...'), scritte: z.boolean().default(true).describe('false se servono solo la caption e non le scritte nella grafica.') },
        (args) =>
          write('copy', 'Sei il copywriter del brand. Scrivi i testi di un contenuto social.', args, [
            `Canale: ${args.canale}.`,
            args.scritte ? 'Dammi due parti: le scritte da mettere nella grafica (brevi) e la caption.' : 'Dammi solo la caption.',
          ]),
        PARALLEL,
      ),
      tool(
        'scrivi_brief_carosello',
        'Scrive il brief di un carosello slide per slide: titolo, testo e cosa si vede in ognuna.',
        { ...common, slide: z.number().int().min(2).max(20).optional().describe('Quante slide, se è già deciso.') },
        (args) =>
          write('brief carosello', 'Sei il copywriter e art director del brand. Scrivi il brief di un carosello social, slide per slide: titolo, testo e cosa si vede.', args, [
            args.slide && `Slide: ${args.slide}.`,
          ]),
        PARALLEL,
      ),
      tool(
        'scrivi_brief_video',
        'Scrive il brief di un video scena per scena: durata, cosa si vede, testo a schermo, voce o parlato, musica e ritmo, e il titolo della copertina.',
        { ...common, canale: z.string().min(1).describe('reel, tiktok, youtube shorts...'), durata: z.number().positive().optional().describe('Secondi, se è già decisa.') },
        (args) =>
          write('brief video', 'Sei il copywriter e regista del brand. Scrivi il brief di un video social, scena per scena: durata, cosa si vede, testo a schermo, voce o parlato, musica e ritmo. Alla fine il titolo della copertina.', args, [
            `Canale: ${args.canale}.`,
            args.durata && `Durata: ${args.durata} secondi.`,
          ]),
        PARALLEL,
      ),
      tool(
        'scrivi_parlato',
        'Scrive il testo da dire in un video: voce fuori campo o persona che parla in camera.',
        { ...common, chi: z.enum(['voce fuori campo', 'persona in camera']), durata: z.number().positive().optional().describe('Secondi, se è già decisa.') },
        (args) =>
          write('parlato', 'Sei il copywriter del brand. Scrivi il testo parlato di un video social, da dire ad alta voce.', args, [
            `Chi parla: ${args.chi}.`,
            args.durata && `Durata: ${args.durata} secondi.`,
          ]),
        PARALLEL,
      ),
      tool(
        'scrivi_testo_canzone',
        'Scrive il testo di una canzone, un jingle o una sigla, da passare a genera_canzone. Se l’utente non chiede altro, è un testo che può diventare di tendenza, non una canzone su quello che fa il brand.',
        { ...common, durata: z.number().positive().optional().describe('Secondi, se è già decisa.'), sul_brand: z.boolean().default(false).describe('true solo se l’utente chiede una canzone sul brand.') },
        (args) =>
          write('testo canzone', 'Sei un autore di canzoni per i social.', args, [
            args.sul_brand
              ? 'L’utente vuole una canzone sul brand.'
              : 'Scrivi un testo che possa diventare di tendenza sui social, come le canzoni che girano: orecchiabile, da ripetere, da usare in mille video. Non deve parlare di quello che fa il brand né descrivere il contenuto.',
            args.durata && `Durata: ${args.durata} secondi.`,
          ]),
        PARALLEL,
      ),
    ],
  });
}
