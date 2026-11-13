import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

import type { AdMetrics, AdStatus } from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import { deleteAdRow, findConnection, isSimulatedAd, isSimulatedConnection, liveAds, patchAd, type AdRow } from './repository';
import { normalizeMetrics, ZernioAdsError, type ZernioAd, type ZernioAds } from './zernio-ads';

// Oggi a Roma, AAAA-MM-GG: le date delle campagne sono giorni italiani.
export const today = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

// Lo stato di Zernio (status di consegna e reviewStatus di Google) nel nostro. undefined: non lo conosciamo, resta com'è.
export function mapStatus(ad: Pick<ZernioAd, 'status' | 'reviewStatus'>): AdStatus | undefined {
  const review = ad.reviewStatus?.toLowerCase();
  if (review === 'rejected' || review === 'disapproved') return 'rejected';
  switch (ad.status?.toLowerCase()) {
    case 'pending_review':
    case 'in_review':
    case 'pending':
      return 'in_review';
    case 'active':
    case 'enabled':
      return 'active';
    case 'paused':
      return 'paused';
    case 'completed':
    case 'ended':
      return 'ended';
    case 'cancelled':
    case 'removed':
    case 'deleted':
      return 'deleted';
    case 'rejected':
    case 'disapproved':
      return 'rejected';
    case 'error':
      return 'failed';
    default:
      return undefined;
  }
}

// La piattaforma come la vuole Zernio nelle chiamate sulle campagne: quella dell'annuncio, o google.
const zernioPlatform = (row: AdRow) => (row.platform === 'google' ? 'google' : row.platform);

// Metriche finte che crescono con i minuti dall'avvio, per la simulazione.
function simulatedMetrics(row: AdRow): AdMetrics {
  const minutes = Math.max(0, (Date.now() - (row.launched_at?.getTime() ?? Date.now())) / 60_000);
  const impressions = Math.round(minutes * 37);
  const clicks = Math.round(impressions * 0.052);
  const spend = Math.min(Number(row.daily_budget) * Math.max(1, Math.ceil(minutes / 1440)), Math.round(clicks * 0.42 * 100) / 100);
  return { spend, impressions, clicks, ctr: impressions ? (clicks / impressions) * 100 : null, cpc: clicks ? spend / clicks : null };
}

export interface AdsService {
  launch(db: Queryable, row: AdRow): Promise<AdRow>;
  pause(db: Queryable, row: AdRow): Promise<AdRow>;
  resume(db: Queryable, row: AdRow): Promise<AdRow>;
  remove(db: Queryable, row: AdRow): Promise<AdRow | null>;
  sync(db: Queryable, row: AdRow): Promise<AdRow>;
}

