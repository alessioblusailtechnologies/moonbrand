import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import puppeteer, { type Browser } from 'puppeteer';
import { z } from 'zod';

import { PARALLEL } from './parallel';

// Le grafiche le fa Claude in HTML e CSS: renderizza esporta la pagina in PNG con il Chrome headless di Puppeteer, alle
// misure del formato, dopo aver aspettato font e immagini. Niente controlli sul DOM: il PNG lo guarda Claude.

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

export function createRenderer(folder: string) {
  const root = path.resolve(folder);
  const inside = (relative: string) => {
    const full = path.resolve(root, relative);
    if (!full.startsWith(root + path.sep)) throw new Error(`Il percorso ${relative} esce dalla cartella del brand.`);
    return full;
  };
  let browser: Promise<Browser> | null = null;
  const openBrowser = () => (browser ??= puppeteer.launch({ headless: true, args: ['--hide-scrollbars', '--font-render-hinting=none'] }));

  async function render(html: string, file: string, aspect: Aspect): Promise<string> {
    const source = inside(html);
    const target = inside(file);
    if (path.extname(target).toLowerCase() !== '.png') throw new Error(`${file}: l'immagine si salva in PNG.`);
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
      await page.screenshot({ path: target, type: 'png', clip: { x: 0, y: 0, width, height } });
      return `Salvata ${file} (${width}×${height}, ${aspect}).`;
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  return {
    render,
    // Da chiamare a fine job: il browser aperto terrebbe vivo il processo.
    close: async () => {
      if (browser) await (await browser.catch(() => null))?.close().catch(() => undefined);
    },
  };
}

export function graphicsTools(folder: string) {
  const { render, close } = createRenderer(folder);

  const renderTool = tool(
    'renderizza',
    'Esporta in PNG l’HTML di un’immagine, alle misure del formato, dopo aver aspettato font e immagini. Più uscite in una chiamata si fanno insieme.',
    {
      uscite: z
        .array(
          z.object({
            html: z.string().describe('Il file HTML, relativo alla cartella del brand; percorsi di immagini e CSS relativi a lui'),
            file: z.string().describe('Il PNG da scrivere, relativo alla cartella del brand'),
            formato: z
              .enum(Object.keys(SIZES) as [Aspect, ...Aspect[]])
              .describe('4:5 1080×1350, 1:1 1080×1080, 9:16 1080×1920, 16:9 1600×900, 1.91:1 1200×628, 2:3 1000×1500'),
          }),
        )
        .min(1)
        .max(16),
    },
    async ({ uscite }) => {
      const results = await Promise.all(
        uscite.map(({ html, file, formato }) =>
          render(html, file, formato).catch((error: unknown) => `Non riuscita ${file}: ${error instanceof Error ? error.message : String(error)}`),
        ),
      );
      const failed = results.some((result) => !result.startsWith('Salvata'));
      return { content: [{ type: 'text' as const, text: results.join('\n') }], ...(failed && { isError: true as const }) };
    },
    PARALLEL,
  );

  return { server: createSdkMcpServer({ name: 'grafica', tools: [renderTool] }), close };
}
