-- Obiettivi, pubblici e fonti del catalogo si salvano con l'id e si leggono nella lingua dell'interfaccia
-- (moonbrand-shared domain/catalog). Qui le voci già salvate con il testo italiano diventano id; quelle scritte da chi
-- usa l'app o lette dal sito restano testo. Le fonti tengono anche l'etichetta e prendono l'id accanto.

create temporary table catalog_labels (label text primary key, id text not null) on commit drop;

insert into catalog_labels (label, id) values
  ('Far conoscere il brand', 'goals.awareness'),
  ('Vendere di più', 'goals.sellMore'),
  ('Fidelizzare i clienti', 'goals.loyalty'),
  ('Lanciare un prodotto', 'goals.launch'),
  ('Attirare candidati', 'goals.hiring'),
  ('Costruire una community', 'goals.community'),
  ('Autorevolezza nel settore', 'goals.authority'),
  ('Trovare clienti', 'goals.clients'),
  ('Raccogliere investimenti', 'goals.funding'),
  ('Clienti privati', 'audiences.consumers'),
  ('Aziende', 'audiences.businesses'),
  ('Rivenditori', 'audiences.resellers'),
  ('Candidati', 'audiences.candidates'),
  ('Community locale', 'audiences.local'),
  ('Founder di PMI', 'audiences.founders'),
  ('Direttori operativi', 'audiences.operations'),
  ('Sviluppatori', 'audiences.developers'),
  ('Investitori', 'audiences.investors');

create temporary table source_labels (label text primary key, id text not null) on commit drop;

insert into source_labels (label, id) values
  ('Testate di settore', 'tradePress'),
  ('Recensioni dei clienti', 'reviews'),
  ('Trend su Instagram e TikTok', 'socialTrends'),
  ('Fiere ed eventi', 'events'),
  ('Ricorrenze e stagionalità', 'seasons'),
  ('Stampa economica', 'businessPress'),
  ('La tua rete LinkedIn', 'linkedinNetwork'),
  ('Eventi di settore', 'industryEvents'),
  ('Discussioni su X', 'xDiscussions'),
  ('Le tue milestone', 'milestones'),
  ('Le milestone dell’azienda', 'milestones'),
  ('Le milestone del cliente', 'milestones');

update presenza.brands
set positioning = positioning
  || jsonb_build_object(
    'goals',
    (select coalesce(jsonb_agg(coalesce(l.id, g.value) order by g.ord), '[]'::jsonb)
     from jsonb_array_elements_text(positioning->'goals') with ordinality g(value, ord)
     left join catalog_labels l on l.label = g.value and l.id like 'goals.%'),
    'audiences',
    (select coalesce(jsonb_agg(coalesce(l.id, a.value) order by a.ord), '[]'::jsonb)
     from jsonb_array_elements_text(positioning->'audiences') with ordinality a(value, ord)
     left join catalog_labels l on l.label = a.value and l.id like 'audiences.%')
  )
where jsonb_typeof(positioning->'goals') = 'array' and jsonb_typeof(positioning->'audiences') = 'array';

update presenza.brands
set refs = refs
  || jsonb_build_object(
    'sources',
    (select coalesce(jsonb_agg(case when l.id is null then s.value else s.value || jsonb_build_object('id', l.id) end order by s.ord), '[]'::jsonb)
     from jsonb_array_elements(refs->'sources') with ordinality s(value, ord)
     left join source_labels l on l.label = s.value->>'label')
  )
where jsonb_typeof(refs->'sources') = 'array';
