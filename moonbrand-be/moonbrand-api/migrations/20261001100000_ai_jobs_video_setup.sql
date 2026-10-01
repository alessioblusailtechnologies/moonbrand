-- Il progetto video del brand si prepara alla creazione del brand, non al primo messaggio in chat.
alter table presenza.ai_jobs drop constraint ai_jobs_kind_check;
alter table presenza.ai_jobs add constraint ai_jobs_kind_check check (kind in ('website', 'visual', 'visual-edit', 'ideas', 'content', 'content-edit', 'content-video', 'chat', 'style', 'welcome', 'video-setup'));
