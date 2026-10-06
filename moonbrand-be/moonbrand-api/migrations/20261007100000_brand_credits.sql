-- Piani e crediti per brand: Start, Pro e Ultra sono di un brand, e i crediti del mese sono quelli del suo piano meno i
-- suoi consumi. Finché non ci sono i pagamenti ogni brand è Pro. Ogni movimento porta il brand del lavoro o della
-- generazione che l'ha fatto; quelli senza brand (un brand ancora in bozza, una dettatura senza brand) restano
-- dell'account e non scalano nessun brand.

alter table presenza.brands add column plan text not null default 'pro' check (plan in ('start', 'pro', 'ultra'));

alter table presenza.credit_movements add column brand_id uuid references presenza.brands (id) on delete set null;
create index credit_movements_brand on presenza.credit_movements (brand_id, created_at);

-- Il brand di un lavoro: il brandId del suo input, se quel brand esiste (nell'onboarding è ancora una bozza).
-- Il confronto è sul testo: un brandId che non è un uuid non fa fallire niente.
create function presenza.job_brand(input jsonb) returns uuid
  language sql stable as $$
    select b.id from presenza.brands b where b.id::text = input->>'brandId'
  $$;

-- I movimenti di prima: dal brand della generazione, altrimenti da quello del lavoro.
update presenza.credit_movements m
   set brand_id = b.id
  from presenza.ai_usage u join presenza.brands b on b.id = u.brand_id
 where m.usage_id = u.id;

update presenza.credit_movements m
   set brand_id = presenza.job_brand(j.input)
  from presenza.ai_jobs j
 where m.brand_id is null and m.job_id = j.id;

create or replace function presenza.charge_job_cost() returns trigger
  language plpgsql as $$
begin
  if not new.free and new.cost_usd is distinct from old.cost_usd and coalesce(new.cost_usd, 0) <> coalesce(old.cost_usd, 0) then
    insert into presenza.credit_movements (account_id, brand_id, amount, kind, job_id)
    values (new.account_id, presenza.job_brand(new.input),
            -presenza.credits_for(coalesce(new.cost_usd, 0) - coalesce(old.cost_usd, 0)), 'claude', new.id);
  end if;
  return new;
end;
$$;

create or replace function presenza.charge_usage() returns trigger
  language plpgsql as $$
begin
  if new.cost_usd > 0 and new.account_id is not null
     and not exists (select 1 from presenza.ai_jobs j where j.id = new.job_id and j.free) then
    insert into presenza.credit_movements (account_id, brand_id, amount, kind, job_id, usage_id)
    values (new.account_id,
            coalesce((select b.id from presenza.brands b where b.id = new.brand_id),
                     (select presenza.job_brand(j.input) from presenza.ai_jobs j where j.id = new.job_id)),
            -presenza.credits_for(new.cost_usd), 'generation', new.job_id, new.id);
  end if;
  return new;
end;
$$;
