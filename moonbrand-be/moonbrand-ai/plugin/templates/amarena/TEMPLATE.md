# Amarena

**Carattere**: il set di una pasticceria da caffè, caldo e pulito: foto ravvicinate di dolci, schede color carta appoggiate sulle foto, serif morbido accanto a un grottesco nero in maiuscolo, disegni a tratto di spighe e tazze. Colori e font sono del brand (demo: bordeaux, rosso amarena, rosa bruno, crema).

**Tipografia**: titoli in `var(--font-titoli)` (demo: DM Serif Display) peso normale, 90-140 px, interlinea 0,86-1, minuscolo con iniziale maiuscola. Testi in `var(--font-testo)` (demo: Red Hat Display) 23-32 px; occhielli e didascalie in maiuscolo grassetto 18-24 px. Il marchio è doppio: parola in grottesco nero maiuscolo, sotto una parola in serif. Un solo titolo grottesco (novita) e una sola scritta a mano (Yellowtail) per «Novità».

**Griglia**: composizioni centrate in asse. Schede color carta larghe circa 2/3 del post (x 185-895), angoli appena arrotondati. Margine dei testi a sinistra 266 px nel layout con la foto incorniciata.

**Origine**: moonbrand-examples/bakery/28/, «Creamy Bakery», https://www.etsy.com/listing/4505509847

**Grafica ricorrente**:
- schede `--sfondo` su foto a tutto campo o su fondo velato del secondario; nastro adesivo bianco trasparente sopra il foglio degli orari;
- spighe, foglie, tazze e dolci disegnati a tratto sottile nel secondario schiarito, grandi e tagliati dal bordo o piccoli sopra il titolo;
- titoli in `--accento` sui fondi chiari, in `--secondario` dentro le schede; fondo `--principale` pieno con foto incorniciata e orario in verticale;
- parola scritta a mano storta a cavallo del bordo di una foto.

**Layout**:
- copertina: foto a tutto campo, anno, marchio grande, 8-12 parole in maiuscolo.
- listino: scheda con marchio e 4-5 prodotti con prezzo, spiga dietro.
- novita: titolo maiuscolo di 2-4 parole, 12-18 parole, foto nella metà bassa, parola a mano.
- senza-zucchero: scheda su foto dall'alto, titolo di 2-3 parole, 8-12 parole, nota.
- mattino: fondo pieno, titolo di 3-4 parole, foto incorniciata, orario verticale, 8-12 parole.
- prodotto: un dolce al centro, nome su due righe, occhiello, 12-16 parole di ingredienti.
- orari: foglio con nastro su vetrina sfocata, titolo di 2 parole, due fasce orarie.
- frase: fondo chiaro, disegni a tratto, motto su due righe, marchio in basso.

**Da non fare**: ombre, sfumature, bordi spessi; più di una scritta a mano; testi lunghi in `--accento`; colori o font scritti fuori dalle variabili; titoli in maiuscolo serif.
