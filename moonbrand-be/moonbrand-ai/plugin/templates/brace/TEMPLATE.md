# Brace

## Carattere
Agenzia social arancio e nero: titoli enormi in grottesco pesante, fondi scuri granulosi, fasce inclinate, piccoli giochi (indovinelli, domande). Per agenzie e consulenti che parlano a negozi e piccole attività.

## Tipografia
- Titoli in `var(--font-titoli)` ExtraBold 104-450 px, minuscolo normale, spaziatura stretta; testi in `var(--font-testo)` Regular 29-56 px, grassetto per le parole chiave.
- Demo: Poppins per tutto. A mano, fisso: Mr Dafoe (parola sopra o accanto al titolo in guida e recensione).

## Griglia
Composizioni centrate, margini 90-110 px; il titolo nella metà alta, il testo sotto. Nella copertina parola verticale sul bordo sinistro, foto a sinistra, testo in colonna a destra.

## Origine
`moonbrand-examples/agenzia-marketing/09/` (Etsy, «Modern Marketing», https://www.etsy.com/listing/4499265113).

## Colori
- Principale: fondi scuri (con grana chiara dal CSS) e righe scure di «parola».
- Accento: fondo della copertina, fasce inclinate, titoli di guida e recensione, fumetti, campanelle, spunte, bordi delle caselle, stelle, icone social, frase finale di «lo-sapevi».
- Secondario: fascia della parola chiave in copertina (testo `var(--su-secondario)`).
- Sfondo: la carta chiara di «parola». Bianco fisso solo per testi, foglio e schede.

## Grafica ricorrente
- Fascia piena inclinata di 2-3° su una parola del titolo, con ombra.
- Fondo nero granuloso, titoli accavallati; parola ripetuta o verticale tagliata dal bordo.
- Schede bianche sfumate in basso (date, caselle, fumetto).

## Layout
- `copertina`: foto di persona su fondo pieno, parola verticale (piena sopra, contorno sulla persona), frase di 12-16 parole con fascia.
- `lo-sapevi`: due parole enormi + fascia, fumetti «?», dato in 2 righe + frase in accento.
- `dato`: numero in fascia dentro 4 righe corte, domanda in corsivo, tre profili social.
- `parola`: parola di 4 lettere ripetuta 4 volte, fumetto bianco di 18-24 parole.
- `indovina`: fascia + verbo + «?», due righe di caselle con lettere mancanti, indizio.
- `guida`: parola a mano + titolo di 5-7 lettere, foglio con 4 passi spuntati.
- `calendario`: quattro date con campanella, titolo e 16-22 parole.
- `recensione`: parola a mano + titolo su due righe, citazione di 26-34 parole tra filetti, stelle.

## Da non fare
- Togliere la grana o le fasce inclinate; raddrizzare tutto.
- Accento su testi lunghi o fondi chiari con testo bianco.
- Allungare i testi oltre i commenti: i titoli enormi non reggono parole lunghe.
