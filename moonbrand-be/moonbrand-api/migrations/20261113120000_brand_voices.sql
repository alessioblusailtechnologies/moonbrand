-- Le voci del brand per la voce fuori campo (ElevenLabs), al massimo BRAND_VOICES_MAX (shared/domain/voice.ts).
-- clone: clonata da un audio dell'utente (sample_path, nella cartella del brand), occupa uno spazio voce del nostro
-- account ElevenLabs e va cancellata anche lì; library: una voce della libreria pubblica, usata per id senza
-- aggiungerla all'account (preview_url è il suo ascolto). Una sola predefinita per brand: la chat usa quella quando
-- non le si chiede altro. consent_at: quando l'utente ha detto di avere il diritto di usare la voce clonata.
create table if not exists presenza.brand_voices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  kind text not null check (kind in ('clone', 'library')),
  name text not null,
  elevenlabs_voice_id text not null,
  sample_path text,
  preview_url text,
  language text,
  description text,
  is_default boolean not null default false,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, elevenlabs_voice_id)
);

create index if not exists brand_voices_brand on presenza.brand_voices (brand_id, created_at);
create unique index if not exists brand_voices_default on presenza.brand_voices (brand_id) where is_default;

alter table presenza.brand_voices enable row level security;

drop policy if exists brand_voices_own on presenza.brand_voices;
create policy brand_voices_own on presenza.brand_voices
  for all to presenza_user
  using (account_id = presenza.current_account_id())
  with check (account_id = presenza.current_account_id());

grant select, insert, update, delete on presenza.brand_voices to presenza_user;
