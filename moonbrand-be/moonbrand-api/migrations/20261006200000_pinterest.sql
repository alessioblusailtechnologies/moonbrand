-- Pinterest tra i canali: le pubblicazioni lo accettano, e i brand di prima hanno anche la sua voce (non scelta,
-- non collegata), come quelli nuovi.
alter table presenza.publications drop constraint publications_channel_check;
alter table presenza.publications add constraint publications_channel_check
  check (channel in ('linkedin', 'instagram', 'facebook', 'tiktok', 'x', 'pinterest'));

update presenza.brands
   set channels = channels || '{"pinterest": {"selected": false, "handle": null}}'::jsonb
 where not channels ? 'pinterest';
