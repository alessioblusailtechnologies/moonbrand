# Cioccolato

**Carattere**: il carosello di una pasticceria su ordinazione, caldo e quieto: serif classico, slide che alternano fondo scuro, crema e beige, foto di torte in luce morbida tagliate ad arco, in cornice o a tutta larghezza. Colori e font sono del brand (demo: cioccolato, crema, beige, nocciola).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Libre Baskerville) peso 400, 62-92 px, minuscolo con iniziale maiuscola; solo la seconda riga della copertina in maiuscolo. Testi in `var(--font-testo)` (demo: Montserrat) 22-24 px; etichetta in alto e piede in maiuscolo 16-17 px, spaziati, al 60%.

**Griglia**: margini di 96 px a sinistra e a destra. Etichetta a 84 px dall'alto, titolo da 150 px, piede a 64 px dal fondo con il nome a sinistra e il numero della slide a destra. Copertina centrata, il resto a sinistra.

**Origine**: moonbrand-examples/bakery/19/, «Cake Artist Carousels» (www.etsy.com/listing/4591529844).

**Grafica ricorrente**:
- fondi alternati: `--principale` (testi chiari), `--sfondo`, `--secondario` schiarito;
- foto ad arco con un filetto `--accento` sottile a 12-14 px di distanza;
- cornice sottile `--accento` attorno alla foto della copertina, con la nota su un rettangolo `--sfondo` che la sovrappone;
- scheda `--sfondo` sopra la foto con un rettangolo `--accento` sfalsato dietro, senza ombra sfocata;
- numeri delle opzioni in `--accento`, filetti sottili tra le voci, barra piena `--principale` per l'invito;
- striscia verticale `--accento` tra foto e colonna scura in chiusura;
- foto in fascia a tutta larghezza.

**Layout**:
- copertina: fondo scuro, titolo di due righe, foto in cornice, nota di 3-6 parole.
- stile: un prodotto o stile, titolo di una parola, foto in fascia, frase e 10-18 parole.
- arco: fondo beige, frase di 4-6 parole, due paragrafi brevi, foto ad arco a destra.
- prenotazione: domanda su due righe, foto ad arco, due voci di 15-25 parole.
- listino: tabella di tre righe e tre colonne, nota, foto in basso a tutta larghezza.
- cura: fondo scuro, foto e scheda sfalsata con due indicazioni di 12-20 parole.
- voto: domanda, quattro opzioni numerate in griglia, barra con l'invito a commentare.
- chiusura: foto a mezza pagina, striscia, colonna scura con titolo, invito e contatti.

**Da non fare**: angoli arrotondati (tranne gli archi), ombre sfocate, sfumature; titoli in grassetto o tutti in maiuscolo; font o colori scritti fuori dalle variabili; testi lunghi in `--accento`.
