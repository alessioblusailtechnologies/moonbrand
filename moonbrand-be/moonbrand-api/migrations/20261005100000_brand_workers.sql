-- Ogni brand lavora su un solo worker: la cartella del brand e le sessioni di Claude Code stanno sul disco di quella
-- macchina, e due job dello stesso brand non scrivono mai insieme da due macchine diverse. Il brand va al primo worker
-- libero che prende un suo job, cioè al meno carico; i job senza brand li prende chiunque.
-- Niente chiave verso brands: il brand nasce nella bozza dell'onboarding e sul DB arriva solo alla fine, ma i job
-- dell'onboarding hanno già la sua cartella.
-- Spostare un brand (per esempio da un worker spento): update presenza.brand_workers set worker_id = '<nuovo>'
-- where brand_id = '<brand>', dopo aver portato la cartella e le sessioni sulla nuova macchina.

create table presenza.brand_workers (
  brand_id text primary key,
  worker_id text not null,
  assigned_at timestamptz not null default now()
);

create index brand_workers_worker on presenza.brand_workers (worker_id);

alter table presenza.brand_workers enable row level security;
