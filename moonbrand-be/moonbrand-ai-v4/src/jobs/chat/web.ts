import { readFileSync } from 'node:fs';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { isIP } from 'node:net';
import path from 'node:path';

import { GoogleGenAI } from '@google/genai';
import type { Browser } from 'puppeteer-core';
import { z } from 'zod';

import { geminiCost, modelPrice } from '../../lib/prices';
import { launchChrome } from './grafica';
import { createSdkMcpServer, tool } from './sdk';
import { failure, measured, text } from './servizi';

// La modalità grafica: una finestra da desktop, e lo screenshot fino a tre schermate.
const VIEWPORT = { width: 1440, height: 900 };
const SHOT_MAX_HEIGHT = 2700;

interface Probe {
  title: string;
  height: number;
  colors: { hex: string; role: string; share: number }[];
  fonts: { family: string; weights: string[]; share: number }[];
  loaded: string[];
  themeColor: string | null;
  logos: string[];
  image: string | null;
  text: string;
}

// Gira nella pagina: sta in un file JavaScript a parte, letto come testo, come i controlli di grafica.ts.
const STYLE_PROBE = readFileSync(new URL('./web-stile.js', import.meta.url), 'utf8')
  .replace(/^(\s*\/\/.*\n)+/, '')
  .trim();

// Quello che nel v3 dava Claude Code e Pi non ha: la ricerca sul web (Gemini con la ricerca Google), la lettura di una
// pagina e la memoria del brand, un file nella cartella del brand che chat.ts mette nel prompt di ogni chat.

const SEARCH_MODEL = 'gemini-3.8-flash';
const PAGE_TIMEOUT_MS = 30_000;
const PAGE_MAX_BYTES = 5 * 1024 * 1024;
const PAGE_CHARS = 20_000;

export const MEMORY_FILE = 'memoria.md';
// Quanta memoria entra nel prompt: oltre, le righe più recenti.
const MEMORY_CHARS = 8_000;

// La memoria del brand per il prompt, o niente se non c'è.
export async function brandMemory(brandDir: string): Promise<string | null> {
  const raw = await readFile(path.join(brandDir, MEMORY_FILE), 'utf8').catch(() => '');
  const lines = raw.split('\n').filter((line) => line.trim());
  const kept: string[] = [];
  let size = 0;
  for (const line of [...lines].reverse()) {
    if (size + line.length > MEMORY_CHARS) break;
    kept.unshift(line);
    size += line.length + 1;
  }
  return kept.length > 0 ? kept.join('\n') : null;
}

// Niente indirizzi locali o della rete interna: la pagina la scarica il server.
function publicUrl(raw: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('solo indirizzi http e https');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const local =
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    (isIP(host) !== 0 && /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1$|::$|f[cd]|fe80)/.test(host));
  if (local) throw new Error('indirizzo non raggiungibile');
  return url;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// Il testo di una pagina HTML: titolo, poi il contenuto senza script, stili e menu, con gli a capo dei blocchi.
function pageText(html: string): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (match, code: string) => {
      if (code[0] === '#') {
        const value = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(value) ? String.fromCodePoint(value) : match;
      }
      return ENTITIES[code.toLowerCase()] ?? match;
    })
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return [title && `# ${title}`, body].filter(Boolean).join('\n\n');
}

