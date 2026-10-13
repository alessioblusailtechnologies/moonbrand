-- Un brand con l'abbonamento vivo su Paddle non si cancella: sparirebbe da noi (brand_subscriptions va in cascata) e
-- Paddle continuerebbe ad addebitarlo ogni mese. Prima si disdice (PaddleApi.cancelNow, o dal portale), poi si cancella.
-- Vale anche per un'utenza, che cancella i suoi brand in cascata.

create function presenza.brand_delete_guard() returns trigger
  language plpgsql as $$
begin
  if exists (
    select 1 from presenza.brand_subscriptions s
    where s.brand_id = old.id and s.status in ('active', 'trialing', 'past_due', 'paused')
  ) then
    raise exception 'Il brand % ha un abbonamento Paddle attivo: disdicilo prima di cancellarlo.', old.id
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
    where s.account_id = old.id and s.status in ('active', 'trialing', 'past_due', 'paused')
  ) then
    raise exception 'L''utenza % ha abbonamenti Paddle attivi: disdicili prima di cancellarla.', old.id
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

create trigger accounts_delete_guard before delete on presenza.accounts
  for each row execute function presenza.account_delete_guard();
