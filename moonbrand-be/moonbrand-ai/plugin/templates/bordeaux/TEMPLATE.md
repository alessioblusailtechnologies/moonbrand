# Bordeaux

**Carattere**: il set di un grafico per saloni di bellezza, da rivista: titoli serif stretti e grandi, scritte a macchina su nastri di carta, foto di moda in bianco e nero o calde. Per saloni che vogliono sembrare un atelier. Colori e font sono del brand (demo: bordeaux, beige, senape).

**Tipografia**: titoli e prezzi in `var(--font-titoli)` (demo: Noto Serif Display stretto), peso 600, interlinea 0,86, 150-200 px, minuscolo con iniziale maiuscola. Testi, pulsanti e numeri dei passi in `var(--font-testo)` 24-26 px, giustificati nelle colonne strette. Nastri, fasce, testata e piede in Courier Prime maiuscolo 24 px.

**Griglia**: margine sinistro 112 px, destro 104 px. Titolo in alto: a sinistra sui fondi chiari, centrato sulle foto a tutto campo. Testata o piede: logo a sinistra, sito a destra.

**Origine**: moonbrand-examples/parrucchieri/02/, «Luxury Hair Instagram Templates» di anny_sketches (creativemarket.com/anny_sketches/292239184).

**Grafica ricorrente**:
- nastro di carta in `--secondario` (testo `--su-secondario`), bordi strappati, storto 2-5°: invito, nome, servizio;
- fasce oblique dai bordi con 1-2 parole ripetute tra pallini, in `--principale`, `--accento` o `--secondario`, una o due per layout;
- cornici: `--accento` spessa attorno alla foto piccola, `--principale` dietro la foto in basso, bordo bianco da polaroid;
- grana sui fondi scuri e sulle foto; foto in bianco e nero in copertina e cliente;
- titoli sulle foto in `--accento`; pulsante in `--principale`; cerchi numerati in `--accento`; spunte in `--principale` su strisce `--secondario`; piede della cliente in `--secondario` schiarito.

**Layout**:
- copertina: annuncio, titolo di 4-6 parole, pulsante.
- servizi: 4 servizi col prezzo, due foto.
- prenotazione: titolo di 2 parole, 3-4 passi di 6-10 parole, foto a figura intera.
- recensione: fondo `--principale`, 35-55 parole della cliente, nome sul nastro, foto piccola.
- novita: servizio nuovo, prezzo, 30-45 parole; foto scura che si fonde col `--principale`.
- cliente: la cliente del mese, polaroid a colori su foto in bianco e nero, 25-40 parole.
- prima-dopo: il dopo a tutto campo, polaroid del prima, 30-45 parole.
- consigli: 3 consigli di 12-20 parole su strisce sopra un primo piano, pulsante.

**Da non fare**: angoli arrotondati, ombre sui riquadri, sfumature; font o colori esadecimali scritti fuori dalle variabili; nastri dritti o lisci; più di due fasce; titoli in maiuscolo; testi lunghi in `--accento`.
