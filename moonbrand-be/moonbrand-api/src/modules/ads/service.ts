import type { FastifyBaseLogger } from 'fastify';
import type pg from 'pg';

import type { AdCreativeRequest, AdSettingsRequest, AdTargetingRequest } from '@moonbrand/shared/api/contract';
import type { AdMetrics, AdSpec, AdStatus } from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { Queryable } from '../../db/pool';
import { ApiError } from '../../errors';
import type { BrandFiles } from '../brand-files/files';
import { brandLogo, resolveAdImages, resolveCardImage } from './ad-images';
import { biddingFields, campaignBody, devicesTargeting, locationsTargeting, pmaxExtraAssets } from './google-campaign';
import { deleteAdRow, findConnection, isSimulatedAd, isSimulatedConnection, liveAds, patchAd, type AdPatch, type AdRow, type ConnectionRow } from './repository';
import { simulatedAds } from './simulated-ads';
import { normalizeMetrics, ZernioAdsError, type AdsAccountRef, type ZernioAd, type ZernioAds } from './zernio-ads';

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

// Metriche finte che crescono con i minuti dall'avvio, per la simulazione.
function simulatedMetrics(row: AdRow): AdMetrics {
  const minutes = Math.max(0, (Date.now() - (row.launched_at?.getTime() ?? Date.now())) / 60_000);
  const impressions = Math.round(minutes * 37);
  const clicks = Math.round(impressions * 0.052);
  const spend = Math.min(Number(row.daily_budget) * Math.max(1, Math.ceil(minutes / 1440)), Math.round(clicks * 0.42 * 100) / 100);
  return { spend, impressions, clicks, ctr: impressions ? (clicks / impressions) * 100 : null, cpc: clicks ? spend / clicks : null, conversions: Math.floor(clicks / 12) };
}

const SIMULATED = simulatedAds();

// Una campagna su Google con il collegamento con cui si gestisce.
export interface LiveCampaign {
  client: ZernioAds;
  ref: AdsAccountRef;
  campaignId: string;
  simulated: boolean;
}

export interface AdsService {
  // Il client giusto per un collegamento: quello vero o quello simulato.
  clientFor(connection: Pick<ConnectionRow, 'zernio_account_id'>): ZernioAds;
  live(db: Queryable, row: AdRow): Promise<LiveCampaign>;
  launch(db: Queryable, row: AdRow): Promise<AdRow>;
  pause(db: Queryable, row: AdRow): Promise<AdRow>;
  resume(db: Queryable, row: AdRow): Promise<AdRow>;
  remove(db: Queryable, row: AdRow): Promise<AdRow | null>;
  sync(db: Queryable, row: AdRow): Promise<AdRow>;
  updateSettings(db: Queryable, row: AdRow, request: AdSettingsRequest): Promise<AdRow>;
  updateCreative(db: Queryable, row: AdRow, request: AdCreativeRequest): Promise<AdRow>;
  updateTargeting(db: Queryable, row: AdRow, request: AdTargetingRequest): Promise<AdRow>;
}

const ON_GOOGLE: readonly AdStatus[] = ['scheduled', 'in_review', 'active', 'paused', 'ended', 'rejected'];

