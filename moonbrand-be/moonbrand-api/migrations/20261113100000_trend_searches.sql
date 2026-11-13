-- Le tendenze diventano ricerche dell'utente: niente più giro automatico per categoria. Ogni video in
-- presenza.trend_videos è di un brand (brand_id), trovato da una sua ricerca per parola chiave (modules/trends/search.ts).
-- presenza.trend_searches tiene ogni chiamata a SocialCrawl con i crediti spesi; le due chiamate di una ricerca (TikTok e
-- Instagram) hanno lo stesso search_id: il costo di una ricerca è la loro somma.
-- Si può rilanciare: se ne era già stata lanciata una prima versione, la porta a questa.

alter table presenza.trend_videos add column if not exists brand_id uuid references presenza.brands (id) on delete cascade;

-- I video del vecchio giro automatico non erano di nessun brand: con le ricerche dell'utente non li vede più nessuno.
delete from presenza.trend_videos where brand_id is null;
alter table presenza.trend_videos alter column brand_id set not null;
alter table presenza.trend_videos alter column category set default '';

alter table presenza.trend_videos drop constraint if exists trend_videos_category_market_platform_external_id_key;
alter table presenza.trend_videos drop constraint if exists trend_videos_brand_video;
alter table presenza.trend_videos add constraint trend_videos_brand_video unique (brand_id, platform, external_id);

drop index if exists presenza.trend_videos_list;
drop index if exists presenza.trend_videos_brand;
create index trend_videos_brand on presenza.trend_videos (brand_id, collected_at desc);

-- Ognuno legge solo i video dei suoi brand (la policy di presenza.brands decide quali sono).
drop policy if exists trend_videos_read on presenza.trend_videos;
create policy trend_videos_read on presenza.trend_videos for select to presenza_user
  using (brand_id in (select id from presenza.brands));

create table if not exists presenza.trend_searches (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null,
  brand_id uuid references presenza.brands (id) on delete set null,
  category text not null default '',
  market text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  query text not null,
  results integer not null default 0,
  credits integer not null default 0,
  failed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Dalla prima versione di questa migration, che non lo aveva.
alter table presenza.trend_searches add column if not exists search_id uuid not null default gen_random_uuid();
alter table presenza.trend_searches alter column search_id drop default;
delete from presenza.trend_searches where brand_id is null;

create index if not exists trend_searches_brand on presenza.trend_searches (brand_id, created_at desc);
create index if not exists trend_searches_time on presenza.trend_searches (created_at desc);

-- Solo l'API (proprietario delle tabelle) ci scrive e la legge: nessun permesso a presenza_user.
alter table presenza.trend_searches enable row level security;

-- Le ricerche oltre quelle gratis del mese scalano crediti dal piano del brand (TREND_SEARCH in shared/domain/trend.ts):
-- un movimento 'trends' per ricerca, legato alla ricerca, che i Crediti dello studio mostrano come voce a sé.
alter table presenza.credit_movements drop constraint if exists credit_movements_kind_check;
alter table presenza.credit_movements
  add constraint credit_movements_kind_check check (kind in ('claude', 'generation', 'plan', 'topup', 'refund', 'dispute', 'trends'));
alter table presenza.credit_movements add column if not exists trend_search_id uuid unique;
