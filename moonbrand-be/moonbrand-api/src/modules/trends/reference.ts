import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

import type { ChatTrend } from '@moonbrand/shared/api/contract';

import { ATTACHMENTS_DIR, type BrandFiles } from '../brand-files/files';
import type { MediaStorage } from '../media/storage';
import type { StoredTrend } from './repository';
import { mediaUrls, type SocialCrawl, type SocialPost } from './socialcrawl';

// Il riferimento di un video di tendenza da ricreare, preparato quando l'utente preme Ricrea: il video va tra gli
// allegati della chat, dove Claude lo guarda con guarda_file. Il link per scaricarlo lo chiediamo a SocialCrawl in quel
// momento, perché quelli raccolti scadono in poche ore.
// TikTok non dà il file senza le intestazioni di un browser, e non le falsifichiamo: allora tra gli allegati va la
// copertina, e a Claude arrivano il parlato e le scritte a schermo che SocialCrawl legge dal video.
export interface TrendReference {
  attachments: string[];
  trend: ChatTrend;
}

export type VideoUpload = (stream: Readable) => Promise<{ file: string }>;

const TEXT_MAX = 6000;

async function instagramVideo(crawl: SocialCrawl, url: string, upload: VideoUpload): Promise<string | null> {
  const { data } = await crawl.get<{ post: SocialPost }>('instagram/post', { url });
  const video = mediaUrls(data.post).find((media) => media.includes('.mp4')) ?? mediaUrls(data.post)[0];
  if (!video) return null;
  const response = await fetch(video, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) return null;
  return (await upload(Readable.fromWeb(response.body as WebReadableStream<Uint8Array>))).file;
}

async function tiktokTexts(crawl: SocialCrawl, url: string): Promise<{ transcript: string | null; screenText: string | null }> {
  const [transcript, screen] = await Promise.all([
    crawl.get<{ transcript?: string | null }>('tiktok/post/transcript', { url }).catch(() => null),
    crawl.get<{ texts?: string[] | null; subtitles?: string[] | null }>('tiktok/video/screen-text', { url, frames: 'all' }).catch(() => null),
  ]);
  const texts = [...(screen?.data.texts ?? [])].filter(Boolean);
  return {
    transcript: transcript?.data.transcript?.trim().slice(0, TEXT_MAX) || null,
    screenText: texts.length > 0 ? texts.join('\n').slice(0, TEXT_MAX) : null,
  };
}

// La copertina salvata dalla ricerca, copiata tra gli allegati del brand.
async function cover(storage: MediaStorage, files: BrandFiles, brandId: string, trend: StoredTrend): Promise<string | null> {
  if (!trend.thumbnail_path) return null;
  const response = await fetch(await storage.sign(trend.thumbnail_path), { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) return null;
  const file = `${ATTACHMENTS_DIR}/${randomUUID()}.jpg`;
  await files.save(brandId, file, new Uint8Array(await response.arrayBuffer()));
  return file;
}

export async function prepareTrendReference(
  crawl: SocialCrawl | null,
  storage: MediaStorage,
  files: BrandFiles,
  brandId: string,
  trend: StoredTrend,
  upload: VideoUpload,
): Promise<TrendReference> {
  const base: ChatTrend = {
    platform: trend.platform,
    url: trend.url,
    author: trend.author,
    caption: trend.caption,
    views: trend.views === null ? null : Number(trend.views),
    likes: trend.likes === null ? null : Number(trend.likes),
    durationSeconds: trend.duration_seconds,
    music: trend.music,
    file: null,
    video: false,
    transcript: null,
    screenText: null,
  };
  if (crawl && trend.platform === 'instagram') {
    const video = await instagramVideo(crawl, trend.url, upload).catch(() => null);
    if (video) return { attachments: [video], trend: { ...base, file: video, video: true } };
  }
  const [texts, image] = await Promise.all([
    crawl && trend.platform === 'tiktok' ? tiktokTexts(crawl, trend.url) : Promise.resolve({ transcript: null, screenText: null }),
    cover(storage, files, brandId, trend).catch(() => null),
  ]);
  return { attachments: image ? [image] : [], trend: { ...base, ...texts, file: image } };
}
