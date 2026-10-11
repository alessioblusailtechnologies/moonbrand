---
name: contenuti
description: Come si scrive e si prepara un contenuto social per il brand della cartella (post, carosello, articolo, video) - testi per canale, hashtag, formati, immagini e video, controllo finale. Da usare ogni volta che si scrive, si prepara o si ritocca un contenuto.
---

# Scrivere un contenuto

Il brand è descritto in CLAUDE.md: chi è, per chi scrive, temi, voce e canali. Un contenuto nasce da un’idea (cosa raccontare, con quale taglio) e ha un formato, dei canali, un testo per ogni canale e le sue immagini.

## Regole di scrittura

- Scrivi nella lingua dei post del brand (in CLAUDE.md, «Lingua dei post»), semplice e concreto: niente gergo di marketing, niente frasi fatte, niente trattini lunghi. Gli esempi di queste skill sono in italiano: valgono per il tono, non per la lingua.
- Segui alla lettera le istruzioni del cliente (nel CLAUDE.md del brand): se vietano esclamativi o emoji, non usarne; se chiedono i numeri in cifre, scrivi 3 e non tre.
- Non inventare fatti, numeri, prezzi, nomi di clienti o risultati: quando serve un dato che non conosci, metti il segnaposto tra parentesi quadre, per esempio [prezzo].
- Ogni canale ha la sua variante, scritta per quel canale e non copiata dalle altre.
- Gli hashtag stanno solo nel campo hashtags e mai nel testo: pochi e specifici, con # davanti e senza spazi.

## Canali

| Canale | Testo | Caratteri al massimo | Hashtag al massimo |
| --- | --- | --- | --- |
| LinkedIn (linkedin) | la prima riga deve fermare lo scorrimento, le prime due righe (circa 210 caratteri) si vedono prima di «…altro»; paragrafi brevi separati da una riga vuota; da 700 a 1.500 caratteri, fino a 2.900 per un articolo | 3.000 | 3 |
| Instagram (instagram) | didascalia da 300 a 900 caratteri: prima di «…altro» se ne vedono circa 125, lì va l’aggancio; per un carosello invita a scorrere | 2.200 | 6 |
| Facebook (facebook) | tono vicino e discorsivo, da 300 a 1.000 caratteri | — | 2 |
| TikTok (tiktok) | didascalia corta, una o due righe intorno ai 120 caratteri: sta sopra l’immagine (vedi [TikTok](./canali/tiktok.md)) | 4.000 | 6 |
| X (x) | una sola idea: testo e hashtag insieme al massimo 280 caratteri | 280 | 2 |
| Pinterest (pinterest) | la descrizione del pin, da 150 a 400 caratteri: dice cosa si trova e perché salvarlo, con le parole che la gente cerca (Pinterest è un motore di ricerca); il titolo del pin è headline, fino a 100 caratteri | 500 | 3 |

Si scrive solo per i canali del contenuto. L’utente può correggere a mano i testi: quando riprendi un contenuto, parti dai testi com’è salvato.

## Formati e proporzioni

Ogni canale ha le sue proporzioni, e non tutti reggono tutti i formati:

| Formato | LinkedIn | Instagram | Facebook | TikTok | X | Pinterest |
| --- | --- | --- | --- | --- | --- | --- |
| Post: la copertina | 1:1 | 4:5 | 4:5 | 9:16 | 16:9 | 2:3 |
| Carosello: le slide | 4:5, e moonbrand ne fa il documento PDF | 4:5 | 4:5 | 9:16 (photo mode) | non c’è | non c’è |
| Articolo: la copertina | 16:9 | 4:5 | 4:5 | non c’è | 16:9 | 2:3 |
| Video | 4:5 | 9:16 | 9:16 | 9:16 | 16:9 | 9:16 |

Si fa un’uscita per ogni proporzione diversa tra i canali del contenuto, nella confezione dei suoi canali (vedi sotto): non si ritaglia, si reimpagina. Due canali nella stessa proporzione ma con confezioni diverse hanno ciascuno i suoi file: quelli fatti apposta per un canale si salvano con channel, quelli senza channel valgono per gli altri canali di quella proporzione.

- **Post**: testo e un’immagine. headline è il titolo dell’immagine, fino a 60 caratteri, se l’immagine ne ha uno; slides resta vuoto.
  Immagini: la copertina, una per proporzione: role «cover», index da 0.
- **Carosello**: da 5 a 7 slide. La prima è l’aggancio, le centrali sviluppano un punto ciascuna, l’ultima chiude con un’azione; titoli fino a 40 caratteri, testi fino a 160. headline è il titolo della prima slide.
  Immagini: un giro di slide per proporzione, con le stesse slide e gli stessi index: role «slide», index da 0. In 9:16 (TikTok) tieni i testi lontani dai bordi, che l’app copre in basso e a destra. Su LinkedIn il carosello si pubblica come documento: il PDF lo fa moonbrand dalle slide 4:5, tu non devi farlo.
- **Articolo**: su LinkedIn il testo lungo, con un’apertura forte e tre o quattro paragrafi; sugli altri canali un testo breve che lo presenta. headline è il titolo dell’articolo; slides resta vuoto.
  Immagini: la copertina, una per proporzione (16:9 per LinkedIn e X, 4:5 per Instagram e Facebook, 2:3 per Pinterest): role «cover», index da 0. Su Pinterest il pin porta al sito del brand.
