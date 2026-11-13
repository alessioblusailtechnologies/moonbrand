// SocialCrawl (socialcrawl.dev): un'API sola per i dati pubblici di TikTok e Instagram, con la chiave nell'header
// x-api-key. Ogni chiamata scala crediti dal pacchetto comprato; la risposta dice quanti ne ha usati e quanti ne restano.
const BASE = 'https://www.socialcrawl.dev/v1';
const TIMEOUT_MS = 120_000;

// Il post come lo dà SocialCrawl, uguale per i due social; qui solo i campi che usiamo.
export interface SocialPost {
  id: string;
  url: string;
  content: { text?: string | null; media_urls?: string | string[] | null; thumbnail_url?: string | null; duration_seconds?: number | null };
  author?: { username?: string | null; display_name?: string | null } | null;
  engagement?: { views?: number | null; likes?: number | null; comments?: number | null; shares?: number | null } | null;
  published_at?: string | null;
  ext?: { region?: string | null; music_title?: string | null; music_artist?: string | null; music_is_original?: boolean | null } | null;
}

export interface SocialRow {
  post: SocialPost;
  computed?: { relevance?: { p?: number | null } | null } | null;
}

interface Envelope<T> {
  success: boolean;
  data: T;
  credits_used?: number;
  credits_remaining?: number;
  error?: { type?: string; message?: string };
}

// Un errore di SocialCrawl con lo stato HTTP: 402 vuol dire crediti finiti.
export class SocialCrawlError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface SocialCrawl {
  get<T>(path: string, params: Record<string, string | number | undefined>): Promise<{ data: T; credits: number }>;
}

export function socialCrawl(apiKey: string): SocialCrawl {
  return {
    async get<T>(path: string, params: Record<string, string | number | undefined>) {
      const url = new URL(`${BASE}/${path}`);
      for (const [key, value] of Object.entries(params)) if (value !== undefined) url.searchParams.set(key, String(value));
      const response = await fetch(url, { headers: { 'x-api-key': apiKey }, signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = (await response.json().catch(() => null)) as Envelope<T> | null;
      if (!response.ok || !body?.success) {
        throw new SocialCrawlError(response.status, `SocialCrawl ${path}: ${response.status} ${body?.error?.message ?? body?.error?.type ?? 'risposta non valida'}`);
      }
      return { data: body.data, credits: body.credits_used ?? 0 };
    },
  };
}

// I media del post: uno o più URL (i caroselli ne hanno più d'uno). Sono link firmati che scadono in poche ore.
export function mediaUrls(post: SocialPost): string[] {
  const media = post.content.media_urls;
  return (Array.isArray(media) ? media : media ? [media] : []).filter((url) => typeof url === 'string' && url.length > 0);
}
