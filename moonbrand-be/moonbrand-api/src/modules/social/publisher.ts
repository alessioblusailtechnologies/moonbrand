import path from 'node:path';

import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

import type { ChannelId, ChannelState } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import { channelFiles, postText, sortFiles, type Content, type ContentFile } from '@moonbrand/shared/domain/content';

import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { findContent } from '../contents/repository';
import { platformOf, zernio, type PostOutcome, type PostRequest, type Zernio } from './zernio';

// La pubblicazione vera: ogni minuto, le uscite il cui contenuto è approvato e la cui ora è arrivata escono, con Zernio,
// su ogni canale del contenuto. Una riga in presenza.publications per contenuto e canale: inserirla è prenderla in carico,
// così due processi dell'API non pubblicano due volte. Si guarda indietro solo WINDOW: un'uscita passata da prima
// (per esempio programmata e approvata quando la pubblicazione non c'era) non esce più. Un canale dove il social ha
// chiuso l'accesso aspetta: se si ricollega entro WINDOW il post esce lo stesso, in ritardo.
const CHECK_MS = 60_000;
const WINDOW = '24 hours';
// I post ancora in elaborazione (soprattutto i video) si ricontrollano finché il social non dice com'è andata.
const RECHECK_AFTER = '30 seconds';
const GIVE_UP_AFTER = '1 day';

const CONTENT_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.pdf': 'application/pdf' };

interface Claimed {
  id: string;
  content_id: string;
  brand_id: string;
  channel: ChannelId;
}

// Prende in carico le pubblicazioni dovute: una riga publishing per ogni canale delle uscite arrivate all'ora.
async function claimDue(pool: pg.Pool): Promise<Claimed[]> {
  const { rows } = await pool.query<Claimed>(
    `with due as (
       select c.id as content_id, c.brand_id, c.account_id, s.id as slot_id, ch.channel
       from presenza.slots s
         join presenza.contents c on c.slot_id = s.id and c.status = 'approved'
         join presenza.brands b on b.id = c.brand_id
         cross join lateral unnest(c.channels) as ch(channel)
       where coalesce(b.channels -> ch.channel ->> 'lost', 'false') <> 'true'
         and ((s.publish_date + s.publish_time::time) at time zone 'Europe/Rome') <= now()
         and ((s.publish_date + s.publish_time::time) at time zone 'Europe/Rome') > now() - interval '${WINDOW}'
     )
     insert into presenza.publications (account_id, brand_id, content_id, slot_id, channel, status)
     select account_id, brand_id, content_id, slot_id, channel, 'publishing' from due
     on conflict (content_id, channel) do nothing
     returning id, content_id, brand_id, channel`,
  );
  return rows;
}

async function settle(pool: pg.Pool, id: string, result: { status: 'publishing' | 'published' | 'failed'; postId?: string | null; url?: string | null; error?: string | null }) {
  await pool.query(
    `update presenza.publications
       set status = $2, zernio_post_id = coalesce($3, zernio_post_id), post_url = $4, error = $5, updated_at = now(),
           published_at = case when $2 = 'published' then now() else published_at end
     where id = $1`,
    [id, result.status, result.postId ?? null, result.url ?? null, result.error ?? null],
  );
}

// L'uscita è pubblicata quando il suo contenuto è uscito su tutti i canali: allora lo stato salvato lo dice anche a social-app.
async function markSlotPublished(pool: pg.Pool, contentId: string): Promise<void> {
  await pool.query(
    `update presenza.slots s set status = 'published'
     from presenza.contents c
     where c.id = $1 and c.slot_id = s.id and s.status <> 'published'
       and not exists (
         select 1 from unnest(c.channels) as ch(channel)
         where not exists (select 1 from presenza.publications p where p.content_id = c.id and p.channel = ch.channel and p.status = 'published')
       )`,
    [contentId],
  );
}

