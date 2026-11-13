import { z } from 'zod';

import { reportUsage } from '../../lib/usage';
import { brandFolder, failure, text } from './servizi';
import { createSdkMcpServer, tool } from './sdk';

// Un post TikTok o Instagram incollato in chat, scaricato come riferimento con SocialCrawl (socialcrawl.dev), come il
// pulsante Ricrea della tab Tendenze (moonbrand-api/src/modules/trends/reference.ts). Il video lo chiediamo ospitato da
// SocialCrawl (download_media): i link del CDN di TikTok rispondono 403 senza le intestazioni di un browser, e non le
// falsifichiamo. Se il file non arriva, vanno tra gli allegati la copertina, e a Claude il parlato e le scritte a schermo.

const BASE = 'https://www.socialcrawl.dev/v1';
const TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const MAX_IMAGES = 10;
const TEXT_MAX = 6000;
const FOLDER = 'allegati';

type Platform = 'tiktok' | 'instagram';

interface Post {
  id?: string;
  url?: string;
  content?: { text?: string | null; media_urls?: string | string[] | null; thumbnail_url?: string | null; duration_seconds?: number | null };
  author?: { username?: string | null } | null;
  engagement?: { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null } | null;
  published_at?: string | null;
  ext?: {
    music_title?: string | null;
    music_artist?: string | null;
    on_screen_texts?: string[] | null;
    download_media_urls?: { cdn_url?: string | null; type?: string | null }[] | null;
  } | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  credits_used?: number;
  error?: { type?: string; message?: string };
}

function platformOf(raw: string): Platform {
  const host = new URL(raw).hostname.toLowerCase();
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') return 'instagram';
  throw new Error('il link non è di TikTok né di Instagram');
}

// Un file scaricato, con l'estensione dal tipo che dice il server; null se non arriva.
async function fetchFile(url: string): Promise<{ data: Buffer; ext: string; video: boolean } | null> {
  const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) }).catch(() => null);
  if (!response?.ok) return null;
  const type = response.headers.get('content-type') ?? '';
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length === 0) return null;
  const video = /video/i.test(type) || (!/image/i.test(type) && /\.mp4(\?|$)/i.test(url));
  const ext = video ? '.mp4' : /png/i.test(type) ? '.png' : /webp/i.test(type) ? '.webp' : '.jpg';
  return { data, ext, video };
}

const list = (media: string | string[] | null | undefined) => (Array.isArray(media) ? media : media ? [media] : []).filter((item) => typeof item === 'string' && item.length > 0);

