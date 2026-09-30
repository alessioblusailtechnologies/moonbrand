import { exec } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ensureBrowser, openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { z } from 'zod';

const MAX_FRAMES = 20;

// I fotogrammi di controllo di un video del progetto Remotion del brand, tutti in una volta: un solo bundle e un solo
// browser, invece di rifarli da capo per ogni `remotion still`. Senza audio: `remotion render --frames` con più
// fotogrammi sparsi si rompe nel mixaggio dell'audio, e per un controllo l'audio non serve.
export function frameTools(folder: string) {
  const root = path.resolve(folder);
  const project = path.join(root, 'video');
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  const failure = (text: string) => ({ content: [{ type: 'text' as const, text }], isError: true });

  const frames = tool(
    'fotogrammi',
    'Esporta in PNG, in una volta sola e in pochi secondi, i fotogrammi di controllo di una composizione del progetto video del brand, ' +
      'a metà risoluzione di base. Usalo al posto di `remotion still` e di `remotion render --frames`, poi passa tutti i fotogrammi a guarda in una sola chiamata. ' +
      'Il video finale e la copertina si esportano come prima, a risoluzione piena.',
    {
      composizione: z.string().min(1).describe('L’id della composizione, come in video/src/Root.tsx, es. gloss-salone-9x16'),
      fotogrammi: z.array(z.number().int().min(0)).min(1).max(MAX_FRAMES).describe('I numeri dei fotogrammi, a 30 al secondo, es. [0, 45, 120]'),
      cartella: z.string().describe('Dove salvarli, relativa alla cartella del brand, es. contenuti/<id>/lavoro/fotogrammi'),
      scala: z.number().min(0.1).max(1).optional().describe('Scala rispetto alla risoluzione del video: 0.5 di base; 1 solo se serve vedere un dettaglio piccolo'),
    },
    async ({ composizione, fotogrammi, cartella, scala = 0.5 }) => {
      const bundleDir = await mkdtemp(path.join(tmpdir(), 'moonbrand-bundle-'));
      let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
      try {
        const target = inside(cartella);
        await mkdir(target, { recursive: true });
        // Il bundle lo fa il CLI del progetto, con la sua configurazione (remotion.config.ts); la cartella è nostra.
        await promisify(exec)(`npx remotion bundle --out-dir "${bundleDir}"`, { cwd: project, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
        const installed = await ensureBrowser();
        const browserExecutable = 'path' in installed ? (installed as { path: string }).path : null;
        browser = await openBrowser('chrome', { browserExecutable });
        const composition = await selectComposition({ serveUrl: bundleDir, id: composizione, puppeteerInstance: browser });
        const outside = fotogrammi.filter((frame) => frame >= composition.durationInFrames);
        if (outside.length > 0) {
          return failure(`La composizione ha ${composition.durationInFrames} fotogrammi (0-${composition.durationInFrames - 1}): fuori ci sono ${outside.join(', ')}.`);
        }
        const saved: string[] = [];
        for (const frame of fotogrammi) {
          const file = `${cartella.replace(/\/+$/, '')}/${composizione}-${String(frame).padStart(4, '0')}.png`;
          await renderStill({ serveUrl: bundleDir, composition, frame, output: inside(file), scale: scala, imageFormat: 'png', puppeteerInstance: browser, overwrite: true });
          saved.push(file);
        }
        return { content: [{ type: 'text' as const, text: `Fotogrammi salvati:\n${saved.join('\n')}` }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return failure(`Fotogrammi non esportati: ${message.slice(0, 2000)}`);
      } finally {
        await browser?.close({ silent: true }).catch(() => undefined);
        await rm(bundleDir, { recursive: true, force: true }).catch(() => undefined);
      }
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({ name: 'video', tools: [frames] });
}
