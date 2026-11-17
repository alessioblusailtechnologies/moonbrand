-- Google per intero (PIANO-ADS.md §0): oltre alla rete di ricerca, Display, Performance Max e Demand Gen. Tutto quello
-- che cambia tra i tipi sta in spec (jsonb). Lo stato scheduled: creata su Google in pausa, parte da sola il giorno
-- d'inizio (le date di Google via Zernio non sono affidabili: inizio e fine li fa rispettare il nostro scheduler).
alter table presenza.ads drop constraint if exists ads_campaign_type_check;
alter table presenza.ads add constraint ads_campaign_type_check check (campaign_type in ('search', 'display', 'pmax', 'demand_gen'));

alter table presenza.ads drop constraint if exists ads_status_check;
alter table presenza.ads add constraint ads_status_check
  check (status in ('draft', 'scheduled', 'in_review', 'active', 'paused', 'ended', 'rejected', 'failed', 'deleted'));

alter table presenza.ads drop constraint if exists ads_goal_check;
alter table presenza.ads add constraint ads_goal_check check (goal in ('traffic', 'awareness', 'engagement'));

drop index if exists presenza.ads_live;
create index if not exists ads_live on presenza.ads (status) where status in ('scheduled', 'in_review', 'active', 'paused');
