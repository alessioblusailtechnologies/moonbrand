-- Perché un post non è uscito, e le riprove.
-- reason: il motivo in breve, che lo studio racconta nella lingua di chi legge (blocked: il social ha bloccato la
-- richiesta per un po', come fa quando si pubblica troppo spesso; rejected: non ha accettato il post; unconfirmed: non
-- ha confermato l'uscita; incomplete: manca qualcosa al contenuto o al canale, e error dice cosa). detail: le parole
-- del social, per i log: all'utente non arrivano. Le righe di prima restano con il testo in error.
-- retry_at: quando il pubblicatore riprova da solo (dopo un blocco temporaneo: mezz'ora, poi un'ora, poi due; o
-- l'ora nuova di un'uscita spostata); attempts: quante volte ha provato.
alter table presenza.publications
  add column reason text check (reason in ('blocked', 'rejected', 'unconfirmed', 'incomplete')),
  add column detail text,
  add column retry_at timestamptz,
  add column attempts integer not null default 1;

create index publications_retry on presenza.publications (retry_at) where status = 'failed' and retry_at is not null;

-- Spostare un'uscita non riuscita vuol dire riprovare all'ora nuova dove non era uscita: chi usa moonbrand può dare
-- l'ora della riprova alle sue pubblicazioni non riuscite. Il resto lo scrive solo il pubblicatore delle API.
create policy publications_retry on presenza.publications
  for update to presenza_user
  using (account_id = presenza.current_account_id() and status = 'failed')
  with check (account_id = presenza.current_account_id() and status = 'failed');

grant update (retry_at) on presenza.publications to presenza_user;
