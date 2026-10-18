-- Il motore AI che ha fatto ogni job: v1 (moonbrand-ai) o v2 (moonbrand-ai-v2), da AI_ENGINE dell'API. I job di prima
-- sono tutti della v1. Serve alla chat: dopo il passaggio al v2 una conversazione della v1 riparte da una sessione nuova,
-- invece di riprendere quella della v1.

alter table presenza.ai_jobs add column engine text not null default 'v1' check (engine in ('v1', 'v2'));
