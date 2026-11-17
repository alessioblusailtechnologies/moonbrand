-- ad-step: nel wizard delle campagne la persona scrive cosa vuole e l'AI compila i campi di quel passaggio.
alter table presenza.ai_jobs drop constraint ai_jobs_kind_check;
alter table presenza.ai_jobs add constraint ai_jobs_kind_check check (kind in ('website', 'visual', 'visual-edit', 'ideas', 'content', 'content-edit', 'content-video', 'chat', 'style', 'welcome', 'video-setup', 'ad-step'));
