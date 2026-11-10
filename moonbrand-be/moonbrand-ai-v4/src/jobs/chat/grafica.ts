import { readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createSdkMcpServer, tool } from './sdk';
import { ensureBrowser } from '@remotion/renderer';
import puppeteer, { type Browser } from 'puppeteer-core';
import { z } from 'zod';

import { toolModel, toolThinking } from '../../lib/settings';
import { geminiClient } from './gemini';
import { brandFolder, PARALLEL } from './servizi';

// Le immagini (post, slide dei caroselli, copertine) sono HTML: renderizza le esporta in PNG o JPEG con il Chrome
// headless che Remotion ha già scaricato, aperto al primo render e tenuto per tutto il job. Prima dello scatto aspetta
// font e immagini; dopo misura sul DOM testi tagliati o fuori bordo, font mancanti, immagini rotte, testi sovrapposti e
// corpo troppo piccolo, e se glielo si chiede fa guardare le immagini a Gemini. Portato dalla v1 (src/tools/grafica.ts)
// il 3/11: senza, Claude faceva le immagini con `npx remotion still`, circa 37 s ciascuna.

const SIZES = {
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
const PROTOCOL_TIMEOUT_MS = 45_000;
// Il modello della vista dalla sezione Modelli dell'admin (lib/settings.ts).
const DEFAULT_LOOKER = toolModel('vista');
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg']);

const secondsOf = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

// I controlli sul DOM girano nella pagina: stanno in un file JavaScript a parte, letto come testo.
const CHECKS = readFileSync(new URL('./grafica-controlli.js', import.meta.url), 'utf8')
  .replace(/^(\s*\/\/.*\n)+/, '')
  .trim();

export async function launchChrome(): Promise<Browser> {
  const status = await ensureBrowser();
  if (status.type !== 'local-puppeteer-browser' && status.type !== 'user-defined-path') throw new Error('il browser per le immagini non è disponibile');
  // protocolTimeout: una pagina che tiene occupato Chrome (uno script che non finisce) non risponde più a niente; senza
  // limite Puppeteer aspetta 180 s per comando.
  return puppeteer.launch({
    executablePath: status.path,
    headless: true,
    protocolTimeout: PROTOCOL_TIMEOUT_MS,
    args: ['--hide-scrollbars', '--font-render-hinting=none', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  });
}

export function graficaServer(brandDir: string, geminiKey?: string) {
  const { inside } = brandFolder(brandDir);
  const looker = geminiKey ? geminiClient(geminiKey, inside) : undefined;
  let browser: Promise<Browser> | null = null;
  const openBrowser = () => (browser ??= launchChrome().catch((error: unknown) => {
    browser = null;
    throw error;
  }));

  async function render(html: string, file: string, aspect: Aspect): Promise<string> {
    const source = inside(html);
    const target = inside(file);
    const extension = path.extname(target).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) throw new Error(`${file}: l'immagine si salva in PNG o JPEG.`);
    const { width, height } = SIZES[aspect];
    const page = await (await openBrowser()).newPage();
    const failed: string[] = [];
    page.on('requestfailed', (request) => failed.push(`${request.url()} (${request.failure()?.errorText ?? 'errore'})`));
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${response.url()} (${response.status()})`);
    });
    try {
      const started = Date.now();
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.goto(pathToFileURL(source).href, { waitUntil: 'networkidle0', timeout: LOAD_TIMEOUT_MS });
      const loaded = Date.now();
      // Un font o un'immagine che non arriva non tiene fermo il render: dopo ASSETS_TIMEOUT_MS si scatta lo stesso e i
      // controlli dicono cosa manca.
      const assets = await Promise.race([
        page
          .evaluate('Promise.all([document.fonts.ready, ...[...document.images].map((image) => image.decode().catch(() => undefined))])')
          .then(() => true),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), ASSETS_TIMEOUT_MS)),
      ]);
      if (!assets && !(await Promise.race([page.evaluate('true'), new Promise<false>((resolve) => setTimeout(() => resolve(false), 3_000))]))) {
        throw new Error('la pagina non risponde: uno script tiene occupato il browser (un ciclo che non finisce, un’animazione in JavaScript). Togli gli script: l’immagine è statica.');
      }
      await mkdir(path.dirname(target), { recursive: true });
      await page.screenshot({ path: target, type: extension === '.png' ? 'png' : 'jpeg', ...(extension !== '.png' && { quality: 92 }), clip: { x: 0, y: 0, width, height } });
      const found = (await page.evaluate(`(${CHECKS})(${aspect === '9:16'})`)) as { fix: string[]; check: string[] };
      const fix = [
        ...(assets ? [] : [`font o immagini non pronti dopo ${ASSETS_TIMEOUT_MS / 1000} s: usa file locali nella cartella del brand`]),
        ...found.fix,
        ...failed.map((request) => `richiesta non riuscita: ${request}`),
      ];
      const seconds = `${secondsOf(Date.now() - started)} (caricamento ${secondsOf(loaded - started)})`;
      const list = (title: string, items: string[]) => (items.length > 0 ? [`${title}:`, ...items.map((item) => `- ${item}`)] : []);
      const checks =
        fix.length + found.check.length === 0 ? ['Controlli: tutto a posto.'] : [...list('Da correggere', fix), ...list('Da valutare, se non sono scelte', found.check)];
      return [`Salvata ${file} (${width}×${height}, ${aspect}) in ${seconds}.`, ...checks].join('\n');
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  const renderTool = tool(
    'renderizza',
    'Esporta in PNG o JPEG l’HTML di un’immagine (post, slide di un carosello, copertina), con le misure giuste per il formato; aspetta font e immagini prima dello scatto. ' +
      'Poi misura sul DOM testi tagliati o fuori bordo, font non caricati, immagini rotte, testi sovrapposti e corpo troppo piccolo, e te lo dice. ' +
      'Con domanda fa anche guardare le immagini a Gemini e ti riporta la risposta: per il giudizio che il DOM non dà (cosa copre cosa, equilibrio, colori). ' +
      'Più uscite in una chiamata si fanno in parallelo. Remotion serve per i video.',
    {
      uscite: z
        .array(
          z.object({
            html: z.string().describe('Il file HTML, relativo alla cartella del brand; percorsi di immagini, font e CSS relativi a lui'),
            file: z.string().describe('L’immagine da scrivere, .png o .jpg, relativa alla cartella del brand'),
            formato: z.enum(Object.keys(SIZES) as [Aspect, ...Aspect[]]).describe('4:5 1080×1350, 1:1 1080×1080, 9:16 1080×1920, 16:9 1600×900, 1.91:1 1200×628, 2:3 1000×1500'),
          }),
        )
        .min(1)
        .max(16),
      domanda: z.string().min(10).optional().describe('Cosa far controllare a Gemini sulle immagini appena fatte'),
    },
    async ({ uscite, domanda }) => {
      const results = await Promise.all(
        uscite.map(({ html, file, formato }) =>
          render(html, file, formato).catch((error: unknown) => `Non riuscita ${file}: ${error instanceof Error ? error.message : String(error)}`),
        ),
      );
      const lines = [results.join('\n\n')];
      const done = uscite.filter((_, index) => results[index]!.startsWith('Salvata')).map((item) => item.file);
      if (domanda && done.length > 0) {
        if (!looker) {
          lines.push('Gemini non è configurato: guardale tu con Read.');
        } else {
          try {
            const response = await looker.generate('vision', DEFAULT_LOOKER, done, `I file, nell’ordine: ${done.join(', ')}.\n\n${domanda}`, undefined, toolThinking('vista'));
            const answer = (response.candidates?.[0]?.content?.parts ?? [])
              .filter((part) => part.text && !part.thought)
              .map((part) => part.text)
              .join('\n')
              .trim();
            lines.push(`Gemini:\n${answer || 'nessuna risposta.'}`);
          } catch (error) {
            lines.push(`Gemini non ha risposto: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      return { content: [{ type: 'text' as const, text: lines.join('\n\n') }], ...(done.length < uscite.length && { isError: true as const }) };
    },
    PARALLEL,
  );

  return {
    server: createSdkMcpServer({ name: 'grafica', tools: [renderTool] }),
    // A fine job: il browser aperto terrebbe vivo il processo.
    close: async () => {
      if (browser) await (await browser.catch(() => null))?.close().catch(() => undefined);
    },
  };
}
