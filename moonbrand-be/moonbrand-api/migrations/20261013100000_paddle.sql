-- I pagamenti con Paddle, che è il venditore: incassa, applica le tasse ed emette le fatture. Ogni brand ha il suo
-- abbonamento (Start, Pro o Ultra); lo scrive solo il webhook di Paddle, per questo sta in una tabella sua: i brand si
-- possono modificare con l'identità dell'utente, l'abbonamento no. Gli eventi arrivati si tengono per non contarli due
-- volte (Paddle ripete un evento finché non risponde 2xx) e per poterli rileggere.

alter table presenza.accounts add column paddle_customer_id text unique;

create table presenza.brand_subscriptions (
  brand_id uuid primary key references presenza.brands (id) on delete cascade,
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  paddle_subscription_id text not null unique,
  plan text not null check (plan in ('start', 'pro', 'ultra')),
  -- Gli stati di Paddle: active, trialing, past_due (pagamento non riuscito, Paddle riprova), paused, canceled.
  status text not null,
  period_start timestamptz,
  period_end timestamptz,
  -- La disdetta a fine periodo: l'abbonamento resta attivo fino a period_end.
  cancels_at timestamptz,
  -- L'ultimo evento applicato: gli eventi possono arrivare fuori ordine, uno più vecchio non sovrascrive.
  event_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table presenza.brand_subscriptions enable row level security;

create policy brand_subscriptions_own on presenza.brand_subscriptions
  for select to presenza_user
  using (account_id = presenza.current_account_id());

grant select on presenza.brand_subscriptions to presenza_user;

create table presenza.paddle_events (
  id text primary key,
  type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- Solo per l'API (presenza_app): nessuna policy, l'utente non la vede.
alter table presenza.paddle_events enable row level security;

-- I crediti pagati: il piano di un periodo (kind plan, con il periodo) e le ricariche (kind topup), ciascuno legato
-- alla transazione di Paddle che l'ha pagato, una volta sola.
alter table presenza.credit_movements
  add column paddle_transaction_id text,
  add column period_start timestamptz,
  add column period_end timestamptz;

create unique index credit_movements_paddle on presenza.credit_movements (paddle_transaction_id, kind)
  where paddle_transaction_id is not null;
