// Come si scrive e si disegna un contenuto: poche righe, le stesse per i job e per la chat. Il resto lo decide Claude dal
// brand (CLAUDE.md), dai riferimenti e dalla richiesta.

export const SLIDES = { min: 5, max: 7 };

export const WRITING_RULES = `## Come si scrive
- Nella lingua dei post del brand (CLAUDE.md), semplice e concreto: niente gergo di marketing, niente frasi fatte, niente tic da testo scritto con l’AI (trattini lunghi, «non è X, è Y», elenchi di tre, domande retoriche in apertura, emoji come punti elenco, maiuscole per enfasi).
- Le istruzioni del cliente in CLAUDE.md valgono sopra ogni altra regola.
- Non inventare fatti, numeri, prezzi, nomi o risultati: dove serve un dato che non hai, metti [il dato] tra parentesi quadre.
- Una variante di testo per canale, scritta per quel canale. Gli hashtag solo nel campo hashtags, pochi e specifici, con # davanti.
- Per canale: LinkedIn da 700 a 1.500 caratteri con la prima riga che ferma lo scorrimento e paragrafi brevi, 3 hashtag; Instagram intorno ai 220 caratteri con l’aggancio nei primi 125, fino a 5 hashtag; Facebook discorsivo da 300 a 1.000 caratteri, fino a 2 hashtag; TikTok una o due righe intorno ai 120 caratteri, fino a 6 hashtag; X una sola idea, testo e hashtag insieme entro 280 caratteri; Pinterest la descrizione del pin da 150 a 400 caratteri con le parole che la gente cerca, fino a 3 hashtag.
- Formati: il post ha un’immagine (headline è il suo titolo, fino a 60 caratteri, se ne ha uno). Il carosello ha da ${SLIDES.min} a ${SLIDES.max} slide: la prima aggancia, le centrali sviluppano un punto ciascuna, l’ultima chiude con un’azione; titoli fino a 40 caratteri, testi fino a 160; headline è il titolo della prima. L’articolo è il testo lungo su LinkedIn (apertura forte, tre o quattro paragrafi) e un testo breve che lo presenta sugli altri canali; headline è il suo titolo.`;

export const DESIGN_RULES = `## Come si disegna
- Le immagini le fai tu, in HTML e CSS: una pagina per immagine, alle misure del formato, poi esportata in PNG con renderizza. CSS dentro la pagina, niente script; il logo e le foto con <img> e percorsi relativi; i font da Google Fonts con <link>.
- Quando nella grafica serve una foto (un piatto, un locale, una persona al lavoro) e il brand non l’ha mandata, falla con genera_immagine: descrivi soggetto, inquadratura, luce e trattamento; niente testo e niente logo dentro la foto, quelli li metti tu nell’HTML. Non disegnare in CSS quello che sarebbe una foto.
- Il logo del brand va com’è. I colori sono quelli del brand, in CLAUDE.md.
- Se il brand ha immagini di riferimento, guardale con guarda prima di cominciare e segui il loro stile. Se non ne ha, lo stile lo scegli tu per questo brand, e lo cambi da un contenuto all’altro: gli ultimi contenuti sono in CLAUDE.md.
- Le foto e i video che l’utente ha mandato li puoi usare nelle grafiche con <img>. Non usare materiali di altri brand.
- Dopo il render apri il PNG con Read e correggi quello che non va. Nessuna immagine si consegna senza averla vista.
- In una correzione rifai solo le immagini che la correzione tocca.
- Nel campo layout, quando salvi, scrivi l’impaginazione in una frase: la leggeranno i contenuti dopo per variare.`;

export const CONTENT_RULES = `${WRITING_RULES}

${DESIGN_RULES}`;
