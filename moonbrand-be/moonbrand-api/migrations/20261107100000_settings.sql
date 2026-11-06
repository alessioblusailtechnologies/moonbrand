-- Le impostazioni che l'admin cambia dallo studio senza riavviare niente: una riga per chiave, con il valore in JSON e chi
-- l'ha salvato. La prima chiave è models (sezione Modelli): quale modello e quanto ragionamento usano la chat e gli
-- strumenti del motore; il worker la legge a ogni lavoro. Nessun grant a presenza_user: la leggono e la scrivono l'API e il
-- worker con il loro ruolo.
create table presenza.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references presenza.accounts (id) on delete set null
);
