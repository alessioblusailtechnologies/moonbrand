# Inchiostro

## Carattere
Editoriale da rivista di moda in bianco e nero: titoli enormi a ridosso dei bordi, serif a contrasto alto accostato a grotteschi pesanti, foto chiare di persone e interni. Per agenzie e consulenti che si raccontano.

## Tipografia
- Serif dei titoli `var(--font-titoli)` (demo Playfair Display 500, -0.045em, interlinea 0.82): copertina 262 px, metodo 204 px maiuscolo, persona 168 px.
- In manifesto il titolo è un grottesco stretto (demo Anton 150 px maiuscolo), in chi-siamo un grottesco nerissimo (Archivo 800, 258 px), in notizia un grottesco leggero stretto (100 px, -0.06em).
- Testi `var(--font-testo)` 24-31 px; maiuscolo nei passi del metodo e nelle rubriche.
- Fisso: Pinyon Script per le parole scritte a mano della citazione.

## Griglia
Margini 20-90 px: i titoli grandi stanno a ridosso del bordo. Colonna stretta di testo accanto al titolo (manifesto, notizia). Foto a tutta pagina con un velo, oppure in un blocco squadrato senza bordi né angoli tondi.

## Origine
`moonbrand-examples/agenzia-marketing/23/` (Etsy, «Bianco Disegno», https://www.etsy.com/listing/4449736663).

## Colori
- Secondario: riquadro del metodo, fascia della notizia, punti della linea dei passi, parola a mano. Testo sopra `var(--su-secondario)`.
- Accento: filetto della copertina, linea dei passi.
- Principale: testi e velo scuro della persona; sfondo: fondi e velo chiaro.

## Grafica ricorrente
- Titoli enormi a ridosso del bordo; parola spezzata in due righe sfalsate (persona).
- Velo chiaro o scuro sulla foto intera; frecce sottili accanto ai numeri.
- Testo giustificato in corsivo nero accanto alla foto (chi-siamo).

## Layout
- `copertina`: due parole enormi, nome del brand sotto, foto velata.
- `processo`: titolo enorme, tre foto e tre passi di 7-10 parole.
- `manifesto`: frase di 3-5 parole in quattro righe, colonna di 18-26 parole, testo di 50-70.
- `chi-siamo`: due parole nere, foto verticale, 40-55 parole.
- `notizia`: fascia con rubrica e data, due frasi brevi, 45-60 parole, foto in basso.
- `persona`: ritratto velato, parola spezzata, nome, ruolo, 35-50 parole.
- `citazione`: testata in due parti, frase di tre righe con 2-3 parole a mano.
- `passi`: titolo con due parole in corsivo, cinque passi di 7-10 parole su una linea.

## Da non fare
- Titoli piccoli e centrati nel vuoto: la misura enorme è il segno del template.
- Aggiungere colori pieni, angoli tondi, ombre o icone.
- Mettere l'accento sui testi lunghi.
