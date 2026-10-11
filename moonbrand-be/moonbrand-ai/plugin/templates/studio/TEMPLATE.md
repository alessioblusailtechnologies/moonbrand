# Studio

**Carattere**: editoriale da agenzia di strategia. Slide piene (fondo `--principale`, testi `--sfondo`) alternate a slide chiare (il contrario), titolo grottesco enorme e stretto, foto di architettura dal basso o ritratti in bianco e nero con angoli tondi. Per agenzie e consulenti.

**Tipografia**: titoli, numeri e citazione in `var(--font-titoli)`; testi, hashtag, account, pillole, ovale e nome in `var(--font-testo)`. Titoli 700, 110-150 px, interlinea 1-1,06, spaziatura -0,055em; numeri 370-450 px. Testi 400, 32-44 px. Hashtag e account 700 a 25 px, pillole 600 a 24 px. Mai maiuscolo.

**Griglia**: margine 74 px. In alto hashtag e account, in basso pillole a sinistra e account a destra. Titolo a sinistra, al centro in citazione, servizi e dato.

**Origine**: `moonbrand-examples/agenzia-marketing/06/` (Etsy, https://www.etsy.com/listing/4447663001).

**Grafica ricorrente**: pillole in filetto, cerchio con la freccia ↘, riquadri inclinati dietro due parole della copertina, ovale «Lo sapevi?», asterisco a otto bracci, numero 01-03 enorme in alto a destra, foto con raggio 32-38 px. Si tengono così.

**Colori**: slide piene (copertina, punto, passo, dato): `--accento` per riquadri del titolo, hashtag, freccia e numeri grandi; `--secondario` per il fondo di pillole e ovale. Slide chiare (frase, servizi, citazione, persona): `--secondario` per asterisco, virgolette, filetto dei servizi, hashtag e ombra della foto; `--accento` per il fondo di pillole, etichette e cartellino del nome. L'account è `.logo`.

**Layout**
- `copertina`: apre il carosello. 5-6 righe brevi (max 10 lettere), prima e quinta nel riquadro; foto verticale a destra.
- `punto`: titolo di 3-5 parole su due righe, frase di 8-14 parole, foto orizzontale sotto.
- `passo`: numero 01-03, titolo di 4-7 parole con la freccia, 12-20 parole di testo.
- `dato`: un numero vero (max 4 caratteri) sotto l'ovale, 12-20 parole che lo spiegano.
- `frase`: una convinzione in due frasi brevi (4-6 parole) sotto l'asterisco.
- `servizi`: titolo di 2-3 parole e 5-8 servizi in pillole grandi.
- `citazione`: 10-14 parole centrate, virgolette sopra, autore in corsivo.
- `persona`: nome della rubrica su sei righe, ritratto in bianco e nero inclinato, cartellino col nome.

**Da non fare**: foto a colori saturi o stock sorridente; titoli in maiuscolo o più lunghi del layout; accento per testi lunghi; colori o font scritti al posto delle variabili; icone, sfumature o segni che l'originale non ha.