export function adsService(client: () => ZernioAds, files: BrandFiles): AdsService {
  const clientFor = (connection: Pick<ConnectionRow, 'zernio_account_id'>) => (isSimulatedConnection(connection) ? SIMULATED : client());

  const live = async (db: Queryable, row: AdRow): Promise<LiveCampaign> => {
    if (!ON_GOOGLE.includes(row.status) || !row.platform_campaign_id) throw ApiError.invalid('La campagna non è ancora su Google.');
    const connection = await findConnection(db, row.brand_id, row.platform);
    if (!connection || connection.lost) throw ApiError.invalid('Ricollega Google Ads per gestire la campagna.');
    const simulated = isSimulatedAd(row);
    return {
      client: simulated ? SIMULATED : clientFor(connection),
      ref: { accountId: connection.zernio_account_id, adAccountId: row.ad_account_id ?? connection.ad_account_id ?? '' },
      campaignId: row.platform_campaign_id,
      simulated,
    };
  };

  // Accende la campagna e, per Performance Max e Demand Gen che nascono in pausa, anche gruppi e annunci.
  const activate = async (db: Queryable, row: AdRow) => {
    const campaign = await live(db, row);
    if (campaign.simulated) return;
    await campaign.client.setCampaignStatus(campaign.campaignId, 'active');
    if (row.campaign_type === 'pmax') {
      for (const group of await campaign.client.assetGroups(campaign.ref, campaign.campaignId)) {
        if (group.status?.toUpperCase() !== 'ENABLED') await campaign.client.setAssetGroupStatus(campaign.ref, campaign.campaignId, group.id, 'ENABLED');
      }
    }
    if (row.campaign_type === 'demand_gen') {
      if (row.platform_ad_group_id) await campaign.client.setAdSetStatus(row.platform_ad_group_id, 'active');
      if (row.zernio_ad_id) await campaign.client.updateAd(row.zernio_ad_id, { status: 'active' });
    }
  };

  const setStatus = async (db: Queryable, row: AdRow, status: 'active' | 'paused') => {
    const campaign = await live(db, row);
    if (!campaign.simulated) await campaign.client.setCampaignStatus(campaign.campaignId, status);
  };

  // Le aggiunte dopo la creazione (asset di Performance Max, dispositivi, tracciamento): se una non va, la campagna resta
  // e l'errore si mostra sulla riga.
  const afterCreate = async (db: Queryable, row: AdRow, images: Awaited<ReturnType<typeof resolveAdImages>>): Promise<string[]> => {
    const problems: string[] = [];
    const campaign = await live(db, row);
    const step = async (what: string, work: () => Promise<void>) => {
      try {
        await work();
      } catch (error) {
        problems.push(`${what}: ${error instanceof Error ? error.message : 'non riuscito'}`);
      }
    };
    const { spec } = row;
    if (row.campaign_type === 'pmax') {
      const extra = pmaxExtraAssets(spec, images);
      if (extra.length) {
        await step('Asset in più', async () => {
          const [group] = await campaign.client.assetGroups(campaign.ref, campaign.campaignId);
          if (group) await campaign.client.linkAssetGroupAssets(campaign.ref, campaign.campaignId, group.id, extra);
        });
      }
    }
    const devices = row.campaign_type === 'search' || row.campaign_type === 'display' ? devicesTargeting(spec.devices) : null;
    if (devices) await step('Dispositivi', () => campaign.client.setCampaignTargeting(campaign.ref, campaign.campaignId, { devices }));
    if (spec.trackingUrlTemplate || spec.finalUrlSuffix) {
      await step('Monitoraggio', () =>
        campaign.client.updateCampaign(campaign.ref, campaign.campaignId, {
          ...(spec.trackingUrlTemplate && { trackingUrlTemplate: spec.trackingUrlTemplate }),
          ...(spec.finalUrlSuffix && { finalUrlSuffix: spec.finalUrlSuffix }),
        }),
      );
    }
    return problems;
  };

  const service: AdsService = {
    clientFor,
    live,

    async launch(db, row) {
      if (row.status !== 'draft' && row.status !== 'failed') throw ApiError.conflict('AD_NOT_DRAFT', 'Questa campagna è già partita.');
      if (row.ends_on && row.ends_on < today()) throw ApiError.invalid('La data di fine è già passata: cambiala prima di avviare.');
      const connection = await findConnection(db, row.brand_id, row.platform);
      if (!connection || connection.lost) throw ApiError.invalid('Collega Google Ads prima di avviare la campagna.');
      if (!connection.ad_account_id) throw ApiError.invalid('Scegli l’account Google Ads prima di avviare la campagna.');
      const later = row.starts_on > today();
      const base = { adAccountId: connection.ad_account_id, currency: connection.currency, launched: true, error: null, detail: null };
      if (isSimulatedConnection(connection)) {
        const id = row.id.slice(0, 8);
        return patchAd(db, row.id, {
          ...base,
          status: later ? 'scheduled' : 'in_review',
          zernioAdId: `${SIMULATED_ACCOUNT}${row.id}`,
          platformCampaignId: `sim-c-${id}`,
          platformAdGroupId: `sim-g-${id}`,
          platformAdId: `sim-a-${id}`,
          reviewStatus: 'in_review',
          synced: true,
        });
      }
      const zernio = client();
      try {
        const logo = await brandLogo(db, row.brand_id);
        const upload = (name: string, type: string, bytes: Uint8Array) => zernio.upload(name, type, bytes);
        const images = await resolveAdImages(files, row.brand_id, logo, row.spec.images ?? {}, upload);
        const cards =
          row.campaign_type === 'demand_gen' && (row.spec.carouselCards?.length ?? 0) >= 2
            ? await Promise.all(
                row.spec.carouselCards!.map(async (card) => ({
                  headline: card.headline,
                  imageUrl: await resolveCardImage(files, row.brand_id, logo, card.image, upload),
                  ...(card.finalUrl && { finalUrl: card.finalUrl }),
                })),
              )
            : [];
        // Rete di ricerca e Display partono subito se è il giorno; gli altri tipi nascono sempre in pausa.
        const immediate = !later && (row.campaign_type === 'search' || row.campaign_type === 'display');
        const ad = await zernio.create(
          campaignBody({
            accountId: connection.zernio_account_id,
            adAccountId: connection.ad_account_id,
            name: row.name,
            campaignType: row.campaign_type,
            goal: row.goal,
            spec: row.spec,
            dailyBudget: Number(row.daily_budget),
            status: immediate ? 'ACTIVE' : 'PAUSED',
            images,
            cards,
          }),
          row.idempotency_key,
        );
        let saved = await patchAd(db, row.id, {
          ...base,
          status: later ? 'scheduled' : (mapStatus(ad) ?? 'in_review'),
          zernioAdId: ad._id,
          platformCampaignId: ad.platformCampaignId ?? null,
          platformAdGroupId: ad.platformAdSetId ?? null,
          platformAdId: ad.platformAdId ?? null,
          reviewStatus: ad.reviewStatus ?? null,
          synced: true,
        });
        if (!saved.platform_campaign_id) return saved;
        const problems = await afterCreate(db, saved, images);
        if (!later && !immediate) {
          try {
            await activate(db, saved);
            saved = await patchAd(db, row.id, { status: 'in_review' });
          } catch (error) {
            problems.push(`Accensione: ${error instanceof Error ? error.message : 'non riuscita'}. Riprendila da qui.`);
            saved = await patchAd(db, row.id, { status: 'paused' });
          }
        }
        return problems.length ? patchAd(db, row.id, { error: `Creata, ma su Google non è andato tutto: ${problems.join(' · ')}` }) : saved;
      } catch (error) {
        if (error instanceof ZernioAdsError || error instanceof ApiError) {
          await patchAd(db, row.id, { status: 'failed', error: error.message, detail: error instanceof ZernioAdsError ? { code: error.zernioCode, raw: error.raw } : null });
        }
        throw error;
      }
    },

    async pause(db, row) {
      if (row.status !== 'active' && row.status !== 'in_review' && row.status !== 'scheduled') throw ApiError.conflict('AD_NOT_LIVE', 'La campagna non è attiva.');
      if (row.status !== 'scheduled') await setStatus(db, row, 'paused');
      return patchAd(db, row.id, { status: 'paused', error: null });
    },

    async resume(db, row) {
      if (row.status !== 'paused') throw ApiError.conflict('AD_NOT_PAUSED', 'La campagna non è in pausa.');
      if (row.ends_on && row.ends_on < today()) throw ApiError.invalid('La campagna è finita: creane una nuova.');
      if (row.starts_on > today()) return patchAd(db, row.id, { status: 'scheduled' });
      await activate(db, row);
      return patchAd(db, row.id, { status: row.review_status === 'in_review' ? 'in_review' : 'active', error: null });
    },

    // Bozze e creazioni fallite si cancellano; una campagna su Google si ferma e si toglie, e resta nell'elenco come eliminata.
    async remove(db, row) {
      if (row.status === 'draft' || row.status === 'failed' || !row.zernio_ad_id) {
        await deleteAdRow(db, row.id);
        return null;
      }
      if (row.status === 'deleted') return row;
      if (!isSimulatedAd(row) && row.platform_campaign_id) {
        const campaign = await live(db, row);
        if (row.status !== 'paused' && row.status !== 'ended' && row.status !== 'rejected' && row.status !== 'scheduled') {
          await campaign.client.setCampaignStatus(campaign.campaignId, 'paused');
        }
        await campaign.client.deleteAd(row.zernio_ad_id);
        await campaign.client.deleteCampaign(campaign.ref, campaign.campaignId);
      }
      return patchAd(db, row.id, { status: 'deleted' });
    },

    // Rilegge stato e metriche. Il giorno d'inizio una campagna programmata si accende; passata la fine si mette in pausa.
    async sync(db, row) {
      const zernioAdId = row.zernio_ad_id;
      if (!zernioAdId) return row;
      if (row.status === 'scheduled' && row.starts_on <= today() && (!row.ends_on || row.ends_on >= today())) {
        await activate(db, row);
        row = await patchAd(db, row.id, { status: 'in_review', error: null });
      }
      let status: AdStatus | undefined;
      let patch: AdPatch = { synced: true };
      if (isSimulatedAd(row)) {
        const minutes = (Date.now() - (row.launched_at?.getTime() ?? Date.now())) / 60_000;
        status = row.status === 'in_review' && minutes >= 1 ? 'active' : row.status;
        patch = { ...patch, status, reviewStatus: status === 'in_review' || status === 'scheduled' ? 'in_review' : 'approved', metrics: status === 'in_review' || status === 'scheduled' ? null : simulatedMetrics(row) };
      } else {
        const ad = await client().ad(zernioAdId);
        if (!ad) return patchAd(db, row.id, { status: 'deleted', synced: true });
        status = mapStatus(ad);
        // La pausa chiesta da noi (o la partenza programmata) vale finché Google non dice altro che "attivo".
        if ((row.status === 'paused' || row.status === 'scheduled') && (status === 'active' || status === 'in_review' || status === 'paused')) status = row.status;
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
      if (updated.ends_on && updated.ends_on < today() && ['active', 'in_review', 'paused', 'scheduled'].includes(updated.status)) {
        if (updated.status !== 'paused' && updated.status !== 'scheduled') await setStatus(db, updated, 'paused');
        updated = await patchAd(db, row.id, { status: 'ended' });
      }
      return updated;
    },

    async updateSettings(db, row, request) {
      const campaign = await live(db, row);
      const body: Record<string, unknown> = {};
      if (request.dailyBudget !== undefined) body['budget'] = { amount: request.dailyBudget, type: 'daily' };
      if (request.bidding) Object.assign(body, biddingFields(request.bidding, row.campaign_type));
      if (request.network && row.campaign_type === 'search') body['networkSettings'] = request.network;
      if (request.trackingUrlTemplate !== undefined) body['trackingUrlTemplate'] = request.trackingUrlTemplate;
      if (request.finalUrlSuffix !== undefined) body['finalUrlSuffix'] = request.finalUrlSuffix;
      if (request.endsOn && request.endsOn < today()) throw ApiError.invalid('La data di fine è già passata.');
      if (Object.keys(body).length && !campaign.simulated) await campaign.client.updateCampaign(campaign.ref, campaign.campaignId, body);
      const spec: AdSpec = {
        ...row.spec,
        ...(request.bidding && { bidding: request.bidding }),
        ...(request.network && { network: request.network }),
        ...(request.trackingUrlTemplate !== undefined && { trackingUrlTemplate: request.trackingUrlTemplate }),
        ...(request.finalUrlSuffix !== undefined && { finalUrlSuffix: request.finalUrlSuffix }),
      };
      return patchAd(db, row.id, {
        spec,
        ...(request.dailyBudget !== undefined && { dailyBudget: request.dailyBudget }),
        ...(request.endsOn !== undefined && { endsOn: request.endsOn }),
      });
    },

    async updateCreative(db, row, request) {
      const campaign = await live(db, row);
      const spec: AdSpec = { ...row.spec, ...request, ...(request.images && { images: request.images }) };
      if (!campaign.simulated && row.zernio_ad_id) {
        const zernio = campaign.client;
        const type = row.campaign_type;
        if (type === 'search' || type === 'display') {
          const headlines = spec.headlines.map((text, index) => ({ text, ...(type === 'search' && spec.headlinePins?.[index] && { pinnedField: `HEADLINE_${spec.headlinePins[index]}` }) }));
          const descriptions = spec.descriptions.map((text, index) => ({
            text,
            ...(type === 'search' && spec.descriptionPins?.[index] && { pinnedField: `DESCRIPTION_${spec.descriptionPins[index]}` }),
          }));
          const body: Record<string, unknown> = { headlines, descriptions, finalUrls: [spec.linkUrl] };
          if (type === 'display') {
            const creative: Record<string, unknown> = { businessName: spec.businessName, ...(spec.longHeadlines?.[0] && { longHeadline: spec.longHeadlines[0] }) };
            if (request.images) {
              const images = await resolveAdImages(files, row.brand_id, await brandLogo(db, row.brand_id), { landscape: request.images.landscape.slice(0, 1), square: request.images.square.slice(0, 1) }, zernio.upload);
              creative['imageUrl'] = images.landscape[0];
              creative['squareImageUrl'] = images.square[0];
            }
            body['creative'] = creative;
          }
          await zernio.updateAd(row.zernio_ad_id, body);
        } else {
          const images = request.images ? await resolveAdImages(files, row.brand_id, await brandLogo(db, row.brand_id), request.images, zernio.upload) : null;
          if (type === 'pmax') {
            await zernio.updateAd(row.zernio_ad_id, {
              assetGroup: {
                businessName: spec.businessName,
                finalUrl: spec.linkUrl,
                longHeadline: spec.longHeadlines?.[0],
                headlines: spec.headlines,
                descriptions: spec.descriptions,
                ...(images && { images: { landscape: images.landscape, square: images.square, logo: images.logo } }),
                ...(spec.youtubeVideoIds?.[0] && { youtubeVideoId: spec.youtubeVideoIds[0] }),
              },
            });
          } else {
            await zernio.updateAd(row.zernio_ad_id, {
              demandGen: {
                finalUrl: spec.linkUrl,
                businessName: spec.businessName,
                headlines: spec.headlines,
                descriptions: spec.descriptions,
                ...(spec.longHeadlines?.length && { longHeadlines: spec.longHeadlines }),
                ...(spec.callToAction && { callToAction: spec.callToAction }),
                ...(images && { images: { landscape: images.landscape, square: images.square, portrait: images.portrait, logo: images.logo.slice(0, 1) } }),
                ...(spec.youtubeVideoIds?.length && { youtubeVideoIds: spec.youtubeVideoIds }),
              },
            });
          }
        }
      }
      return patchAd(db, row.id, { spec });
    },

    async updateTargeting(db, row, request) {
      const campaign = await live(db, row);
      const spec: AdSpec = { ...row.spec, ...request };
      if (request.locations && request.locations.length === 0) throw ApiError.invalid('Scegli almeno un luogo.');
      if (!campaign.simulated) {
        const targeting: Record<string, unknown> = {};
        if (request.locations || request.excludedLocations) Object.assign(targeting, locationsTargeting(spec));
        if (request.languages) targeting['languages'] = request.languages;
        if (request.devices && row.campaign_type !== 'pmax') targeting['devices'] = devicesTargeting(request.devices) ?? ['MOBILE', 'DESKTOP', 'TABLET', 'CONNECTED_TV'];
        if (request.presenceOnly !== undefined) targeting['locationTargetingType'] = request.presenceOnly ? 'presence' : 'presence_or_interest';
        if (Object.keys(targeting).length) await campaign.client.setCampaignTargeting(campaign.ref, campaign.campaignId, targeting);
        if (request.radius && row.zernio_ad_id && (row.campaign_type === 'search' || row.campaign_type === 'display')) {
          await campaign.client.updateAd(row.zernio_ad_id, {
            targeting: {
              customLocations: request.radius.map((r) => ({ latitude: r.latitude, longitude: r.longitude, radius: r.radius, distanceUnit: r.unit === 'mi' ? 'mile' : 'kilometer' })),
            },
          });
        }
      }
      return patchAd(db, row.id, { spec });
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

// Ogni ora tutte le campagne vive: stato, metriche, partenza programmata e fine. Le simulate vanno anche senza Zernio.
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
