-- La bozza dell'onboarding sul server, una per account: la stessa in ogni scheda e dispositivo. Prima stava nel browser,
-- e una bozza lasciata a metà in un'altra scheda sopravviveva al brand creato altrove.
-- revision cresce a ogni salvataggio: chi salva dice da quale revisione parte, e se nel frattempo un'altra scheda ha
-- salvato (o il brand è nato) il salvataggio non passa e la scheda rilegge.
create table presenza.onboarding_drafts (
  account_id uuid primary key references presenza.accounts (id) on delete cascade,
  state jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table presenza.onboarding_drafts enable row level security;

create policy onboarding_drafts_own on presenza.onboarding_drafts
  for all to presenza_user
  using (account_id = presenza.current_account_id())
  with check (account_id = presenza.current_account_id());

grant select, insert, update, delete on presenza.onboarding_drafts to presenza_user;