export function socialServer(brandDir: string, apiKey: string) {
  const folder = brandFolder(brandDir);

  // Una chiamata a SocialCrawl: i crediti usati vanno in ai_usage (il prezzo del credito SocialCrawl non lo dà nessuna
  // API, quindi il costo resta vuoto e si contano i crediti).
  async function call<T>(path: string, params: Record<string, string>): Promise<T> {
    const started = Date.now();
    const url = new URL(`${BASE}/${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    try {
      const response = await fetch(url, { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = (await response.json().catch(() => null)) as Envelope<T> | null;
      if (!response.ok || !body?.success) {
        const reason = response.status === 402 ? 'crediti SocialCrawl finiti' : (body?.error?.message ?? body?.error?.type ?? 'risposta non valida');
        throw new Error(`SocialCrawl ${path}: ${response.status} ${reason}`);
      }
      reportUsage({ task: 'social', model: `socialcrawl/${path}`, outcome: 'ok', durationMs: Date.now() - started, units: body.credits_used ?? 0, unit: 'crediti SocialCrawl' });
      return body.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      reportUsage({ task: 'social', model: `socialcrawl/${path}`, outcome: 'error', error: message.slice(0, 300), durationMs: Date.now() - started });
      throw error;
    }
  }

  const download = tool(
    'scarica_social',
    'Scarica un post di TikTok o Instagram (reel, video, foto o carosello) da un link, come riferimento: usalo quando l’utente incolla ' +
      'un link di questi social. Salva il video o le immagini tra gli allegati, da guardare con guarda_file, e dà autore, numeri, ' +
      'didascalia e musica. Quando il video non si può scaricare salva la copertina e dà il parlato e le scritte a schermo.',
    { url: z.string().url().describe('Il link del post, come l’ha incollato l’utente') },
    async ({ url }) => {
      try {
        const platform = platformOf(url);
        const { post } = await call<{ post: Post }>(`${platform}/post`, { url, download_media: 'true' });
        const id = (post.id ?? Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, '');
        const hosted = list((post.ext?.download_media_urls ?? []).map((item) => item.cdn_url ?? ''));
        const raw = list(post.content?.media_urls);

        // Prima i file ospitati da SocialCrawl, i link del CDN solo se da quelli non arriva niente: il primo video basta,
        // le immagini (caroselli) tutte.
        const saved: string[] = [];
        let video: string | null = null;
        for (const candidates of [hosted, raw]) {
          for (const candidate of candidates) {
            if (video || saved.length >= MAX_IMAGES) break;
            const file = await fetchFile(candidate);
            if (!file) continue;
            const name = file.video ? `${FOLDER}/${platform}-${id}${file.ext}` : `${FOLDER}/${platform}-${id}-${saved.length + 1}${file.ext}`;
            await folder.save(name, file.data);
            if (file.video) video = name;
            else saved.push(name);
          }
          if (video || saved.length > 0) break;
        }
        if (video) saved.unshift(video);

        // Senza video, per un post che lo è: la copertina, il parlato e le scritte a schermo.
        let transcript: string | null = null;
        let screenText: string | null = null;
        const isVideo = Boolean(post.content?.duration_seconds) || platform === 'tiktok';
        if (!video && isVideo) {
          const thumbnail = post.content?.thumbnail_url;
          const cover = thumbnail && saved.length === 0 ? await fetchFile(thumbnail) : null;
          if (cover && !cover.video) {
            const name = `${FOLDER}/${platform}-${id}-copertina${cover.ext}`;
            await folder.save(name, cover.data);
            saved.push(name);
          }
          const [spoken, screen] = await Promise.all([
            call<{ transcript?: string | null }>(platform === 'tiktok' ? 'tiktok/post/transcript' : 'instagram/media/transcript', { url }).catch(() => null),
            platform === 'tiktok' && !post.ext?.on_screen_texts?.length
              ? call<{ texts?: string[] | null }>('tiktok/video/screen-text', { url, frames: 'all' }).catch(() => null)
              : Promise.resolve(null),
          ]);
          transcript = spoken?.transcript?.trim().slice(0, TEXT_MAX) || null;
          const texts = [...(post.ext?.on_screen_texts ?? []), ...(screen?.texts ?? [])].filter(Boolean);
          screenText = texts.length > 0 ? texts.join('\n').slice(0, TEXT_MAX) : null;
        }

        const music = [post.ext?.music_title, post.ext?.music_artist].filter(Boolean).join(' - ');
        const numbers = [
          post.engagement?.views != null && `${post.engagement.views} visualizzazioni`,
          post.engagement?.likes != null && `${post.engagement.likes} like`,
          post.engagement?.comments != null && `${post.engagement.comments} commenti`,
          post.content?.duration_seconds && `${Math.round(post.content.duration_seconds)} s`,
        ].filter(Boolean);
        const lines = [
          `${platform === 'tiktok' ? 'TikTok' : 'Instagram'}${post.author?.username ? ` di @${post.author.username}` : ''}: ${post.url ?? url}`,
          numbers.length > 0 && numbers.join(', '),
          post.published_at && `Pubblicato: ${post.published_at}`,
          music && `Musica: ${music}`,
          post.content?.text && `Didascalia: ${post.content.text}`,
          video
            ? `Il video è in ${video}${saved.length > 1 ? `, le immagini in ${saved.slice(1).join(', ')}` : ''}.`
            : saved.length > 0
              ? `${isVideo ? 'Il video non si è potuto scaricare; la copertina è in' : 'Le immagini sono in'} ${saved.join(', ')}.`
              : 'Nessun file scaricato.',
          transcript && `Il parlato:\n${transcript}`,
          screenText && `Le scritte a schermo:\n${screenText}`,
        ];
        return text(lines.filter(Boolean).join('\n\n'));
      } catch (error) {
        return failure(error);
      }
    },
  );

  return createSdkMcpServer({ name: 'social', tools: [download] });
}