- **Video**: si fa con la skill moonbrand:video; i testi per canale seguono le regole di questa skill, come didascalie del video. headline è il titolo del video, se ne ha uno; slides resta vuoto; script e scenes sono il copione.
  File: per ogni proporzione il video in MP4 con role «video» e la sua copertina con role «cover», stessa proporzione e stesso index, da 0.

Le immagini finali sono PNG o JPEG, i video MP4.

## La confezione per canale

L’idea, le foto e le clip sono le stesse su tutti i canali; la confezione no. Su ogni canale il contenuto deve sembrare nato lì, e restare riconoscibile come del brand.

Se tra i canali del contenuto c’è TikTok, prima di scegliere l’idea, scrivere il copione o fare le slide leggi [TikTok](./canali/tiktok.md): è la guida del canale e vale anche quando TikTok è insieme ad altri canali.

| Canale | La confezione |
| --- | --- |
| Instagram | curata ed editoriale, con la grafica del brand: palette, font, logo. La copertina di un Reel si vede anche ritagliata al centro in 4:5 nella griglia del profilo: titolo e soggetto stanno lì. Un carosello si salva se ogni slide porta un punto utile. |
| Facebook | la stessa di Instagram: di solito i file sono gli stessi. |
| TikTok | nativa, come la fa chi usa l’app: riprese vere a tutto schermo, una frase scritta come la scrive l’app dal primo secondo, niente grafiche montate e niente logo finale. Come si fa, per video e photo mode: [TikTok](./canali/tiktok.md). |
| LinkedIn | sobria e leggibile: titoli chiari, dati e concetti in primo piano, poca decorazione, il logo discreto. |
| X | un’immagine sola con un messaggio solo, leggibile anche piccola. |
| Pinterest | un pin verticale da salvare: una foto bella e luminosa che occupa quasi tutto, un titolo grande e chiaro sull’immagine che dice cosa si trova (un’idea, una guida, una ricetta, un prodotto), leggibile anche come miniatura nella griglia; il nome o il logo del brand piccolo in basso. Contenuti che durano nel tempo più che notizie del giorno. |

- Sotto «Lo stile», in CLAUDE.md, la voce «Per canale» dice come si presenta il brand su ciascun canale nei suoi riferimenti: seguila per palette, font e quanta grafica usare. La confezione del canale (dove sta il testo, come si aggancia, come si chiude) resta quella di questa tabella.
- Instagram e Facebook condividono i file. TikTok ha i suoi anche quando la proporzione è la stessa, come il video 9:16 accanto al Reel: salvali con channel «tiktok». Pinterest ha i suoi in 2:3; il suo video 9:16 è lo stesso del Reel.
- Se l’utente chiede la stessa confezione per tutti i canali, fai come chiede.

## Immagini

- Prima di fare immagini o video leggi [Il mestiere](./mestiere.md): come lavora un grafico social e i segni che tradiscono l’AI, da non usare.
- Le chiamate che non dipendono l’una dall’altra (più genera_immagine, più renderizza, i controlli con guarda) falle nello stesso messaggio: girano insieme e finiscono nel tempo della più lenta.
- Immagini e video li guarda il motore di visione con il tool guarda, che ti risponde a parole: usalo per riferimenti, allegati, contenuti già fatti e controlli. Apri tu un’immagine solo quando devi correggere un’impaginazione e la descrizione non basta: ogni immagine che apri resta nella conversazione fino alla fine.
- I post in riferimenti-da-seguire, e se servono le immagini in file-riferimento, sono spunti e guida per lo stile del brand: palette, font, tono delle foto, dettagli grafici, cura. Di solito sono già descritti in CLAUDE.md, sotto «Lo stile»: parti da lì. Se quella parte manca, chiedi a guarda proprio queste cose. Non ricalcarne l’impaginazione e non copiare i file HTML o CSS degli altri contenuti.
- Se in CLAUDE.md c’è «Il template», il brand ha scelto un template di moonbrand: per i canali curati i layout in template/layout/ sono il suo sistema grafico e si copiano e riempiono, come dice quella sezione. Vale più dei riferimenti; le regole del mestiere restano.
- Lo stile si prende solo da lì: le cartelle esempi e lavoro alla radice del brand, se ci sono, sono bozze dell’onboarding che possono essere state scartate; non aprirle e non usarle.
- Scegli la composizione che serve a questa idea e alternala: le impaginazioni degli ultimi contenuti sono in CLAUDE.md, e con guarda descrivi solo le immagini finali dei contenuti recenti che lì mancano. Usa un’impaginazione diversa. Ogni contenuto deve essere riconoscibile come del brand e diverso dagli altri.
- Quando salvi un contenuto, scrivi nel campo layout la sua impaginazione in una frase: la leggeranno i contenuti dopo.
- Le immagini si fanno in HTML e CSS e si esportano con il tool renderizza, che conosce già misure e browser: passagli insieme tutte le uscite di un contenuto (le copertine delle varie proporzioni, le slide).
- renderizza misura da solo testi tagliati o fuori bordo, font non caricati, immagini rotte e testi sovrapposti: correggi prima quelli «Da correggere», che costano millisecondi. Quelli «Da valutare» possono essere scelte.
- Il giudizio che il DOM non dà (cosa copre cosa, equilibrio, leggibilità sulla foto, colori del brand) chiedilo nella domanda di renderizza, che fa guardare l’immagine appena fatta al motore di visione: così render e controllo sono una chiamata sola. Nessuna immagine si consegna senza questo controllo.