export function webServer(brandDir: string, geminiKey?: string) {
  const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : undefined;

  const search = tool(
    'cerca_web',
    'Cerca sul web con Google e risponde alla domanda con le fonti: tendenze, notizie, ricorrenze, concorrenti, prezzi, fatti da verificare.',
    { domanda: z.string().min(1).describe('Cosa cercare, come una domanda completa') },
    async ({ domanda }) => {
      try {
        if (!ai) throw new Error('Gemini non è configurato');
        const response = await measured(
          { task: 'web-search', model: SEARCH_MODEL },
          () => ai.models.generateContent({ model: SEARCH_MODEL, contents: [{ role: 'user', parts: [{ text: domanda }] }], config: { tools: [{ googleSearch: {} }] } }),
          // La ricerca Google si paga a query oltre ai token: il prezzo a query sta nel listino del modello (lib/prices.ts).
          async (result) => {
            const usage = result.usageMetadata;
            const input = usage?.promptTokenCount ?? 0;
            const output = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
            const queries = result.candidates?.[0]?.groundingMetadata?.webSearchQueries?.length ?? 0;
            const tokens = await geminiCost(SEARCH_MODEL, { input, output, image: 0 });
            const perQuery = (await modelPrice(SEARCH_MODEL))?.webSearch;
            if (queries > 0 && perQuery === undefined) console.warn(`[prezzi] ${SEARCH_MODEL} senza prezzo della ricerca: il costo resta non noto`);
            const costUsd = tokens === undefined || (queries > 0 && perQuery === undefined) ? undefined : tokens + queries * (perQuery ?? 0);
            return { costUsd, inputTokens: input, outputTokens: output, units: queries, unit: 'ricerche' };
          },
        );
        const candidate = response.candidates?.[0];
        const answer = (candidate?.content?.parts ?? [])
          .filter((part) => part.text && !part.thought)
          .map((part) => part.text)
          .join('\n')
          .trim();
        const sources = (candidate?.groundingMetadata?.groundingChunks ?? [])
          .flatMap((chunk) => (chunk.web?.uri ? [`- ${chunk.web.title ?? ''} ${chunk.web.uri}`.trim()] : []))
          .slice(0, 10);
        return text([answer || 'Nessuna risposta.', sources.length > 0 && `Fonti:\n${sources.join('\n')}`].filter(Boolean).join('\n\n'));
      } catch (error) {
        return failure(error);
      }
    },
  );

  // Chrome per la modalità grafica, aperto alla prima pagina e chiuso a fine chat.
  let browser: Promise<Browser> | null = null;
  const openBrowser = () =>
    (browser ??= launchChrome().catch((error: unknown) => {
      browser = null;
      throw error;
    }));

  // La pagina come la vede un grafico: aperta in Chrome (anche quelle fatte in JavaScript), con lo screenshot salvato
  // nella cartella del brand e mostrato al modello, i colori e i font davvero usati e il testo.
  async function graphic(url: URL, chars: number) {
    const page = await (await openBrowser()).newPage();
    try {
      await page.setViewport({ width: VIEWPORT.width, height: VIEWPORT.height, deviceScaleFactor: 1 });
      // Anche le risorse della pagina non vanno a indirizzi locali o interni.
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        try {
          publicUrl(request.url());
          void request.continue();
        } catch {
          void request.abort();
        }
      });
      await page.goto(url.href, { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT_MS }).catch(async (error: unknown) => {
        // Una pagina che non smette di caricare si guarda com'è dopo il timeout.
        if (!(await page.evaluate('document.body !== null').catch(() => false))) throw error;
      });
      publicUrl(page.url());
      const found = (await page.evaluate(`(${STYLE_PROBE})()`)) as Probe;
      const height = Math.min(found.height, SHOT_MAX_HEIGHT);
      const shot = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: VIEWPORT.width, height } }));
      const name = url.hostname.replace(/^www\./, '').replace(/[^a-z0-9.-]/gi, '-');
      const saved = `lavoro/pagine/${name}-${Date.now().toString(36)}.jpg`;
      await mkdir(path.dirname(path.join(brandDir, saved)), { recursive: true });
      await writeFile(path.join(brandDir, saved), shot);
      const lines = [
        `Pagina: ${page.url()}${found.title ? ` (${found.title})` : ''}`,
        `Screenshot dei primi ${height} px salvato in ${saved}.`,
        found.colors.length > 0 && `Colori usati, dal più presente (sfondi pesati per superficie, contando anche gli elementi uno dentro l’altro; testi per lunghezza):\n${found.colors.map((item) => `- ${item.hex} ${item.role}, ${item.share}%`).join('\n')}`,
        found.fonts.length > 0 && `Font dei testi, dal più usato:\n${found.fonts.map((item) => `- ${item.family} (${item.weights.join(', ')}), ${item.share}%`).join('\n')}`,
        found.loaded.length > 0 && `Font caricati dalla pagina: ${found.loaded.join(', ')}`,
        found.themeColor && `Colore del tema: ${found.themeColor}`,
        found.logos.length > 0 && `Possibili loghi:\n${found.logos.map((item) => `- ${item}`).join('\n')}`,
        found.image && `Immagine di anteprima: ${found.image}`,
        `Testo:\n${found.text.slice(0, chars)}${found.text.length > chars ? `\n\n(tagliato: ${found.text.length} caratteri in tutto)` : ''}`,
      ];
      return {
        content: [
          { type: 'text', text: lines.filter(Boolean).join('\n\n') },
          { type: 'image', data: shot.toString('base64'), mimeType: 'image/jpeg' },
        ],
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  const read = tool(
    'leggi_pagina',
    'Legge una pagina web. Con modo testo (di default) ne restituisce il testo, senza menu, script e stili. Con modo grafica la apre in ' +
      'Chrome come un visitatore, anche se è fatta in JavaScript, e dà lo screenshot (salvato anche nella cartella del brand), i colori e i ' +
      'font davvero usati, i possibili loghi e il testo: per capire lo stile di un sito, del brand o di un concorrente.',
    {
      url: z.string().min(1),
      modo: z.enum(['testo', 'grafica']).optional(),
      caratteri: z.number().int().positive().max(100_000).optional().describe(`Quanti caratteri di testo al massimo, di default ${PAGE_CHARS}`),
    },
    async ({ url, modo = 'testo', caratteri = PAGE_CHARS }) => {
      try {
        if (modo === 'grafica') return await graphic(publicUrl(url), caratteri);
        const response = await fetch(publicUrl(url), {
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; moonbrand)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
          redirect: 'follow',
          signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
        });
        publicUrl(response.url || url);
        if (!response.ok) throw new Error(`la pagina risponde ${response.status}`);
        const type = response.headers.get('content-type') ?? '';
        if (!/text|html|xml|json/i.test(type)) throw new Error(`non è una pagina di testo (${type || 'tipo sconosciuto'})`);
        const raw = Buffer.from(await response.arrayBuffer()).subarray(0, PAGE_MAX_BYTES).toString('utf8');
        const content = /html|xml/i.test(type) ? pageText(raw) : raw.trim();
        const cut = content.length > caratteri;
        return text(`${content.slice(0, caratteri)}${cut ? `\n\n(tagliata: ${content.length} caratteri in tutto)` : ''}`);
      } catch (error) {
        return failure(error);
      }
    },
  );

  const remember = tool(
    'ricorda',
    'Aggiunge una cosa alla memoria del brand, che leggerai all’inizio di ogni conversazione. Usalo anche di tua iniziativa quando capisci ' +
      'qualcosa che vale per le prossime volte: una preferenza dell’utente, una cosa da evitare, un fatto del brand che non è già scritto. ' +
      `Una riga breve e chiara. Per correggere o togliere un ricordo modifica ${MEMORY_FILE}.`,
    { ricordo: z.string().min(1).max(500) },
    async ({ ricordo }) => {
      try {
        const day = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
        await appendFile(path.join(brandDir, MEMORY_FILE), `- ${day}: ${ricordo.replace(/\s+/g, ' ').trim()}\n`);
        return text('Ricordato.');
      } catch (error) {
        return failure(error);
      }
    },
  );

  return {
    server: createSdkMcpServer({ name: 'web', tools: [...(ai ? [search] : []), read, remember] }),
    // A fine chat: il browser aperto terrebbe vivo il processo.
    close: async () => {
      if (browser) await (await browser.catch(() => null))?.close().catch(() => undefined);
    },
  };
}