export function adsService(client: () => ZernioAds): AdsService {
  // Su Google si mette in pausa la campagna intera: c'è un solo annuncio, e ferma la spesa subito.
  const setStatus = async (row: AdRow, status: 'ACTIVE' | 'PAUSED') => {
    if (isSimulatedAd(row)) return;
    if (!row.platform_campaign_id) throw ApiError.invalid('La campagna non è ancora su Google: riprova tra poco.');
    await client().setCampaignStatus(row.platform_campaign_id, zernioPlatform(row), status);
  };

  const service: AdsService = {
    async launch(db, row) {
      if (row.status !== 'draft' && row.status !== 'failed') throw ApiError.conflict('AD_NOT_DRAFT', 'Questa campagna è già partita.');
      if (row.ends_on && row.ends_on < today()) throw ApiError.invalid('La data di fine è già passata: cambiala prima di avviare.');
      const connection = await findConnection(db, row.brand_id, row.platform);
      if (!connection || connection.lost) throw ApiError.invalid('Collega Google Ads prima di avviare la campagna.');
      if (!connection.ad_account_id) throw ApiError.invalid('Scegli l’account Google Ads prima di avviare la campagna.');
      const base = { adAccountId: connection.ad_account_id, currency: connection.currency, launched: true, error: null, detail: null };
      if (isSimulatedConnection(connection)) {
        return patchAd(db, row.id, { ...base, status: 'in_review', zernioAdId: `${SIMULATED_ACCOUNT}${row.id}`, reviewStatus: 'in_review', synced: true });
      }
      try {
        const ad = await client().createSearch(
          {
            accountId: connection.zernio_account_id,
            adAccountId: connection.ad_account_id,
            name: row.name,
            spec: row.spec,
            dailyBudget: Number(row.daily_budget),
            startsOn: row.starts_on < today() ? today() : row.starts_on,
            endsOn: row.ends_on,
          },
          row.idempotency_key,
        );
        return await patchAd(db, row.id, {
          ...base,
          status: mapStatus(ad) ?? 'in_review',
          zernioAdId: ad._id,
          platformCampaignId: ad.platformCampaignId ?? null,
          platformAdGroupId: ad.platformAdSetId ?? null,
          platformAdId: ad.platformAdId ?? null,
          reviewStatus: ad.reviewStatus ?? null,
          synced: true,
        });
      } catch (error) {
        if (error instanceof ZernioAdsError) {
          await patchAd(db, row.id, { status: 'failed', error: error.message, detail: { code: error.zernioCode, raw: error.raw } });
        }
        throw error;
      }
    },

    async pause(db, row) {
      if (row.status !== 'active' && row.status !== 'in_review') throw ApiError.conflict('AD_NOT_LIVE', 'La campagna non è attiva.');
      await setStatus(row, 'PAUSED');
      return patchAd(db, row.id, { status: 'paused' });
    },

    async resume(db, row) {
      if (row.status !== 'paused') throw ApiError.conflict('AD_NOT_PAUSED', 'La campagna non è in pausa.');
      if (row.ends_on && row.ends_on < today()) throw ApiError.invalid('La campagna è finita: creane una nuova.');
      await setStatus(row, 'ACTIVE');
      return patchAd(db, row.id, { status: row.review_status === 'in_review' ? 'in_review' : 'active' });
    },

    // Bozze e creazioni fallite si cancellano; una campagna su Google si ferma e si toglie, e resta nell'elenco come eliminata.
    async remove(db, row) {
      if (row.status === 'draft' || row.status === 'failed' || !row.zernio_ad_id) {
        await deleteAdRow(db, row.id);
        return null;
      }
      if (row.status === 'deleted') return row;
      if (!isSimulatedAd(row)) {
        if (row.status !== 'paused' && row.status !== 'ended' && row.status !== 'rejected') await setStatus(row, 'PAUSED');
        await client().deleteAd(row.zernio_ad_id);
        if (row.platform_campaign_id) await client().deleteCampaign(row.platform_campaign_id, zernioPlatform(row));
      }
      return patchAd(db, row.id, { status: 'deleted' });
    },

    // Rilegge stato e metriche; passata la data di fine, la campagna si mette in pausa e diventa finita.
    async sync(db, row) {
      if (!row.zernio_ad_id) return row;
      let status: AdStatus | undefined;
      let patch: Parameters<typeof patchAd>[2] = { synced: true };
      if (isSimulatedAd(row)) {
        const minutes = (Date.now() - (row.launched_at?.getTime() ?? Date.now())) / 60_000;
        status = row.status === 'in_review' && minutes >= 1 ? 'active' : row.status;
        patch = { ...patch, status, reviewStatus: status === 'in_review' ? 'in_review' : 'approved', metrics: status === 'in_review' ? null : simulatedMetrics(row) };
      } else {
        const ad = await client().ad(row.zernio_ad_id);
        if (!ad) return patchAd(db, row.id, { status: 'deleted', synced: true });
        status = mapStatus(ad);
        // La pausa chiesta da noi vale finché Google non dice altro che "attivo": non si rimette attiva da sola.
        if (row.status === 'paused' && (status === 'active' || status === 'in_review')) status = 'paused';
        patch = {
          ...patch,
          ...(status && { status }),
          reviewStatus: ad.reviewStatus ?? row.review_status,
          rejectionReason: ad.rejectionReason ?? null,
          metrics: normalizeMetrics(ad.metrics) ?? row.metrics,
          platformCampaignId: ad.platformCampaignId ?? row.platform_campaign_id,
          platformAdGroupId: ad.platformAdSetId ?? row.platform_ad_group_id,
          platformAdId: ad.platformAdId ?? row.platform_ad_id,
        };
      }
      let updated = await patchAd(db, row.id, patch);
      if (updated.ends_on && updated.ends_on < today() && (updated.status === 'active' || updated.status === 'in_review' || updated.status === 'paused')) {
        if (updated.status !== 'paused') await setStatus(updated, 'PAUSED');
        updated = await patchAd(db, row.id, { status: 'ended' });
      }
      return updated;
    },
  };
  return service;
}

// Rilegge le campagne vive di un brand non lette da più di qualche minuto: all'apertura della pagina Campagne.
export async function syncBrand(db: Queryable, service: AdsService, brandId: string, log: FastifyBaseLogger): Promise<void> {
  for (const row of await liveAds(db, 10, brandId)) {
    await service.sync(db, row).catch((error: unknown) => log.warn({ err: error, adId: row.id }, 'campagna non riletta'));
  }
}

// Ogni ora tutte le campagne vive: stato, metriche e fine. Le simulate vanno anche senza Zernio.
export function scheduleAdsSync(pool: pg.Pool, service: AdsService, log: FastifyBaseLogger): () => void {
  let running = false;
  const round = async () => {
    if (running) return;
    running = true;
    try {
      for (const row of await liveAds(pool, 50)) {
        await service.sync(pool, row).catch((error: unknown) => log.warn({ err: error, adId: row.id }, 'campagna non riletta'));
      }
    } catch (error) {
      log.warn({ err: error }, 'giro delle campagne non riuscito');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void round(), 60 * 60_000);
  const first = setTimeout(() => void round(), 60_000);
  return () => {
    clearInterval(timer);
    clearTimeout(first);
  };
}
