-- La proposta di pubblicazione della chat si segna sul turno (publish_requests): il ruolo dell'app sui turni poteva solo
-- leggere e inserire, e il tool pubblicazione_proponi non passava. Solo quella colonna.
grant update (publish_requests) on presenza.conversation_turns to presenza_user;
