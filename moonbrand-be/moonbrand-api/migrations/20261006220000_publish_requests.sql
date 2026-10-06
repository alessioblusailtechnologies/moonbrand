-- I contenuti che l'assistente propone di pubblicare in un turno della chat: sotto la risposta compare il pulsante,
-- e il contenuto esce solo quando l'utente lo preme.
alter table presenza.conversation_turns add column publish_requests uuid[] not null default '{}';
