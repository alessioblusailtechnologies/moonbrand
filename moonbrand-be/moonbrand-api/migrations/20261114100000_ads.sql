-- La pubblicità dei brand, via Zernio Ads (PIANO-ADS.md §0). Si parte da Google Search; OpenAI e Meta usano le stesse
-- tabelle con un altro platform.
--
-- ad_connections: il collegamento pubblicitario di un brand su una piattaforma. zernio_account_id è l'account Zernio
-- (googleads) nel profilo del brand; ad_account_id l'account pubblicitario scelto (per Google il customer id), dove
-- vanno le campagne e paga il cliente. lost: la piattaforma ha chiuso l'accesso, va ricollegato.
create table if not exists presenza.ad_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  platform text not null check (platform in ('google')),
  zernio_account_id text not null,
  name text,
  ad_account_id text,
  ad_account_name text,
  currency text,
  lost boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, platform)
);

-- ads: bozze e campagne. Una riga = una campagna con un annuncio. spec: la creatività e il pubblico come li abbiamo
-- mandati (Search: headlines, descriptions, keywords, linkUrl, countries, languages). La spesa non passa da noi: la
-- addebita la piattaforma sull'account pubblicitario del cliente. ends_on la facciamo rispettare noi (lo scheduler
-- mette in pausa la campagna), perché le date di Google via Zernio non sono documentate.
-- status nostro: draft, in_review, active, paused, ended, rejected, failed, deleted.
create table if not exists presenza.ads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  platform text not null check (platform in ('google')),
  campaign_type text not null check (campaign_type in ('search')),
  source text not null default 'studio' check (source in ('studio', 'chat')),
  name text not null,
  goal text not null default 'traffic',
  spec jsonb not null,
  daily_budget numeric not null check (daily_budget > 0),
  currency text,
  starts_on date not null,
  ends_on date,
  status text not null default 'draft'
    check (status in ('draft', 'in_review', 'active', 'paused', 'ended', 'rejected', 'failed', 'deleted')),
  ad_account_id text,
  zernio_ad_id text unique,
  platform_campaign_id text,
  platform_ad_group_id text,
  platform_ad_id text,
  review_status text,
  rejection_reason text,
  metrics jsonb,
  synced_at timestamptz,
  launched_at timestamptz,
  error text,
  detail jsonb,
  idempotency_key uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_brand on presenza.ads (brand_id, created_at desc);
create index if not exists ads_live on presenza.ads (status) where status in ('in_review', 'active', 'paused');

-- Le scrive solo l'API (con l'identità della persona), dopo i controlli con Zernio: lo studio non ha accesso diretto.
alter table presenza.ad_connections enable row level security;
drop policy if exists ad_connections_own on presenza.ad_connections;
create policy ad_connections_own on presenza.ad_connections
  for all to presenza_user
  using (account_id = presenza.current_account_id())
  with check (account_id = presenza.current_account_id());
grant select, insert, update, delete on presenza.ad_connections to presenza_user;

alter table presenza.ads enable row level security;
drop policy if exists ads_own on presenza.ads;
create policy ads_own on presenza.ads
  for all to presenza_user
  using (account_id = presenza.current_account_id())
  with check (account_id = presenza.current_account_id());
grant select, insert, update, delete on presenza.ads to presenza_user;
