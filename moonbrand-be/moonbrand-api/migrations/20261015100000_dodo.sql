-- I pagamenti con Dodo Payments, che è il venditore: incassa, applica le tasse ed emette le ricevute. Prende il posto di
-- Paddle (migration 20261013100000 e 20261013160000, mai arrivate in produzione: l'account è stato rifiutato).
-- Ogni brand ha il suo abbonamento (Start, Pro o Ultra); lo scrive solo il webhook di Dodo, per questo sta in una tabella
-- sua: i brand si possono modificare con l'identità dell'utente, l'abbonamento no. Gli eventi arrivati si tengono per non
-- contarli due volte (Dodo ripete un evento finché non risponde 2xx, fino a 8 volte) e per poterli rileggere.

alter table presenza.accounts add column dodo_customer_id text unique;

create table presenza.brand_subscriptions (
  brand_id uuid primary key references presenza.brands (id) on delete cascade,
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  dodo_subscription_id text not null unique,
  plan text not null check (plan in ('start', 'pro', 'ultra')),
  -- Gli stati di Dodo: pending (appena nato, pagamento in corso), active, past_due (rinnovo non pagato, periodo di
  -- grazia), on_hold (rinnovo non pagato, fermo finché il cliente non cambia carta), paused, cancelled, failed, expired.
  status text not null check (status in ('pending', 'active', 'past_due', 'on_hold', 'paused', 'cancelled', 'failed', 'expired')),
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

-- Gli eventi ricevuti, per webhook-id.
create table presenza.dodo_events (
  id text primary key,
  type text not null,
  occurred_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- Solo per l'API (presenza_app): nessuna policy, l'utente non la vede.
alter table presenza.dodo_events enable row level security;

-- Le pagine di pagamento aperte dallo studio: a quale brand e utenza servivano. Il webhook ritrova il brand dai metadata
-- del pagamento; se mancano, dalla sessione (checkout_session_id del pagamento).
create table presenza.dodo_checkouts (
  session_id text primary key,
  brand_id uuid not null references presenza.brands (id) on delete cascade,
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  kind text not null check (kind in ('plan', 'topup')),
  plan text check (plan in ('start', 'pro', 'ultra')),
  created_at timestamptz not null default now()
);

alter table presenza.dodo_checkouts enable row level security;

-- I crediti pagati: il piano di un periodo (kind plan, con il periodo) e le ricariche (kind topup), ciascuno legato al
-- pagamento di Dodo che l'ha pagato, una volta sola. Un rimborso (kind refund, con l'id del rimborso) o una contestazione
-- (kind dispute, con l'id della contestazione) tolgono i crediti di quel pagamento.
alter table presenza.credit_movements
  add column dodo_payment_id text,
  add column period_start timestamptz,
  add column period_end timestamptz;

alter table presenza.credit_movements drop constraint credit_movements_kind_check;
alter table presenza.credit_movements
  add constraint credit_movements_kind_check check (kind in ('claude', 'generation', 'plan', 'topup', 'refund', 'dispute'));

create unique index credit_movements_dodo on presenza.credit_movements (dodo_payment_id, kind)
  where dodo_payment_id is not null;

-- Un brand con l'abbonamento vivo su Dodo non si cancella: sparirebbe da noi (brand_subscriptions va in cascata) e Dodo
-- continuerebbe ad addebitarlo ogni mese. Prima si disdice (DodoApi.cancelNow, o dal portale), poi si cancella. Vale
-- anche per un'utenza, che cancella i suoi brand in cascata.

create function presenza.brand_delete_guard() returns trigger
  language plpgsql as $$
begin
  if exists (
    select 1 from presenza.brand_subscriptions s
    where s.brand_id = old.id and s.status in ('pending', 'active', 'past_due', 'on_hold', 'paused')
  ) then
    raise exception 'Il brand % ha un abbonamento attivo su Dodo Payments: disdicilo prima di cancellarlo.', old.id
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger brands_delete_guard before delete on presenza.brands
  for each row execute function presenza.brand_delete_guard();

-- L'utenza si controlla da sé: nelle cascate l'abbonamento potrebbe sparire prima che arrivi il controllo sul brand.
create function presenza.account_delete_guard() returns trigger
  language plpgsql as $$
begin
  if exists (
    select 1 from presenza.brand_subscriptions s
    where s.account_id = old.id and s.status in ('pending', 'active', 'past_due', 'on_hold', 'paused')
  ) then
    raise exception 'L''utenza % ha abbonamenti attivi su Dodo Payments: disdicili prima di cancellarla.', old.id
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger accounts_delete_guard before delete on presenza.accounts
  for each row execute function presenza.account_delete_guard();
