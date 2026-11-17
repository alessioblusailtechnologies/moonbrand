import { randomUUID } from 'node:crypto';

import type { AdAudience, AdConversionAction, AdInvitation, AdKeyword, AdKeywordRow } from '@moonbrand/shared/domain/ads';
import { SIMULATED_ACCOUNT } from '@moonbrand/shared/domain/brand';

import type { ZernioAds } from './zernio-ads';

// Google Ads per finta, per il collaudo e la prova gratuita: le stesse chiamate del client vero, con risposte credibili e
// lo stato in memoria (si perde al riavvio dell'API, va bene così). Le campagne restano solo da noi.

const PLACES = [
  { id: 'IT', name: 'Italia', type: 'country', path: [] },
  { id: 'SM', name: 'San Marino', type: 'country', path: [] },
  { id: 'CH', name: 'Svizzera', type: 'country', path: [] },
  { id: 'FR', name: 'Francia', type: 'country', path: [] },
  { id: 'DE', name: 'Germania', type: 'country', path: [] },
  { id: 'ES', name: 'Spagna', type: 'country', path: [] },
  { id: 'GB', name: 'Regno Unito', type: 'country', path: [] },
  { id: 'US', name: 'Stati Uniti', type: 'country', path: [] },
  { id: '20584', name: 'Lombardia', type: 'region', path: ['Italia'] },
  { id: '20589', name: 'Lazio', type: 'region', path: ['Italia'] },
  { id: '20586', name: 'Puglia', type: 'region', path: ['Italia'] },
  { id: '20593', name: 'Sicilia', type: 'region', path: ['Italia'] },
  { id: '1008463', name: 'Milano', type: 'city', path: ['Lombardia', 'Italia'] },
  { id: '1008736', name: 'Roma', type: 'city', path: ['Lazio', 'Italia'] },
  { id: '1008346', name: 'Napoli', type: 'city', path: ['Campania', 'Italia'] },
  { id: '1008311', name: 'Torino', type: 'city', path: ['Piemonte', 'Italia'] },
  { id: '1008621', name: 'Taranto', type: 'city', path: ['Puglia', 'Italia'] },
  { id: '1008210', name: 'Bari', type: 'city', path: ['Puglia', 'Italia'] },
  { id: '1008295', name: 'Messina', type: 'city', path: ['Sicilia', 'Italia'] },
  { id: '1008287', name: 'Palermo', type: 'city', path: ['Sicilia', 'Italia'] },
  { id: '1008230', name: 'Bologna', type: 'city', path: ['Emilia-Romagna', 'Italia'] },
  { id: '1008256', name: 'Firenze', type: 'city', path: ['Toscana', 'Italia'] },
];

const INTERESTS = [
  'Amanti della cucina',
  'Appassionati di sport',
  'Viaggiatori frequenti',
  'Appassionati di moda',
  'Salute e benessere',
  'Genitori',
  'Proprietari di casa',
  'Piccole imprese',
  'In cerca di un ristorante',
  'In cerca di servizi di bellezza',
  'In cerca di software per aziende',
  'In cerca di un immobile',
].map((name, index) => ({ id: `${80000 + index}`, name, type: 'interest', path: [] }));

const LANGUAGES = [
  { id: 'it', name: 'Italiano' },
  { id: 'en', name: 'Inglese' },
  { id: 'fr', name: 'Francese' },
  { id: 'de', name: 'Tedesco' },
  { id: 'es', name: 'Spagnolo' },
  { id: 'pt', name: 'Portoghese' },
  { id: 'nl', name: 'Olandese' },
].map((item) => ({ ...item, type: 'language', path: [] }));

// Un numero stabile per una parola: le metriche finte non saltano a ogni lettura.
const seed = (text: string) => [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 100_000, 7);
const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);

