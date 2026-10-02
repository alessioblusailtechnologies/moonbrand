-- La lingua dell'account: l'interfaccia e tutto quello che il motore dice a chi usa moonbrand (chat, passaggi, saluti).
-- La lingua dei contenuti invece è del brand, in identity->>'language'.
alter table presenza.accounts add column locale text not null default 'it' check (locale in ('it', 'en', 'fr'));

grant update (locale) on presenza.accounts to presenza_user;
