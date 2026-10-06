import type pg from 'pg';

import type { PublishProposal } from '@moonbrand/shared/api/contract';
import type { ChannelId, ChannelState } from '@moonbrand/shared/domain/brand';
import { channelName } from '@moonbrand/shared/domain/catalog';
import type { Content } from '@moonbrand/shared/domain/content';
import { planNow } from '@moonbrand/shared/lib/dates';

import { withIdentity, type Identity } from '../../db/identity';
import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { findContent, setContentStatus } from '../contents/repository';
import { withUrls } from '../contents/service';
import { findSlot, insertSlot, setContentSlot, updateSlot } from '../plan/repository';
import { listPublications } from './publications';
import { publishSoon } from './publisher';

// Pubblicare adesso, dal pulsante che l'assistente mette sotto la sua risposta: il contenuto si approva e la sua
// uscita va a quest'ora, poi il pubblicatore lo fa uscire come ogni altra uscita arrivata all'ora.

// I canali che non sono ancora usciti né stanno uscendo: quelli da pubblicare.
async function pendingChannels(db: Queryable, content: Content): Promise<ChannelId[]> {
  const publications = (await listPublications(db, [content.id])).get(content.id) ?? [];
  const done = new Set(publications.filter((item) => item.status !== 'failed').map((item) => item.channel));
  return content.channels.filter((channel) => !done.has(channel));
}

// Senza un canale collegato il post lì non esce: meglio dirlo prima di proporre o di premere.
async function requireConnected(db: Queryable, brandId: string, channels: readonly ChannelId[]): Promise<void> {
  const { rows } = await db.query<{ channels: Partial<Record<ChannelId, ChannelState>> }>('select channels from presenza.brands where id = $1', [brandId]);
  const missing = channels.filter((channel) => !rows[0]?.channels[channel]?.accountId);
  if (missing.length > 0) {
    throw ApiError.conflict(
      'CHANNEL_NOT_CONNECTED',
      `${missing.map(channelName).join(', ')} non ${missing.length > 1 ? 'sono collegati' : 'è collegato'}: collegalo da Impostazioni brand → Canali.`,
    );
  }
}

// Il contenuto si può pubblicare adesso? Restituisce i canali dove uscirà.
export async function checkPublishable(db: Queryable, content: Content): Promise<ChannelId[]> {
  const channels = await pendingChannels(db, content);
  if (channels.length === 0) throw ApiError.conflict('ALREADY_PUBLISHED', 'Questo contenuto è già uscito su tutti i suoi canali.');
  await requireConnected(db, content.brandId, channels);
  return channels;
}

export async function publishNow(pool: pg.Pool, files: BrandFiles, identity: Identity, contentId: string): Promise<PublishProposal> {
  const proposal = await withIdentity(pool, identity, async (db) => {
    const found = await findContent(db, contentId);
    if (!found) throw ApiError.notFound('Contenuto non trovato.');
    await checkPublishable(db, found);
    // Un canale dove non era uscito si riprova: il pubblicatore prende solo i canali senza una pubblicazione. Le
    // pubblicazioni le scrive il pubblicatore, con la connessione del server: chi usa moonbrand le legge soltanto, quindi
    // anche questa riga passa da lì, ora che si sa che il contenuto è suo.
    await pool.query(`delete from presenza.publications where content_id = $1 and status = 'failed'`, [found.id]);
    const content = (await setContentStatus(db, found.id, 'approved')) ?? found;
    const now = planNow();
    const slot = content.slotId ? await findSlot(db, content.slotId) : null;
    if (slot) {
      await updateSlot(db, slot.id, { ...slot, date: now.date, time: now.time, channels: content.channels, contentTitle: content.title, status: 'scheduled' });
    } else {
      const created = await insertSlot(db, {
        brandId: content.brandId,
        accountId: identity.accountId,
        date: now.date,
        time: now.time,
        channels: content.channels,
        themeId: content.themeId,
        ideaId: content.ideaId,
        contentTitle: content.title,
        status: 'scheduled',
        origin: content.ideaId ? 'idea' : 'manual',
      });
      await setContentSlot(db, content.id, created.id);
    }
    const publications = (await listPublications(db, [content.id])).get(content.id) ?? [];
    return { content: withUrls({ ...content, slotId: slot?.id ?? content.slotId }, files), publications };
  });
  // Dopo il commit: il pubblicatore vede l'uscita arrivata all'ora e la prende subito, senza aspettare il suo giro.
  publishSoon();
  return proposal;
}
