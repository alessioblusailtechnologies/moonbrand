-- I lavori che non scalano crediti: l'onboarding (lettura del sito, esempi grafici su un brand ancora in bozza; stile,
-- prime idee e progetto video alla creazione) e i saluti del mattino, che nessuno chiede. Lo decide l'API quando mette
-- il job in coda; i trigger dei crediti saltano sia la parte di Claude sia le generazioni fatte dentro quel job.

alter table presenza.ai_jobs add column free boolean not null default false;

create or replace function presenza.charge_job_cost() returns trigger
  language plpgsql as $$
begin
  if not new.free and new.cost_usd is distinct from old.cost_usd and coalesce(new.cost_usd, 0) <> coalesce(old.cost_usd, 0) then
    insert into presenza.credit_movements (account_id, amount, kind, job_id)
    values (new.account_id, -presenza.credits_for(coalesce(new.cost_usd, 0) - coalesce(old.cost_usd, 0)), 'claude', new.id);
  end if;
  return new;
end;
$$;

create or replace function presenza.charge_usage() returns trigger
  language plpgsql as $$
begin
  if new.cost_usd > 0 and new.account_id is not null
     and not exists (select 1 from presenza.ai_jobs j where j.id = new.job_id and j.free) then
    insert into presenza.credit_movements (account_id, amount, kind, job_id, usage_id)
    values (new.account_id, -presenza.credits_for(new.cost_usd), 'generation', new.job_id, new.id);
  end if;
  return new;
end;
$$;
