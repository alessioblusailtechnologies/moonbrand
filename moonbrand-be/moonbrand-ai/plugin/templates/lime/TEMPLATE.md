# Lime

## Carattere
Corporate da agenzia: fondi pieni, titoli grossi, pochi segni ripetuti. Per agenzie e consulenti (risultati, metodo, consigli). Colori e font sono del brand: il template dà l'impaginazione.

## Tipografia
- Titoli, cifre, fumetti in `var(--font-titoli)`; testi, etichette, gradini in `var(--font-testo)`.
- Demo: Poppins (titoli Bold 100-104 px, testi 46-50 px); Anton maiuscolo in copertina e slogan, ingrandito con `size-adjust`: le misure reggono font larghi.
- A mano, fissi: Kaushan Script (cifra di copertina), Herr Von Muellerhoff (slogan).

## Griglia
Margini 110-120 px. Titoli centrati sui fondi chiari, a sinistra sui pieni. Foto nella metà bassa, sfumate in alto.

## Origine
`moonbrand-examples/agenzia-marketing/24/` (Etsy, «Corporate Business», https://www.etsy.com/listing/4565167123).

## Colori
- Accento, sfumato verso l'accento scurito: fascia e cifra (copertina), fumetto risposta ed etichetta «Domanda», fumetto «Lo sapevi» e evidenza della citazione, fondo di numero e recensione, gradini, colonne 2-3 e prima riga (risultati), parola e parolina dello slogan, stelle.
- Secondario: fumetto domanda ed etichetta «Risposta», fumetto «che?», raggi, virgolette, cifra (numero), prima riga (processo), prima colonna (risultati), iniziale, bordi dei fondi chiari. Testo sopra: `var(--su-secondario)` (bianco o nero da solo).
- Principale: fondi scuri e testi sui chiari.

## Grafica ricorrente
- Fumetti con codina, etichette bordate, colonne con la punta.
- Fascia inclinata con la parola bianca (copertina); parola chiave colorata o in grassetto.
- Nello slogan folla in bianco e nero, a colori solo la persona al centro.

## Layout
- `copertina`: apre i consigli. Cifra + 2 righe + fascia; foto dall'alto.
- `risultati`: tre numeri. Titolo 2 righe, tre colonne: voce di 2 righe, cifra girata di 2-3 caratteri.
- `numero`: un dato. Hashtag, frase di 10-16 parole (una in grassetto), cifra.
- `lo-sapevi`: una curiosità. Fumetti «Lo sapevi / che?», citazione di 22-32 parole.
- `domanda`: domanda e risposta di 8-14 parole ciascuna.
- `processo`: il metodo. Titolo 2 righe, quattro gradini sempre più corti.
- `recensione`: parola ripetuta sul fondo, scheda di 20-30 parole.
- `slogan`: due parole, parolina a mano + 1-2 parole, frase sotto.

## Da non fare
- Togliere le sfumature, accento su testi lunghi, bianco o nero fissi sugli elementi colorati.
- Aggiungere icone o cornici che il template non ha.
- Allungare i testi oltre i commenti.
