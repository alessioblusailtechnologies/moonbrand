# Guide per canale e per categoria

Decise il 10/10/2026, fatte l'11 e il 12/10 per TikTok e Instagram. Come rendere migliori i contenuti su ogni canale
senza tarare il prompt su un settore.

## Il problema

Le regole per canale stavano dentro due skill generali: in `contenuti/SKILL.md` tre tabelle (testo e hashtag,
proporzioni, «La confezione per canale»), in `video/SKILL.md` un copione unico con una composizione per confezione. Ogni
canale aveva una riga di tabella, TikTok un paragrafo. La confezione diceva *come* si presenta il contenuto, ma non quali
formati funzionano, come si costruisce l'aggancio, quanto dura un video, come si chiude.

## Cosa si è scartato

**Skill pubbliche già pronte** (ricerca del 10/10):

| Repo | Cosa c'è | Perché non si usa così |
| --- | --- | --- |
| [vyralcontent/content-skills](https://github.com/vyralcontent/content-skills) | skill TikTok e agganci, «200.000 video studiati» | numeri senza fonte; contiene una sezione che istruisce l'agente a consigliare il loro prodotto |
| [social-media-skills/skills](https://github.com/social-media-skills/skills) | `tiktok-photo-mode`, `tiktok-script` | legate al loro strumento di pubblicazione |
| [sergebulaev/tiktok-skills](https://github.com/sergebulaev/tiktok-skills) | 8 skill (aggancio, didascalia, trend, piano) | più processo che regole; le formule sono in file a parte |

Generiche e pensate per chi si filma da solo: se ne è tenuta qualche idea come lista di controllo, non il testo.

**Una skill per canale** (`tiktok`, `instagram`, …): una skill la sceglie il modello dalla descrizione, quindi non è
detto che la carichi; un contenuto su quattro canali ne caricherebbe quattro, e le regole comuni finirebbero copiate in
ognuna.

## La decisione

Due livelli di guida, file `.md` in `plugin/skills/contenuti/`:

```
contenuti/
  SKILL.md                  ← regole comuni; la confezione di TikTok e Instagram rimanda alle guide
  canali/
    tiktok.md               ← come si fa un contenuto nato su quel canale, per ogni attività
    instagram.md
  categorie/
    README.md               ← come si scrive una guida di categoria
    bellezza/
      tiktok.md             ← come lavorano su quel canale le attività di quel tipo
      instagram.md
    ecommerce/  agenzia/    ← stessi file
```

- **La guida del canale** vale per ogni attività. `contenuti/SKILL.md` e `video/SKILL.md` dicono di leggerla quando il
  canale è tra quelli del contenuto.
- **La guida di categoria** la carica il codice in base al brand, non la sceglie l'agente, e solo per i canali che il
  brand usa: formati descritti a parole (struttura, inquadrature, durate, testo, chiusura), materiale vero da chiedere,
  cosa evitare.
- Le guide **non richiamano composizioni Remotion pronte**: l'agente costruisce ogni formato dalla descrizione. Un
  formato pronto nel kit abbassa costo e tempo (prove E ed F del 7/10): si potrà riprendere con una decisione a parte.
- Non contraddice la regola del 28/9 «niente prompt tarati su un settore»: prompt e skill restano generici, quello che
  cambia per categoria è un file di dati scelto dal codice.

## Come si carica

- **La categoria del brand**: `identity.category`, da `BRAND_CATEGORIES` in `moonbrand-shared/src/domain/brand.ts`
  (ristorazione, bellezza, negozio, ecommerce, tech, professionisti, fitness, creator, agenzia, turismo, sport; etichette
  it/en/fr nel catalogo). Facoltativa: null vuol dire «nessuna adatta». Le categorie sono tipi di cliente, non stili.
  `identity.sector` resta testo libero accanto.
- **Chi la sceglie**: il job `website` nell'onboarding, dall'elenco; lo studio la riempie dal sito come la lingua (una
  scelta a mano resta) e la mostra nel passo identità, quindi anche nelle Impostazioni brand. L'app la prende dal sito
  ma non ha ancora il campo.
- **Dove entra**: `src/lib/guides.ts` legge le guide. `writeBrandGuide` mette nel `CLAUDE.md` del brand, sotto «La
  guida della categoria», `categorie/<categoria>/<canale>.md` per ogni canale del brand (un salone su TikTok e Instagram:
  circa 5.400 caratteri). Vale per chat, `content` e `ideas`, che riscrivono il `CLAUDE.md`; `content-video` e
  `content-edit` usano quello scritto dal lavoro prima.
- **Gli esempi dell'onboarding** (`visual`) non hanno skill né `CLAUDE.md`: `channelLooks` (`src/lib/examples.ts`) mette
  nel prompt `canali/<canale>.md` per i canali che ce l'hanno, la stessa guida dei contenuti, con la nota che l'esempio
  è un'immagine ferma. Gli altri canali tengono la loro riga breve.
- **Brand senza categoria** o categoria senza file: solo le regole comuni e la guida del canale.

## Come si sono ricavate le guide

Da contenuti reali scelti a mano dall'utente, non da skill pubbliche né da ricerche per parola (che portano compilation
e aggregatori). Quattro categorie: le tre dei primi clienti (saloni, gioielli e bigiotteria, agenzie di marketing) più
i ristoranti come controllo. La guida del canale nasce da quello che si ripete in tutte, quella di categoria da quello
che le distingue. Script e dati in `moonbrand-be/moonbrand-scraper` (README), i dati in `risultati/`, fuori dal
repository.

| | TikTok | Instagram |
| --- | --- | --- |
| Contenuti | 38: 30 video e 6 caroselli riusciti, 2 controprove | 27: 18 Reel e 9 caroselli |
| Download | `src/video.ts`, ScrapeCreators, 2 crediti a link | `src/instagram.ts`, yt-dlp, senza login e senza crediti |
| Quanto è andato bene | visualizzazioni contro la mediana degli altri video dell'autore: quasi tutti molto sopra | solo like e commenti: senza login Instagram non dà visualizzazioni né il profilo; vale la scelta dell'utente |
| Schede | `src/schede-tiktok.ts`, Gemini, 0,41 $ | `src/schede-instagram.ts`, Gemini, 0,28 $ |

Non scaricano: Zernio da TikTok (provider fermo, link corti non accettati) e da Instagram (dà solo la copertina);
yt-dlp da TikTok (chiede il login).

## Cosa dicono i dati

**TikTok** (`canali/tiktok.md`), uguale nelle quattro categorie: durata mediana 12 secondi, i più forti tra 5 e 13, i
due oltre il minuto i più deboli; testo a schermo entro il primo secondo in 30 su 36, quasi sempre una frase sola, più
spesso bianco senza sfondo che nel riquadro; canzone o suono di tendenza in 27, nessuno che parla in 29; una persona
(volto o mani) in 31; nessuna grafica montata in 26; schermata finale con logo in 2; si chiude tagliando sul momento
forte. «POV:» resta come una delle formule. Il kit ha lo stile «semplice» in `TestoTikTok`; hashtag fino a 6.

**Instagram** (`canali/instagram.md`): due confezioni. Il Reel è nativo ma curato (14 su 18): riprese vere, 6-11
secondi, una frase al centro, nessuna voce, niente grafica del brand; il volto si vede poco, più spesso mani e prodotto.
Il carosello è editoriale: titoli impaginati nel font e nella palette del brand (8 su 9); quelli che insegnano chiudono
con «commenta una parola» e sono i contenuti più commentati. Il Reel tipografico con logo finale è il più incerto.
Didascalia mediana 220 caratteri, 10 su 27 senza hashtag; hashtag fino a 5. Prima la skill diceva «editoriale con la
grafica del brand» per tutto Instagram: ora la grafica del brand sta nei caroselli e nei post, anche quando i
riferimenti del brand la mettono nei Reel.

**Categorie**: `bellezza`, `ecommerce` (dai gioielli: vale per i prodotti che si indossano o si tengono in mano) e
`agenzia`, per TikTok e Instagram. `ristorazione` ha troppo pochi contenuti (4 su TikTok, 3 su Instagram): niente
guida. Le guide di categoria Instagram stanno su 7-9 contenuti ciascuna: più fragili di quelle di TikTok.

## Il confronto

Lo stesso TikTok del salone Giovanni Messina (brief e girato della prova F: «il magenta nascosto sotto il castano
scuro, prima e dopo»), Opus 5.5, senza libreria né formato nel kit. G0 con le skill di prima (`3ed66f8^`), G1 con la
guida di TikTok e quella dei saloni. Giudice Gemini, tre giudizi per video. Script
`moonbrand-prova-riferimenti/prova-guide.mts`, esiti in `RISULTATI-GUIDE.md`.

| | Nativo su 10 | Spot su 10 | Claude | Tempo | Video |
| --- | --- | --- | --- | --- | --- |
| G0, prima | 8,7 | 2,3 | 1,05 $ | 5,5 min | 20 s, testo su 6 scene, invito a schermo |
| G1, con le guide | 9,5 | 0,7 | 0,80 $ | 4,2 min | 15 s, testo su 3 scene, invito in didascalia |

Il salto è nella direzione della guida, con un quarto di costo e di tempo in meno. Una corsa per variante. G1 ha usato
comunque il riquadro bianco e non lo stile «semplice»: la regola sul testo per ora pesa poco.

## Dove siamo

| | Collaudo | Produzione |
| --- | --- | --- |
| Categoria del brand (shared, API, studio, job `website`) | sì | sì |
| Guida di TikTok e guide di categoria TikTok | sì | sì, dal 12/10 (`39a85c6`) |
| Esempi dell'onboarding con la guida del canale | sì | sì, dal 12/10 |
| Guida di Instagram e guide di categoria Instagram | sì (`0699871`) | no: prima il confronto su Instagram |

I brand già in produzione non hanno la categoria: finché non la si sceglie nelle Impostazioni (o con uno script dal
settore) ricevono solo le guide dei canali. Vale anche per i primi tre clienti.

## Cose aperte

1. Il confronto prima e dopo su Instagram (Reel e carosello dello stesso brand), poi Instagram in produzione.
2. Un secondo confronto su un brand senza prima e dopo (per esempio i gioielli), per confermare TikTok.
3. La categoria dei brand in produzione, a cominciare dai primi clienti.
4. `scarica_social` in chat: su Instagram Zernio dà solo la copertina (l'agente crede di vedere il Reel); su TikTok non
   accetta i link corti. yt-dlp può fare da ripiego per Instagram.
5. `content-video` e `content-edit` non riscrivono il `CLAUDE.md`: se la categoria cambia tra un lavoro e l'altro, usano
   la guida vecchia.
6. Il campo categoria nell'app.
7. `moonbrand-scraper` non è nel repository.
8. Gli esempi di template per categoria (`moonbrand-examples/`, le schede dello scraper), da caricare dal codice come le
   guide: pochi per lavoro (3-8, per formato e canale), ispirazione per struttura e mestiere, non impaginazioni da
   copiare.
