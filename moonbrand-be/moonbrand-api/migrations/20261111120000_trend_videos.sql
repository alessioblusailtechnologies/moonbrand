-- I video di tendenza per categoria di brand e mercato (la lingua dei post), raccolti ogni giorno da SocialCrawl
-- (modules/trends). Sono di tutti: nessun brand li possiede, chi usa l'app li legge e basta. Solo link, numeri e copertina
-- (thumbnail_path, sul bucket dei media): il video non si tiene, si scarica quando qualcuno lo ricrea.
-- Lo stesso video trovato di nuovo aggiorna i numeri; quelli vecchi li toglie il giro stesso.
create table presenza.trend_videos (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  market text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  external_id text not null,
  url text not null,
  author text not null default '',
  caption text not null default '',
  thumbnail_path text,
  country text,
  duration_seconds real,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  music text,
  published_at timestamptz,
  -- La query che l'ha trovato e la pertinenza che SocialCrawl le dà (0-1): per capire quali query rendono.
  query text not null default '',
  relevance real,
  collected_at timestamptz not null default now(),
  unique (category, market, platform, external_id)
);

create index trend_videos_list on presenza.trend_videos (category, market, collected_at desc);

alter table presenza.trend_videos enable row level security;

create policy trend_videos_read on presenza.trend_videos for select to presenza_user using (true);

grant select on presenza.trend_videos to presenza_user;
