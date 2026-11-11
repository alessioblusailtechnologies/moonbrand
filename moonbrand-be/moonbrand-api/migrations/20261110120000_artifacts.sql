-- Gli artefatti della chat: i file che i tool producono in un turno (immagini, clip, musiche, voci, documenti, pagine
-- HTML). Li registra il worker quando il tool finisce, con una copia fissa nella cartella artefatti/ del brand; lo studio li
-- mostra nel pannello accanto alla conversazione. source è il percorso che il tool ha scritto: rifatto lo stesso file,
-- l'artefatto nuovo punta al precedente con parent_id. files: la copia, o le copie quando il tool fa più versioni insieme.
-- Lo scrive il worker con il suo ruolo; l'utente lo legge e lo cancella con la conversazione.
create table presenza.artifacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  conversation_id uuid not null references presenza.conversations (id) on delete cascade,
  job_id uuid not null references presenza.ai_jobs (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio', 'document', 'html')),
  title text not null,
  source text not null,
  files text[] not null,
  mime text not null,
  aspect text,
  parent_id uuid references presenza.artifacts (id) on delete set null,
  created_at timestamptz not null default now()
);

create index artifacts_conversation on presenza.artifacts (conversation_id, created_at);

alter table presenza.artifacts enable row level security;

create policy artifacts_own on presenza.artifacts
  for all to presenza_user
  using (account_id = presenza.current_account_id())
  with check (account_id = presenza.current_account_id());

grant select, delete on presenza.artifacts to presenza_user;
