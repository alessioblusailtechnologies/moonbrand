# Mollica

## Carattere
Da panetteria e pasticceria di quartiere: fondo crema pieno, un serif classico grande e un prodotto scontornato su fondo bianco che si fonde con lo sfondo.

## Tipografia
- Titoli in `var(--font-titoli)` (demo EB Garamond), testi in `var(--font-testo)` (demo Open Sans).
- Titoli 90-200 px, grassetto o seminero, interlinea stretta; maiuscolo in copertina, offerta e recensione, corsivo in racconto, in «menù» e nel mese di prenota.
- Frasi d'invito, nomi dei prodotti e bottoni nel serif dei titoli; descrizioni, prezzi e testi lunghi nel sans, 27-36 px.

## Griglia
Tutto centrato (menu alterna foto a sinistra e a destra). Titolo a 50-180 px dal bordo alto, prodotto al centro, invito a 80-140 px dal fondo. Margini laterali 60-150 px.

## Origine
`moonbrand-examples/bakery/11/` (Etsy, https://www.etsy.com/listing/4495382408).

## Colori
- Principale: titoli, testi, filetti, frecce, puntina.
- Sfondo: il fondo e la scheda della recensione.
- Secondario: cerchio, metà bassa con l'angolo tondo, fascia della recensione, esplosione, bottone di prenota.
- Accento: bottone pieno dell'offerta.

## Grafica ricorrente
- Prodotto scontornato su fondo bianco (`mix-blend-mode: multiply`), anche a cavallo tra due fondi.
- Forme piene del secondario: cerchio che esce dall'angolo, metà bassa con grande angolo tondo.
- Frecce a mano con un ricciolo, filetti ai lati del corsivo, esplosione con 1-2 parole.
- Bottone a pillola vuoto o pieno, rettangolo pieno nell'offerta, stelle del voto, foto in cornice di carta con puntina.

## Layout
- `copertina`: titolo maiuscolo di 3 righe, frase, bottone; prodotto in diagonale sul cerchio.
- `novita`: titolo di 2 righe, un prodotto al centro, 2 righe in maiuscolo spaziato.
- `offerta`: sconto in maiuscolo, corsivo tra i filetti, prodotti su mollica velata, esplosione, testo di 20 parole, bottone.
- `menu`: «Il nostro menù», tre prodotti con nome, prezzo, 6-10 parole.
- `prenota`: mese, una parola enorme, prodotto, quattro tondi con nome, bottone.
- `recensione`: foto scura di fondo, scheda con titolo, foto in cornice, stelle, frase di 18-26 parole, nome.
- `racconto`: titolo in corsivo di 3 righe, 20-30 parole, foto su legno nel terzo basso.
- `visitaci`: titolo di 2 righe, prodotto a cavallo della metà bassa, invito.

## Da non fare
- Foto con fondo colorato dove serve lo scontorno: il multiply le mostra come rettangoli.
- Sfumature, ombre e cornici che il template non ha.
- Accento su testi lunghi.
