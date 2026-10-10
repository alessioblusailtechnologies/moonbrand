-- Le istruzioni personalizzate del brand: testo libero di chi lo cura, che entra in ogni lavoro dell'AI. Prendono il
-- posto della voce (le schede erano un'analisi finta): la colonna voice resta finché non la si toglie, vuota per i brand
-- nuovi.
alter table presenza.brands add column instructions text not null default '';
alter table presenza.brands alter column voice set default '{"cards": []}'::jsonb;
