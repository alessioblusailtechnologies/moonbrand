# Briciola

**Carattere**: il set Canva di un forno di quartiere: fondo chiaro quasi bianco o carta stropicciata, serif nero pesantissimo, prodotti scontornati che galleggiano sulla pagina, tocchi color caramello. Per forni, pasticcerie e caffetterie. Colori e font sono del brand (demo: nero, sabbia, caramello, grigio carta).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Literata 900, ottica piccola), interlinea 0,8-0,9, 120-230 px, minuscolo con iniziale maiuscola, centrati. Testi in `var(--font-testo)` (demo: Newsreader) 24-60 px; nomi dei prodotti e parole «sopra» il titolo nel peso 300, grandi.

**Griglia**: quasi tutto centrato su un asse; titolo in alto, prodotto al centro, firma o contatti in basso. Il menu alterna foto e testo a zig-zag.

**Origine**: moonbrand-examples/bakery/21/, «230 Bakery Themed Instagram Templates» di DigiCraftStyle (etsy.com/listing/1876875262).

**Grafica ricorrente**:
- prodotto su fondo bianco scontornato dal filtro `#scontorna` (`.ritaglio`), che esce dal suo cerchio o dalla sua fascia;
- cerchio pieno in `--secondario` dietro il prodotto, nome dentro;
- contorni sottili arrotondati in `--accento` o `--principale` attorno a nome, frase e contatti; stella a contorno per lo sconto;
- carta stropicciata (`.carta`) sotto a tutto;
- fascia obliqua in `--accento` col prezzo; blocco `--secondario` con pennellate `--principale`;
- frecce a ricciolo disegnate a mano; archi sottili; parentesi quadre in `--accento` attorno al nome; stelline a quattro punte.

**Layout**:
- copertina: nome nel contorno, titolo di 2 parole, frase di 10-16 parole, prodotto, sconto, due contatti.
- croissant: titolo di 4-5 parole su quattro righe, prodotto sul cerchio con il nome, orari.
- dolce: 1 parola leggera + 1 enorme, nome e ingredienti nel contorno, piatto tondo sulla fascia, prezzo.
- menu: titolo di 2 righe, 3 prodotti con prezzo e 8-14 parole.
- orari: due gruppi di giorni sulle pennellate, un pane tagliato dalla fascia, invito.
- colazione: iniziale enorme + resto leggero, prodotto grande, «+ 2 parole», prezzo.
- sfornato: foto scura a tutto campo, nome tra parentesi, titolo di 5-8 parole in `--accento`.
- inaugurazione: striscia chiara e foto, 2 parole verticali, data e indirizzo negli ovali.

**Da non fare**: ombre, sfumature, riquadri con angoli vivi attorno ai prodotti; `.ritaglio` su foto senza fondo bianco; titoli in maiuscolo o in un peso leggero; testi lunghi in `--accento`; colori o font fuori dalle variabili.
