# Cannella

**Carattere**: il set di una pasticceria da caffè romantica: fondo rosa cipria, un solo rosso per titoli ed etichette, serif classico grande e foto di dolci da vicino. Per forni, pasticcerie e caffetterie che vogliono un feed dolce ma pulito. Colori e font sono del brand (demo: rosso, rosa, crema).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Cormorant Garamond 400-500), 170-215 px, spesso in maiuscolo stretto, interlinea 0,8-0,9; nella novità una riga dritta in grassetto e due in corsivo leggero. Testi in `var(--font-testo)` (demo: Montserrat) 24-27 px semibold, testata 52 px bold. Scritte a mano in Allison, solo nella novità. Titoli su una riga e titolo curvo si rimpiccioliscono da soli se il font è largo (script `data-max`).

**Griglia**: margini di 26-60 px; titolo centrato in alto, foto al centro o in basso che esce dal bordo, etichetta col nome in alto o in basso al centro. Nei verticali (eventi) il titolo ruotato a sinistra e la lista a destra.

**Origine**: moonbrand-examples/bakery/01/, «Bakery/Café Instagram templates» (76 post), https://www.etsy.com/listing/4373919454.

**Grafica ricorrente**:
- etichetta col nome del brand (`logo`), angoli appena arrotondati: piena in `--accento` o col bordo `--accento` su `--sfondo`;
- foto ad arco con bordo chiaro, foto tonde, tre strisce di foto impilate;
- carta vera: manifesto stropicciato con nastro di carta e fiocco `--accento`, sacchetto con pieghe e scotch;
- righe verticali `--sfondo` e `--secondario` schiarito; riquadri data nell'accento schiarito;
- titolo curvo sopra l'arco; bottoni pieni o a contorno sottile.

**Layout**:
- copertina: invito a un evento, testata nome + invito, titolo di 2 parole, data e indirizzo ai lati della foto.
- aperti: manifesto sulla foto piena, titolo di 3 parole, 2 righe di orari.
- preferito: titolo curvo di 18-24 caratteri, prodotto nell'arco, nome su 2 righe nel bottone.
- eventi: titolo verticale di 2 parole, 3 eventi con data, nome di 4-6 parole, orario e foto tonda.
- novita: foto piena, scritta a mano, titolo su 3 righe, bottone.
- ingrediente: fondo `--principale`, titolo di 2 righe, 30-40 parole, foto ad arco.
- mattina: righe verticali, tre foto a strisce, 2 parole spaziate.

**Da non fare**: sfumature, ombre sui riquadri, più di un font a mano; testi lunghi in `--accento`; titoli in grassetto pesante (tranne la riga dritta della novità); foto senza un taglio (arco, tondo, striscia o piena).
