# Caramello

**Carattere**: il set di un grafico per forni e pasticcerie, caldo e da vetrina: serif da rivista grandi, foto del prodotto da vicino che riempiono la slide, pannelli chiari velati sopra le foto e linee sottili. Per un forno curato ma caldo. Colori e font sono del brand (demo: marrone caramello, nero caffè, crema, kraft).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Playfair Display) 150-240 px, peso 400-500, minuscolo con iniziale; corsivo per una parola o un titolo intero (menu, orari, «sapevi»), maiuscolo spaziato solo nella seconda riga della novità. Testi in `var(--font-testo)` (demo: Poppins) 24-44 px; righe in maiuscolo spaziato 25-40 px sopra o sotto il titolo nelle offerte.

**Griglia**: margini 60-150 px; titoli centrati sui pannelli e sugli archi, a sinistra sui fondi pieni (menu, curiosità). Foto a tutto campo o dentro un pannello con 47 px di bordo.

**Origine**: moonbrand-examples/bakery/10/, «Bakery Instagram Posts», 50 post Canva di Casuarrina (etsy.com/listing/4329128419).

**Grafica ricorrente**:
- foto a tutto campo velate di `--accento` o di `--sfondo`;
- pannello `--sfondo` pieno o velato al 60-70%, angoli tondi e filo sottile solo su orari e recensione;
- linee sottili chiare o in accento: oblique nei margini, curve che entrano dagli angoli, archi;
- arco chiaro in basso con filo in `--accento`, filetti ai lati di una parola;
- fasce piene in `--accento` in alto e in basso (menu, sondaggio), cornice piena in recensione;
- titoli brevi in `--accento` sullo sfondo, in `--principale` le parole in corsivo.

**Layout**:
- copertina: un prodotto, una parola di titolo e una riga spaziata; foto nel pannello su foto velata.
- menu: titolo corsivo di 2 parole, 4 voci con prezzo e 8-12 parole; tre dolci tondi tagliati a destra.
- orari: sette righe giorno e orario, indirizzo e telefono, pannello velato su foto.
- offerta: riga, due parole (accento e corsivo), sconto; foto velata tra due filetti.
- novita: una parola e una maiuscola spaziata nell'arco in basso, foto del prodotto sopra.
- recensione: 40-55 parole giustificate, nome, stelle, su un fondo di materia.
- curiosita: una domanda di 3 parole grandi su carta stropicciata, poi il carosello.
- sondaggio: «questo o quello», due foto sfalsate con il nome.

**Da non fare**: sfumature, ombre sui pannelli, più di un font per titoli; titoli lunghi; testo lungo in `--accento`; colori scritti fuori dalle variabili; pannelli opachi sulle foto dove il modello li vela.