// Com'è andato secondo Zernio: published e failed sono definitivi, il resto vuol dire che il social sta ancora elaborando.
function fromOutcome(outcome: PostOutcome) {
  if (outcome.status === 'published') return { status: 'published' as const, postId: outcome.postId, url: outcome.url };
  if (outcome.status === 'failed' || outcome.status === 'cancelled') {
    return { status: 'failed' as const, postId: outcome.postId, error: outcome.error ?? 'Il social ha rifiutato il post.' };
  }
  return { status: 'publishing' as const, postId: outcome.postId };
}

// Il post di un contenuto su un canale: il testo della sua variante e i file nella proporzione del canale, caricati su Zernio.
// Dove esce il post: l'account collegato e, per Pinterest, la bacheca e il sito a cui porta il pin.
interface Target {
  accountId: string;
  board: { id: string; name: string } | null;
  site: string;
}

// Il link del pin: il sito del brand, in https (Pinterest non accetta altro); niente link se il sito non è un indirizzo.
function pinLink(site: string): string | null {
  const value = site.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

async function buildPost(client: Zernio, files: BrandFiles, content: Content, channel: ChannelId, target: Target): Promise<PostRequest> {
  const variant = content.variants.find((item) => item.channel === channel);
  if (!variant?.text.trim()) throw ApiError.invalid(`Manca il testo per ${channelName(channel)}.`);
  const all = content.visual.files ?? [];
  const mine = sortFiles(channelFiles(all, content.format, channel));
  const upload = async (file: ContentFile) => {
    const extension = path.extname(file.file).toLowerCase();
    const type = CONTENT_TYPES[extension];
    if (!type) throw ApiError.invalid(`Formato non pubblicabile: ${path.basename(file.file)}.`);
    const bytes = await files.read(content.brandId, file.file);
    return client.upload(path.basename(file.file), type, bytes);
  };

  const specific: Record<string, unknown> = {};
  let mediaItems: PostRequest['mediaItems'] = [];
  if (content.format === 'video') {
    const video = mine.find((file) => file.role === 'video');
    if (!video) throw ApiError.invalid('Il video non è ancora pronto.');
    const cover = mine.find((file) => file.role === 'cover');
    mediaItems = [{ type: 'video', url: await upload(video) }];
    if (channel === 'instagram' && cover) specific.instagramThumbnail = await upload(cover);
    if (channel === 'facebook' && video.aspect === '9:16') specific.contentType = 'reel';
  } else if (content.format === 'carousel' && channel === 'linkedin') {
    // Su LinkedIn il carosello è il PDF delle slide.
    const document = all.find((file) => file.role === 'document');
    if (!document) throw ApiError.invalid('Manca il PDF del carosello per LinkedIn.');
    mediaItems = [{ type: 'document', url: await upload(document), title: content.title }];
    specific.documentTitle = content.title;
  } else if (content.format === 'carousel') {
    const slides = mine.filter((file) => file.role === 'slide');
    if (slides.length === 0) throw ApiError.invalid('Mancano le slide del carosello.');
    mediaItems = await Promise.all(slides.map(async (slide) => ({ type: 'image' as const, url: await upload(slide) })));
  } else {
    const cover = mine.find((file) => file.role === 'cover');
    if (cover) mediaItems = [{ type: 'image', url: await upload(cover) }];
    else if (channel === 'instagram' || channel === 'tiktok' || channel === 'pinterest') {
      throw ApiError.invalid(`Su ${channelName(channel)} serve un’immagine.`);
    }
  }

  // Ogni pin va su una bacheca, con un titolo (al massimo 100 caratteri) e, se c'è, il link al sito.
  if (channel === 'pinterest') {
    if (!target.board) throw ApiError.invalid('Manca la bacheca di Pinterest: ricollega Pinterest dalle Impostazioni brand.');
    specific.boardId = target.board.id;
    specific.title = content.title.slice(0, 100);
    const link = pinLink(target.site);
    if (link) specific.link = link;
  }

  return {
    content: postText(variant),
    mediaItems,
    platform: { platform: platformOf(channel), accountId: target.accountId, ...(Object.keys(specific).length > 0 && { platformSpecificData: specific }) },
    // TikTok vuole il consenso esplicito: chi approva il contenuto in moonbrand l'ha visto e ne ha deciso l'uscita.
    ...(channel === 'tiktok' && {
      tiktokSettings: {
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        allowComment: true,
        allowDuet: true,
        allowStitch: true,
        contentPreviewConfirmed: true,
        expressConsentGiven: true,
      },
    }),
  };
}

async function publishOne(pool: pg.Pool, files: BrandFiles, client: Zernio, claimed: Claimed, log: FastifyBaseLogger): Promise<void> {
  try {
    const { rows } = await pool.query<{ state: ChannelState | null; site: string | null }>(
      "select channels -> $2 as state, identity ->> 'site' as site from presenza.brands where id = $1",
      [claimed.brand_id, claimed.channel],
    );
    const accountId = rows[0]?.state?.accountId;
    if (!accountId) throw ApiError.invalid(`${channelName(claimed.channel)} non è collegato: collegalo dalle Impostazioni brand.`);
    const content = await findContent(pool, claimed.content_id);
    if (!content) throw ApiError.notFound('Contenuto non trovato.');
    const target: Target = { accountId, board: rows[0]?.state?.board ?? null, site: rows[0]?.site ?? '' };
    const post = await buildPost(client, files, content, claimed.channel, target);
    await settle(pool, claimed.id, fromOutcome(await client.publish(post, claimed.id)));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn({ err: error, publication: claimed.id }, 'pubblicazione non riuscita');
    await settle(pool, claimed.id, { status: 'failed', error: message });
  }
  await markSlotPublished(pool, claimed.content_id);
}

// I post che il social stava ancora elaborando: si chiede a Zernio com'è finita. Dopo un giorno si lascia perdere.
async function recheck(pool: pg.Pool, client: Zernio, log: FastifyBaseLogger): Promise<void> {
  const { rows } = await pool.query<{ id: string; content_id: string; zernio_post_id: string; stale: boolean }>(
    `select id, content_id, zernio_post_id, created_at < now() - interval '${GIVE_UP_AFTER}' as stale from presenza.publications
     where status = 'publishing' and zernio_post_id is not null and updated_at < now() - interval '${RECHECK_AFTER}'`,
  );
  for (const row of rows) {
    try {
      const result = fromOutcome(await client.outcome(row.zernio_post_id));
      if (result.status === 'publishing' && row.stale) await settle(pool, row.id, { status: 'failed', error: 'Il social non ha confermato la pubblicazione.' });
      else await settle(pool, row.id, result);
      await markSlotPublished(pool, row.content_id);
    } catch (error) {
      log.warn({ err: error, publication: row.id }, 'stato della pubblicazione non letto');
    }
  }
}

// Il giro del pubblicatore di questo processo, per farlo partire subito (publishSoon) invece di aspettare il minuto.
let wake: (() => void) | null = null;

export function publishSoon(): void {
  wake?.();
}

export function schedulePublishing(pool: pg.Pool, files: BrandFiles, apiKey: string | undefined, log: FastifyBaseLogger): () => void {
  if (!apiKey) {
    log.warn('pubblicazione spenta: manca ZERNIO_API_KEY');
    return () => undefined;
  }
  const client = zernio(apiKey);
  // again: qualcuno ha chiesto un giro mentre ne girava già uno, che allora ricomincia appena finito.
  let running = false;
  let again = false;
  const round = async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        for (const claimed of await claimDue(pool)) await publishOne(pool, files, client, claimed, log);
        await recheck(pool, client, log);
      } while (again);
    } catch (error) {
      log.warn({ err: error }, 'giro di pubblicazione non riuscito');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void round(), CHECK_MS);
  wake = () => void round();
  void round();
  return () => {
    clearInterval(timer);
    wake = null;
  };
}
