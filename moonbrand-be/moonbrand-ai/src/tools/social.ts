import { createWriteStream } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

import { measure } from '../lib/usage';
import { PARALLEL } from './parallel';

// I post social di altri, da un link incollato in chat, come riferimento: Zernio (Tools API, solo piani a pagamento)
// restituisce l'indirizzo dei file, che si scaricano subito in allegati/riferimenti/ perché scadono. Claude poi li guarda
// con guarda; sono di altri, quindi si analizzano e basta, non si montano nei contenuti del brand.
const API = 'https://zernio.com/api/v1/tools';
const DIR = 'allegati/riferimenti';
const MAX_FILES = 10;
const MAX_BYTES = 500 * 1024 * 1024;

// La piattaforma dal dominio del link, con il nome che usa il percorso di Zernio.
const PLATFORMS: { platform: string; name: string; hosts: RegExp }[] = [
  { platform: 'tiktok', name: 'TikTok', hosts: /(^|\.)tiktok\.com$/ },
  { platform: 'instagram', name: 'Instagram', hosts: /(^|\.)instagram\.com$/ },
  { platform: 'facebook', name: 'Facebook', hosts: /(^|\.)(facebook\.com|fb\.watch)$/ },
  { platform: 'twitter', name: 'X', hosts: /(^|\.)(x\.com|twitter\.com)$/ },
  { platform: 'youtube', name: 'YouTube', hosts: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { platform: 'linkedin', name: 'LinkedIn', hosts: /(^|\.)linkedin\.com$/ },
  { platform: 'bluesky', name: 'Bluesky', hosts: /(^|\.)bsky\.app$/ },
];

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
};

// Gli indirizzi dei file nella risposta: downloadUrl, e per i post con più file (caroselli) tutte le stringhe http che
// stanno sotto chiavi che parlano di url, media o download. Le miniature si tengono: per le foto sono il contenuto.
function mediaUrls(response: unknown): string[] {
  const found: string[] = [];
  const visit = (value: unknown, key: string) => {
    if (typeof value === 'string') {
      if (/^https?:\/\//.test(value) && /url|media|download|src|link|video|image|thumbnail/i.test(key)) found.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item, key);
    } else if (value && typeof value === 'object') {
      for (const [child, item] of Object.entries(value)) visit(item, child);
    }
  };
  visit(response, '');
  // downloadUrl per primo: è il file principale.
  const main = (response as { downloadUrl?: string } | null)?.downloadUrl;
  return [...new Set([...(main ? [main] : []), ...found])].slice(0, MAX_FILES);
}

async function download(url: string, target: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(5 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`risposta ${response.status}`);
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();
  const extension = EXTENSIONS[type] ?? (path.extname(new URL(url).pathname).slice(1).toLowerCase() || 'bin');
  const file = `${target}.${extension}`;
  let size = 0;
  const limit = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      size += chunk.length;
      done(size > MAX_BYTES ? new Error('file troppo grande') : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(response.body), limit, createWriteStream(file)).catch(async (error: unknown) => {
    await rm(file, { force: true });
    throw error;
  });
  return file;
}

// La chiave resta in questo processo: Claude vede solo il tool, non le chiamate a Zernio.
export function socialTools(folder: string, apiKey: string) {
  const root = path.resolve(folder);

  const fetchPost = tool(
    'scarica_social',
    'Scarica un post social da un link (TikTok, Instagram, Facebook, X, YouTube, LinkedIn, Bluesky) in allegati/riferimenti/, con il titolo o la didascalia: ' +
      'video, foto o tutte le slide di un carosello. Serve per i riferimenti che l’utente incolla in chat: poi guardali con guarda. ' +
      'Sono post di altri: analizzane idea, aggancio, ritmo, inquadrature, testi e montaggio, ma non usarne pezzi nei contenuti del brand.',
    { link: z.string().url().describe('Il link del post, come l’ha incollato l’utente') },
    async ({ link }) => {
      try {
        const host = new URL(link).hostname.toLowerCase().replace(/^www\.|^m\./, '');
        const platform = PLATFORMS.find((item) => item.hosts.test(host));
        if (!platform) throw new Error(`non so scaricare da ${host}: funziona con TikTok, Instagram, Facebook, X, YouTube, LinkedIn e Bluesky.`);
        const result = await measure({ task: 'social-download', model: `zernio-${platform.platform}` }, async () => {
          const response = await fetch(`${API}/${platform.platform}/download?url=${encodeURIComponent(link)}`, {
            headers: { authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(2 * 60_000),
          });
          const text = await response.text();
          if (response.status === 403 && /paid plans/i.test(text)) throw new Error('il download dei post social non è disponibile al momento.');
          if (response.status === 404) throw new Error('il post non è disponibile: forse è privato, è stato tolto o il link è sbagliato.');
          if (!response.ok) throw new Error(`Il servizio di download ha risposto ${response.status}: ${text.slice(0, 200)}`);
          return JSON.parse(text) as Record<string, unknown>;
        });
        const urls = mediaUrls(result);
        if (urls.length === 0) throw new Error('Il servizio di download non ha restituito file da scaricare.');
        const stamp = `${platform.platform}-${Date.now().toString(36)}`;
        await mkdir(path.join(root, DIR), { recursive: true });
        const files: string[] = [];
        for (const [index, url] of urls.entries()) {
          const saved = await download(url, path.join(root, DIR, urls.length > 1 ? `${stamp}-${index + 1}` : stamp)).catch(() => null);
          if (saved) files.push(path.relative(root, saved).replaceAll('\\', '/'));
        }
        if (files.length === 0) throw new Error('non sono riuscito a scaricare i file del post.');
        const title = typeof result.title === 'string' && result.title.trim() ? `\nTitolo o didascalia: ${result.title.trim()}` : '';
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `Post ${platform.name} scaricato in:\n${files.join('\n')}${title}\n\n` +
                'Guardalo con guarda per capire cosa funziona. È un riferimento di altri: non usarne pezzi nei contenuti del brand.',
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: 'text' as const, text: `Non riuscito: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
      }
    },
    PARALLEL,
  );

  return createSdkMcpServer({ name: 'social', tools: [fetchPost] });
}
