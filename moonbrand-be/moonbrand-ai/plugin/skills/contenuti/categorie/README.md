# Guide per categoria

Una cartella per categoria di attività, con l'id dell'elenco `BRAND_CATEGORIES` di moonbrand-shared, e dentro un file
per canale con l'id del canale: `bellezza/tiktok.md`, `bellezza/instagram.md`, `ristorazione/tiktok.md`…

Non sono skill: le carica il codice (`src/lib/category-guide.ts`), solo quelle della categoria del brand e dei canali che
il brand usa, e le mette nel `CLAUDE.md` del brand sotto «La guida della categoria», ognuna sotto `### <Canale>`. Valgono
per i job e per la chat. Un canale senza file non ha guida.

Come si scrive (decisione in `docs/2026-10-10-guide-canale-e-categoria.md`):

- titoli da `####` in giù: il file finisce sotto un `###` del `CLAUDE.md`;
- i formati che funzionano per la categoria su quel canale, a parole (struttura, inquadrature, durate, testo a schermo,
  chiusura), quale materiale vero chiedere, cosa evitare;
- niente composizioni Remotion pronte e niente regole che valgono per ogni attività: quelle stanno nella guida del
  canale (`canali/<canale>.md`) o nelle skill;
- corto: si rilegge a ogni turno di ogni job del brand.
