import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { ensureBrowser } from '@remotion/renderer';
import puppeteer, { type Browser } from 'puppeteer-core';
import { z } from 'zod';

import { brandFolder, PARALLEL } from './common';

// Le grafiche le fa Claude in HTML e CSS: renderizza esporta la pagina in PNG o JPEG con il Chrome headless che Remotion
// ha già scaricato, alle misure del formato, dopo aver aspettato font e immagini. Niente controlli: l'immagine la guarda
// Claude. Il browser resta aperto per tutto il job e si chiude alla fine.

export const SIZES = {
  '4:5': { width: 1080, height: 1350 },
  '1:1': { width: 1080, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1600, height: 900 },
  '1.91:1': { width: 1200, height: 628 },
  '2:3': { width: 1000, height: 1500 },
} as const;
type Aspect = keyof typeof SIZES;

const LOAD_TIMEOUT_MS = 30_000;
const ASSETS_TIMEOUT_MS = 10_000;
// Una pagina che tiene occupato Chrome (uno script che non finisce) non risponde più a niente: senza limite Puppeteer
// aspetta 180 s per comando.
const PROTOCOL_TIMEOUT_MS = 45_000;

export async function launchChrome(): Promise<Browser> {
  const status = await ensureBrowser();
  if (status.type !== 'local-puppeteer-browser' && status.type !== 'user-defined-path') throw new Error('il browser per le grafiche non è disponibile');
  return puppeteer.launch({ executablePath: status.path, headless: true, protocolTimeout: PROTOCOL_TIMEOUT_MS, args: ['--hide-scrollbars', '--font-render-hinting=none'] });
}

export function graphicsTools(folder: string) {
  const { inside } = brandFolder(folder);
  let browser: Promise<Browser> | null = null;
  const openBrowser = () => (browser ??= launchChrome());

  async function render(html: string, file: string, aspect: Aspect): Promise<string> {
    const source = inside(html);
    const target = inside(file);
    const extension = path.extname(target).toLowerCase();
    if (!['.png', '.jpg', '.jpeg'].includes(extension)) throw new Error(`${file}: l'immagine si salva in PNG o JPEG.`);
    const { width, height } = SIZES[aspect];
    const page = await (await openBrowser()).newPage();
    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle0', timeout: LOAD_TIMEOUT_MS });
      // Un font o un'immagine che non arriva non tiene fermo il render: dopo ASSETS_TIMEOUT_MS si scatta lo stesso.
      await Promise.race([
        page.evaluate('Promise.all([document.fonts.ready, ...[...document.images].map((image) => image.decode().catch(() => undefined))])'),
        new Promise((resolve) => setTimeout(resolve, ASSETS_TIMEOUT_MS)),
      ]);
      await page.screenshot({ path: target, type: extension === '.png' ? 'png' : 'jpeg', ...(extension !== '.png' && { quality: 92 }), clip: { x: 0, y: 0, width, height } });
      return `Salvata ${file} (${width}×${height}, ${aspect}): aprila con Read prima di consegnarla.`;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  const renderTool = tool(
    'renderizza',
    'Esporta in PNG o JPEG l’HTML di un’immagine, alle misure del formato, dopo aver aspettato font e immagini. Più uscite in una chiamata si fanno insieme.',
    {
      uscite: z
        .array(
          z.object({
            html: z.string().describe('Il file HTML, relativo alla cartella del brand; percorsi di immagini e CSS relativi a lui'),
            file: z.string().describe('L’immagine da scrivere, .png o .jpg, relativa alla cartella del brand'),
            formato: z.enum(Object.keys(SIZES) as [Aspect, ...Aspect[]]).describe('4:5 1080×1350, 1:1 1080×1080, 9:16 1080×1920, 16:9 1600×900, 1.91:1 1200×628, 2:3 1000×1500'),
          }),
        )
        .min(1)
        .max(16),
    },
    async ({ uscite }) => {
      const results = await Promise.all(
        uscite.map(({ html, file, formato }) => render(html, file, formato).catch((error: unknown) => `Non riuscita ${file}: ${error instanceof Error ? error.message : String(error)}`)),
      );
      const failed = results.some((result) => !result.startsWith('Salvata'));
      return { content: [{ type: 'text' as const, text: results.join('\n') }], ...(failed && { isError: true as const }) };
    },
    PARALLEL,
  );

  return {
    server: createSdkMcpServer({ name: 'grafica', tools: [renderTool] }),
    // Da chiamare a fine job: il browser aperto terrebbe vivo il processo.
    close: async () => {
      if (browser) await (await browser.catch(() => null))?.close().catch(() => undefined);
    },
  };
}
