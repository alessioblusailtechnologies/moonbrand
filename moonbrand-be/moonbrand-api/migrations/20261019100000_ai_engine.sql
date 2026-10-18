-- Il motore AI per account: v1 (moonbrand-ai) o v2 (moonbrand-ai-v2), che girano insieme sullo stesso server. Ogni job
-- porta il motore dell'account che lo mette in coda e ogni worker prende solo i suoi. Gli account esistenti restano
-- sulla v1; quelli nuovi prendono AI_ENGINE dell'API. Il passaggio lo fa l'admin, e mette in coda per ogni brand il job
-- che sistema la cartella (la v1 va in v1/).

alter table presenza.accounts add column ai_engine text not null default 'v1' check (ai_engine in ('v1', 'v2'));

alter table presenza.ai_jobs add column engine text not null default 'v1' check (engine in ('v1', 'v2'));
