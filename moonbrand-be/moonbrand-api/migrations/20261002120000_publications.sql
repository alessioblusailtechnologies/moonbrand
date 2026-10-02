-- La pubblicazione vera, con Zernio: all'ora dell'uscita il contenuto approvato esce su ogni canale collegato.
-- Una riga per contenuto e canale: publishing mentre Zernio pubblica, poi published (con il link al post) o failed
-- (con il motivo). L'uscita risulta pubblicata solo quando lo è su tutti i suoi canali.

create table presenza.publications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  content_id uuid not null references presenza.contents (id) on delete cascade,
  slot_id uuid references presenza.slots (id) on delete set null,
  channel text not null check (channel in ('linkedin', 'instagram', 'facebook', 'tiktok', 'x')),
  status text not null check (status in ('publishing', 'published', 'failed')),
  zernio_post_id text,
  post_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (content_id, channel)
);

create index publications_publishing on presenza.publications (updated_at) where status = 'publishing';
create index publications_slot on presenza.publications (slot_id);

alter table presenza.publications enable row level security;

-- Chi usa moonbrand le legge soltanto: le scrive il pubblicatore delle API.
create policy publications_own on presenza.publications
  for select to presenza_user
  using (account_id = presenza.current_account_id());

grant select on presenza.publications to presenza_user;
