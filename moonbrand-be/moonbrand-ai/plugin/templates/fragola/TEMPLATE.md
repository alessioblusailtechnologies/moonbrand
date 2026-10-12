# Fragola

**Carattere**: il set di un grafico per panetterie e pasticcerie, allegro e da rivista: fondo crema, titoli enormi in un solo colore acceso, il prodotto vero protagonista, su fondo chiaro o in mano. Ogni slide ha una sua voce tipografica ma lo stesso colore di evidenza. Colori e font sono del brand (demo: rosa, marrone, crema).

**Tipografia**: titoli in `var(--font-titoli)` grandissimi, 130-330 px, interlinea 0,8-1, quasi sempre in `--accento`. Testi in `var(--font-testo)` 24-40 px, spesso in maiuscolo. Note a mano (La Belle Aurore) solo accanto alla foto.

**Griglia**: margini 66-84 px. Testata sottile in alto (profilo, nome, data o sito), titolo nel terzo alto, prodotto nella metà bassa, piede con indirizzo o sito. Centrato, tranne la copertina.

**Origine**: moonbrand-examples/bakery/08/, set Canva «Bakery Social Media Template» (45 post), https://www.etsy.com/listing/4530135167.

**Grafica ricorrente**:
- foto su fondo bianco fuse con `--sfondo` (`mix-blend-mode: multiply`), prodotti tagliati dal bordo ai lati;
- ovale disegnato attorno al nome o al prezzo, frecce sottili a mano;
- cornice a onde a pennarello in `--accento` (menu), scontrino dentellato con molletta (orari);
- bollo a festone in `--accento`, tratteggio e scacchiera in `--secondario` (offerta);
- su foto scura testi chiari, titolo in `--accento`.

**Layout**:
- copertina: titolo di due righe con «&», motto, 12-16 parole, due note a mano, indirizzo; mano con prodotto.
- prodotto: domanda di 3-6 parole, nome del prodotto con il punto, foto in mano su fondo bianco.
- colazione: nome e anno, titolo dritto + parola in corsivo, tre prodotti, prezzo nell'ovale, nome del prodotto.
- dolce: foto scura, marchio rotondo, nome del dolce su due righe, 5-8 parole, sito.
- torta: 2-4 parole sopra una parola gigante di max 5 lettere, foto su fondo chiaro, nome e nota in basso.
- menu: titolo a pennarello, 3-4 prodotti con prezzo e frase di 6-9 parole, tre schizzi.
- orari: scontrino sulla foto del forno, logo, titolo di 2 parole, due righe di orari, indirizzo.
- offerta: testata di tre parole, titolo pesante di due righe, bollo con lo sconto, prodotto in pila.

**Da non fare**: più di un colore di evidenza per slide; titoli piccoli o in più colori; riquadri, ombre, sfumature; foto con fondo scuro nei layout su crema; font o colori esadecimali fuori dalle variabili (tranne la molletta di metallo); testi lunghi in `--accento`.
