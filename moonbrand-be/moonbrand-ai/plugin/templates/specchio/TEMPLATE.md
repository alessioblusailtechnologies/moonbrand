# Specchio

**Carattere**: le pagine di una rivista di moda indipendente, per un salone che lavora bene e non urla. La foto comanda quasi sempre a tutta pagina, tagliata stretta; il titolo con le grazie si appoggia di lato su una zona calma della foto o della carta, mai al centro.

**Tipografia**: Bodoni Moda per titoli, nomi, prezzi e logo: peso 400-500, interlinea 0,9-1, spaziatura stretta (-0,03em), in minuscolo con la sola iniziale. Titoli da 64 a 140 px, prezzo fino a 250 px. Hanken Grotesk 400/500 per i testi, 25-27 px, interlinea 1,35: frasi brevi, mai più di 30 parole per blocco. Il logo è il nome in Bodoni corsivo 30-34 px.

**Griglia**: margini di 48-64 px. Titolo in alto a sinistra (o in alto a destra se il soggetto è a sinistra), testo e logo in basso sullo stesso filo. Sulla carta, colonna di testo stretta (300-370 px) accanto o sotto a un titolo largo.

**Grafica ricorrente**: un solo filetto corto in `--accento` (56×3 px) sopra il testo in sans o la firma. Fasce piene a filo del bordo (foto, `--sfondo`, `--principale`), tagli dritti, nessun riquadro. Sulle foto il testo è in nero o bianco puro secondo la zona dove poggia (variabile `--su-foto` nel layout), senza ombre né velature.

**Layout**:
- `copertina`: apertura di carosello o post singolo; foto a tutta pagina col soggetto da un lato, titolo di 3-6 parole sul lato vuoto, una frase concreta in basso.
- `prima-dopo`: due foto della stessa persona con la stessa luce; il dopo grande a destra, il prima piccolo in alto a sinistra; titolo del cambiamento e 12-22 parole su cosa si è fatto.
- `consiglio`: foto di un gesto in alto per tre quinti, sotto titolo-consiglio (4-8 parole) e due brevi paragrafi: il perché e cosa fare.
- `recensione`: le parole vere della cliente tra «» in Bodoni (20-35 parole), nome e dettaglio vero sotto; striscia di foto a destra.
- `offerta`: foto a sinistra, colonna in `--principale` con titolo, prezzo enorme, cosa comprende, e la condizione concreta (date, giorni, telefono).
- `persona`: ritratto a tutta pagina sul posto di lavoro, nome in una parola sulla zona scura, 12-20 parole vere su chi è.

**Da non fare**: centrare titolo e testo; mettere il testo su un riquadro, una velatura o un'ombra per salvarlo (si cambia taglio della foto o lato); usare l'accento per testi; aggiungere etichette, numeri, icone o una seconda linea decorativa; scrivere il titolo in maiuscolo o evidenziarne una parola; foto patinate o di stock.