export function simulatedAds(): ZernioAds {
  const keywords = new Map<string, AdKeywordRow[]>();
  const negatives = new Map<string, AdKeyword[]>();
  const extensions = new Map<string, { sitelinks: { text: string; linkUrl: string; description1?: string; description2?: string; resource: string }[]; callouts: { text: string; resource: string }[]; snippets: { header: never; values: string[]; resource: string }[] }>();
  const audiences: AdAudience[] = [];
  const actions: AdConversionAction[] = [{ id: 'customers/1234567890/conversionActions/1', name: 'Contatto dal sito', type: 'SUBMIT_LEAD_FORM', status: 'active' }];
  const goals = [{ category: 'SUBMIT_LEAD_FORM', origin: 'WEBSITE', biddable: true, actions: [{ name: 'Contatto dal sito', primary: true }] }];
  const invitations: AdInvitation[] = [];
  let recommendations = [
    { resource: 'customers/1234567890/recommendations/1', type: 'SITELINK_ASSET', campaignId: null, impact: null, details: null },
    { resource: 'customers/1234567890/recommendations/2', type: 'CAMPAIGN_BUDGET', campaignId: null, impact: { potentialClicks: 120 }, details: null },
  ];
  const row = (text: string, match: AdKeyword['match'], negative: boolean): AdKeywordRow => {
    const n = seed(text);
    return {
      id: `${SIMULATED_ACCOUNT}${randomUUID()}`,
      text,
      match,
      status: 'active',
      negative,
      qualityScore: negative ? null : 4 + (n % 7),
      clicks: negative ? null : n % 90,
      impressions: negative ? null : 300 + (n % 2400),
      cost: negative ? null : Math.round((n % 90) * 0.38 * 100) / 100,
      conversions: negative ? null : n % 6,
      firstPageCpc: negative ? null : Math.round((0.2 + (n % 120) / 100) * 100) / 100,
    };
  };
  const find = (pool: { id: string; name: string; type: string; path: string[] }[], q: string) =>
    pool.filter((item) => item.name.toLowerCase().includes(q.toLowerCase().trim())).slice(0, 15);
  const done = async () => undefined;

  return {
    connectGoogle: async () => ({ accountId: `${SIMULATED_ACCOUNT}googleads`, name: 'Google Ads di prova' }),
    googleAccount: async (_brand, accountId) => ({ accountId, name: 'Google Ads di prova' }),
    adAccounts: async () => [{ id: '1234567890', name: 'Account di prova', currency: 'EUR', status: 'ENABLED', selected: true }],
    disconnect: done,
    upload: async (name) => `https://example.com/simulato/${encodeURIComponent(name)}`,
    create: async () => {
      const id = randomUUID().slice(0, 8);
      return { _id: `${SIMULATED_ACCOUNT}${id}`, status: 'pending_review', platformCampaignId: `sim-c-${id}`, platformAdSetId: `sim-g-${id}`, platformAdId: `sim-a-${id}` };
    },
    ad: async (adId) => ({ _id: adId }),
    setCampaignStatus: done,
    setAdSetStatus: done,
    updateAd: done,
    updateCampaign: done,
    setCampaignTargeting: done,
    assetGroups: async () => [{ id: 'sim-group', status: 'ENABLED', adStrength: 'GOOD' }],
    setAssetGroupStatus: done,
    linkAssetGroupAssets: done,
    deleteAd: done,
    deleteCampaign: done,

    async daily(_ref, campaignId, from, to) {
      const days = Math.max(1, Math.min(90, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1));
      const base = seed(campaignId);
      const daily = Array.from({ length: days }, (_, index) => {
        const impressions = 400 + ((base + index * 137) % 900);
        const clicks = Math.round(impressions * (0.03 + ((base + index) % 5) / 100));
        const spend = Math.round(clicks * 0.41 * 100) / 100;
        return { date: day(days - 1 - index), spend, impressions, clicks, ctr: (clicks / impressions) * 100, cpc: spend / clicks, conversions: clicks % 4, cpm: (spend / impressions) * 1000 };
      });
      return { daily, total: null };
    },
    impressionShare: async () => ({ share: 0.46, lostToBudget: 0.21, lostToRank: 0.33, top: 0.38, absoluteTop: 0.17 }),
    keywords: async (_ref, campaignId) => keywords.get(campaignId) ?? [],
    async addKeywords(_ref, adSetId, list, negative) {
      // In simulazione il gruppo di annunci si chiama come la campagna: sim-g-x ↔ sim-c-x.
      const campaignId = adSetId.replace('sim-g-', 'sim-c-');
      const current = keywords.get(campaignId) ?? [];
      const known = new Set(current.map((k) => `${k.text.toLowerCase()}|${k.match}|${k.negative}`));
      const added = list.filter((k) => !known.has(`${k.text.toLowerCase()}|${k.match}|${negative}`)).map((k) => row(k.text, k.match, negative));
      keywords.set(campaignId, [...current, ...added]);
    },
    async setKeywordStatus(keywordId, status) {
      for (const rows of keywords.values()) for (const item of rows) if (item.id === keywordId) item.status = status;
    },
    async deleteKeyword(keywordId) {
      for (const [campaignId, rows] of keywords) keywords.set(campaignId, rows.filter((item) => item.id !== keywordId));
    },
    campaignNegatives: async (_ref, campaignId) => negatives.get(campaignId) ?? [],
    async setCampaignNegatives(_ref, campaignId, list) {
      negatives.set(campaignId, list);
    },
    async searchTerms(_ref, campaignId) {
      const words = (keywords.get(campaignId) ?? []).filter((k) => !k.negative).map((k) => k.text);
      const terms = (words.length ? words : ['servizio vicino a me', 'prezzi']).flatMap((word) => [word, `${word} prezzi`, `${word} vicino a me`, `migliore ${word}`]);
      return terms.slice(0, 20).map((term) => {
        const n = seed(term);
        return { term, status: 'NONE', match: 'BROAD', impressions: 50 + (n % 600), clicks: n % 40, cost: Math.round((n % 40) * 0.4 * 100) / 100, conversions: n % 3 };
      });
    },
    extensions: async (_ref, campaignId) => extensions.get(campaignId) ?? { sitelinks: [], callouts: [], snippets: [] },
    async addExtensions(_ref, campaignId, add) {
      const current = extensions.get(campaignId) ?? { sitelinks: [], callouts: [], snippets: [] };
      const resource = () => `customers/1234567890/campaignAssets/${randomUUID()}`;
      current.sitelinks.push(...(add.sitelinks ?? []).map((item) => ({ ...item, resource: resource() })));
      current.callouts.push(...(add.callouts ?? []).map((text) => ({ text, resource: resource() })));
      current.snippets.push(...(add.snippets ?? []).map((item) => ({ ...item, header: item.header as never, resource: resource() })));
      extensions.set(campaignId, current);
    },
    async removeExtensions(_ref, campaignId, resources) {
      const current = extensions.get(campaignId);
      if (!current) return;
      const keep = <T extends { resource: string }>(items: T[]) => items.filter((item) => !resources.includes(item.resource));
      extensions.set(campaignId, { sitelinks: keep(current.sitelinks), callouts: keep(current.callouts), snippets: keep(current.snippets) });
    },
    async keywordIdeas(_ref, request) {
      const seeds = request.seedKeywords.length ? request.seedKeywords : [new URL(request.seedUrl ?? 'https://esempio.it').hostname.replace(/^www\./, '').split('.')[0] ?? 'servizio'];
      const ideas = seeds.flatMap((word) => [word, `${word} prezzi`, `${word} vicino a me`, `migliore ${word}`, `${word} offerte`, `${word} online`, `${word} recensioni`]);
      return [...new Set(ideas)].slice(0, 30).map((text) => {
        const n = seed(text);
        return {
          text,
          monthlySearches: [10, 50, 100, 500, 1000, 5000][n % 6]!,
          competition: (['LOW', 'MEDIUM', 'HIGH'] as const)[n % 3]!,
          lowBid: Math.round((0.15 + (n % 50) / 100) * 100) / 100,
          highBid: Math.round((0.8 + (n % 200) / 100) * 100) / 100,
        };
      });
    },
    async searchTargeting(_ref, q, dimension) {
      return find(dimension === 'geo' ? PLACES : dimension === 'language' ? LANGUAGES : INTERESTS, q);
    },
    recommendations: async () => recommendations,
    async applyRecommendations(_ref, resources) {
      recommendations = recommendations.filter((item) => !resources.includes(item.resource));
      return resources.map((resource) => ({ resource, status: 'applied' as const, error: null }));
    },
    async dismissRecommendations(_ref, resources) {
      recommendations = recommendations.filter((item) => !resources.includes(item.resource));
      return resources.map((resource) => ({ resource, status: 'dismissed' as const, error: null }));
    },
    audiences: async () => audiences,
    async createAudience(_ref, created) {
      const id = randomUUID();
      const item: AdAudience = { id, platformId: `${seed(id)}`, name: created.name, type: created.type, size: created.type === 'customer_list' ? 0 : null, status: 'OPEN' };
      audiences.push(item);
      return item;
    },
    async addAudienceUsers(audienceId, emails) {
      const valid = emails.filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
      const item = audiences.find((audience) => audience.id === audienceId);
      if (item) item.size = (item.size ?? 0) + valid.length;
      return { received: emails.length, invalid: emails.length - valid.length };
    },
    async deleteAudience(audienceId) {
      const index = audiences.findIndex((audience) => audience.id === audienceId);
      if (index >= 0) audiences.splice(index, 1);
    },
    conversionActions: async () => actions,
    async createConversionAction(_ref, action) {
      const item = { id: `customers/1234567890/conversionActions/${actions.length + 1}`, name: action.name, type: action.type, status: 'active' };
      actions.push(item);
      return item;
    },
    conversionGoals: async () => goals,
    async setConversionGoal(_ref, goal) {
      const item = goals.find((g) => g.category === goal.category && g.origin === goal.origin);
      if (item) item.biddable = goal.biddable;
    },
    billing: async () => ({ ready: true, detail: null }),
    invitations: async () => invitations,
    async invite(_ref, email, role) {
      const item = { id: randomUUID(), email, role, status: 'PENDING' };
      invitations.push(item);
      return item;
    },
    async cancelInvitation(_ref, invitationId) {
      const index = invitations.findIndex((item) => item.id === invitationId);
      if (index >= 0) invitations.splice(index, 1);
    },
  };
}
