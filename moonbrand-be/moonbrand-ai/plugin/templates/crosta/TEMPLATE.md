# Crosta

**Carattere**: il set di un forno di quartiere, caldo e sobrio: foto vere a tutta pagina (mani, farina, pane), fondi color tortora con i prodotti scontornati, un serif elegante per il nome del forno col punto. Per forni, pasticcerie e caffetterie. Colori e font sono del brand (demo: quasi nero, tortora, marrone, crema).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Gilda Display) peso 400, minuscolo con il punto finale («appena sfornati.»), 140-230 px; il nome del forno è il titolo più grande. Righe ripetute in maiuscolo in «novita». Testi in `var(--font-testo)` (demo: PT Serif) 27-33 px, centrati sulle foto, grassetto nelle recensioni. I titoli su una riga si rimpiccioliscono da soli con un font largo (`data-adatta`). Corsivo Playfair Display solo per dettagli: «orari di apertura:», il nome del prodotto, una parte dell'invito.

**Griglia**: margini di 60-110 px. Sulle foto tutto centrato: titolo a metà altezza, testo di 3-5 righe nel quarto basso. Sui fondi tortora titolo in alto, prodotti al centro, testo in basso.

**Origine**: moonbrand-examples/bakery/15/, «Baked.» di Flair Nook, https://www.etsy.com/listing/1831177172.

**Grafica ricorrente**:
- prodotti scontornati con ombra morbida sul `--secondario`: `<svg>` con la foto su fondo chiaro e la sua `<mask>` `-maschera.jpg` (bianco = prodotto);
- frecce sottili disegnate a mano in `--accento` dal nome al prodotto, prezzi accanto al nome;
- testo chiaro (`--chiaro`) sulle foto, scurite se serve;
- velo chiaro trasparente sulla foto in «recensione», stelle in `--accento`;
- filetto `--accento` sotto il nome del prodotto.

**Layout**:
- copertina: foto piena, nome del forno grande, anno, 30-40 parole.
- inaugurazione: invito di 6-8 parole, nome del forno, indirizzo e orari agli angoli bassi.
- chi-siamo: foto scura, «chi è» + nome, 45-60 parole in grassetto.
- listino: titolo di 3-4 parole, 4 prodotti scontornati con nome, prezzo e freccia, orari.
- novita: 2 parole ripetute su sei righe, il prodotto nuovo scontornato sopra.
- recensione: due recensioni con stelle (40-50 e 25-35 parole), in alto a sinistra e in basso a destra.
- prodotto: titolo di 2 parole, prodotto che esce dal bordo destro, nome, 25-30 parole.
- domande: foto piena, «D & R» enorme, 10-14 parole in corsivo.

**Da non fare**: angoli arrotondati, ombre sui blocchi di testo; prodotti scontornati su foto; titoli in maiuscolo (tranne «novita»); testi lunghi in `--accento`; più di quattro prodotti per pagina.
