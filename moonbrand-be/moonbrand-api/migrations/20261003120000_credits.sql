-- I crediti: ogni interazione costa quanto è costata davvero, 1 credito per centesimo di dollaro. Il registro tiene un
-- movimento per ogni costo: la parte di Claude di un job quando il worker la scrive in ai_jobs.cost_usd, e ogni
-- generazione con un prezzo in ai_usage (immagini, clip, musica, voce, export, dettatura). Lo scrivono i trigger, così
-- nessun costo resta fuori, da qualunque processo arrivi. Il saldo è la somma dei movimenti; gli accrediti (piani,
-- ricariche) arriveranno con i pagamenti. Per ora si conta e si mostra soltanto: il saldo può andare sotto zero.

create table presenza.credit_movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references presenza.accounts (id) on delete cascade,
  -- In crediti, con i decimali: un controllo di Gemini vale una frazione di credito.
  amount numeric not null,
  kind text not null check (kind in ('claude', 'generation', 'plan', 'topup', 'adjustment')),
  job_id uuid references presenza.ai_jobs (id) on delete set null,
  usage_id bigint unique,
  created_at timestamptz not null default now()
);

create index credit_movements_account on presenza.credit_movements (account_id, created_at);
create index credit_movements_job on presenza.credit_movements (job_id);

alter table presenza.credit_movements enable row level security;

-- Chi usa moonbrand li legge soltanto.
create policy credit_movements_own on presenza.credit_movements
  for select to presenza_user
  using (account_id = presenza.current_account_id());

grant select on presenza.credit_movements to presenza_user;

-- 1 credito = 1 centesimo di dollaro di costo.
create function presenza.credits_for(usd numeric) returns numeric
  language sql immutable as $$ select round(usd * 100, 4) $$;

-- La parte di Claude: il worker la scrive una volta, a fine job; se la riscrive, il movimento è la differenza.
create function presenza.charge_job_cost() returns trigger
  language plpgsql as $$
begin
  if new.cost_usd is distinct from old.cost_usd and coalesce(new.cost_usd, 0) <> coalesce(old.cost_usd, 0) then
    insert into presenza.credit_movements (account_id, amount, kind, job_id)
    values (new.account_id, -presenza.credits_for(coalesce(new.cost_usd, 0) - coalesce(old.cost_usd, 0)), 'claude', new.id);
  end if;
  return new;
end;
$$;

create trigger ai_jobs_charge after update of cost_usd on presenza.ai_jobs
  for each row execute function presenza.charge_job_cost();

-- Una generazione con un prezzo; quelle senza account (prove a mano) restano fuori.
create function presenza.charge_usage() returns trigger
  language plpgsql as $$
begin
  if new.cost_usd > 0 and new.account_id is not null then
    insert into presenza.credit_movements (account_id, amount, kind, job_id, usage_id)
    values (new.account_id, -presenza.credits_for(new.cost_usd), 'generation', new.job_id, new.id);
  end if;
  return new;
end;
$$;

create trigger ai_usage_charge after insert on presenza.ai_usage
  for each row execute function presenza.charge_usage();
