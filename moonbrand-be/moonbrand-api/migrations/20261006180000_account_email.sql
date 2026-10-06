-- La conferma dell'email: si entra subito dopo la registrazione, il link dell'email di benvenuto mette la data.
-- email_sent_at: l'ultima email di conferma partita, per non mandarne una raffica con "Rimanda".
alter table presenza.accounts add column email_confirmed_at timestamptz;
alter table presenza.accounts add column email_sent_at timestamptz;
