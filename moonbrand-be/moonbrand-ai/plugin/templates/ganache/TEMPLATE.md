# Ganache

**Carattere**: da pasticceria che vende torte su Instagram, editoriale e golosa: titoli enormi e strettissimi che riempiono il post, il dolce scontornato che ci passa davanti, fondi chiari e qualche post a fondo pieno scuro. Per pasticcerie e cake designer. Colori e font sono del brand (demo: cacao, crema, senape).

**Tipografia**: titoli in `var(--font-titoli)` (demo: Roboto Flex larghezza 25-50%; Anton in «ordina», Bagel Fat One in «offerta»), 230-560 px, interlinea 0,8, una parola o due per riga, minuscolo nei post colloquiali e maiuscolo nei nomi. Le righe si stringono da sole se il font è largo (`data-max`). Testi in `var(--font-testo)` (demo: Poppins) 19-44 px. Frasi, inviti e recensioni in corsivo Libre Caslon 26-40 px.

**Griglia**: nome del brand in alto al centro (19 px, spaziato), profilo social in basso al centro. Titolo da bordo a bordo (30 px di margine) o allineato a sinistra a 62-70 px. Frasi in corsivo tra filetti sottili sotto il titolo.

**Origine**: moonbrand-examples/bakery/07/, «Cake Shop Instagram templates» di Cake Solo Cakes (https://www.etsy.com/listing/4590338116).

**Grafica ricorrente**:
- il dolce scontornato davanti alle lettere: foto su fondo uniforme chiaro (classe `chiaro`) o nero (`scuro`), il filtro SVG toglie il fondo;
- un post su tre a fondo `--principale` con titolo chiaro;
- filetti sottili sopra e sotto le frasi; tondi a filo `--secondario` con 3 righe in maiuscolo o in corsivo;
- elenco numerato con numeri nel font dei titoli e barra `--secondario`; riquadro a filo `--accento`; stelle in `--accento`.

**Layout**:
- copertina: 2 parole in minuscolo, dolce in mano che le copre, frase e invito tra filetti.
- menu: 1-2 parole in maiuscolo, torta intera, 4 dolci con ingredienti.
- ordina: fondo scuro, 3 righe da 1-2 parole, torta su fondo nero, invito nel riquadro, i passi in 8-12 parole.
- novita: 2 righe in minuscolo, nome nel tondo, dolce nuovo, nota di 8-12 parole.
- offerta: l'offerta in 2 righe tonde, condizioni, mani col dolce dal basso.
- recensione: 2 righe a sinistra, fetta che esce a destra, 5-9 parole del cliente, stelle.
- pasticcere: 3 parole corte, foto verticale a destra, presentazione nel tondo.
- golosi: fondo scuro, un gusto ripetuto 3 volte, fetta in basso a destra.

**Da non fare**: titoli piccoli o con margini larghi; foto in riquadri con angoli o ombre; il filtro su foto senza fondo uniforme; sfumature; più di due righe di corsivo; testi lunghi in `--accento`.
