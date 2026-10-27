-- L'ultimo annuncio delle novità che l'account ha chiuso (LATEST_NEWS in shared/api/contract.ts): la modale dello studio
-- lo mostra una volta sola, su qualunque dispositivo. Gli account nuovi nascono con l'annuncio del momento già visto.

alter table presenza.accounts add column news_seen text;

grant update (news_seen) on presenza.accounts to presenza_user;
