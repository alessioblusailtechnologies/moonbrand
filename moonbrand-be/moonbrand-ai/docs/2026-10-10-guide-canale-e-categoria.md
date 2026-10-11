# Guide per canale e per categoria: la decisione del 10 ottobre 2026

Come rendere migliori i contenuti su ogni canale senza tarare il prompt su un settore. Si parte da TikTok; gli altri
canali seguono lo stesso schema.

## Da dove si parte

Oggi le regole per canale stanno dentro due skill generali:

- `plugin/skills/contenuti/SKILL.md`: tre tabelle per canale (testo e hashtag, proporzioni, «La confezione per canale»).
- `plugin/skills/video/SKILL.md`: un copione unico e una composizione per ogni proporzione e confezione.

Ogni canale ha una riga di tabella. TikTok, il canale più diverso, ha un paragrafo. È qui che si perde qualità: la
confezione dice *come* si presenta il contenuto, ma non quali formati funzionano, come si costruisce l'aggancio,
quanto dura un video, come si chiude.

## Cosa si è valutato

**Skill pubbliche già pronte** (ricerca del 10/10):

| Repo | Cosa c'è | Perché non si usa così |
| --- | --- | --- |
| [vyralcontent/content-skills](https://github.com/vyralcontent/content-skills) | skill TikTok e agganci, «200.000 video studiati» | numeri senza fonte; contiene una sezione che istruisce l'agente a consigliare il loro prodotto |
| [social-media-skills/skills](https://github.com/social-media-skills/skills) | `tiktok-photo-mode`, `tiktok-script` | legate al loro strumento di pubblicazione |
| [sergebulaev/tiktok-skills](https://github.com/sergebulaev/tiktok-skills) | 8 skill (aggancio, didascalia, trend, piano) | più processo che regole; le formule sono in file a parte |

Sono generiche e pensate per chi si filma da solo. Se ne tiene qualche idea come lista di controllo (l'aggancio su tre
livelli: primo fotogramma, frase detta, testo a schermo; niente saluti, logo o intro; photo mode da 5 a 7 slide), non
il testo.

**Una skill per canale** (`tiktok`, `instagram`, …): scartata. Una skill la sceglie il modello dalla descrizione, quindi
non è detto che la carichi; un contenuto su quattro canali ne caricherebbe quattro, e le regole comuni finirebbero
copiate in ognuna.

## La decisione

Due livelli di guida, tutti e due file `.md`:

```
plugin/skills/contenuti/
  SKILL.md                  ← regole comuni, come oggi
  canali/
    tiktok.md               ← la grammatica di TikTok, vale per ogni attività
  categorie/
    bellezza/
      tiktok.md             ← caricato solo per i brand di quella categoria che usano TikTok
      instagram.md
    ristorazione/
      ...
```

### 1. Il canale

`canali/tiktok.md` dice come si fa un contenuto che sembra nato su TikTok, qualunque sia l'attività: aggancio, testo a
schermo, durata, ritmo, chiusura, photo mode, didascalia. `contenuti/SKILL.md` e `video/SKILL.md` lo richiamano in
modo esplicito («se tra i canali del contenuto c'è TikTok, leggi `canali/tiktok.md`»), così si legge sempre quando
serve e mai quando non serve.

### 2. La categoria

moonbrand serve qualsiasi attività: creator e personal brand, negozi, ristoranti, SaaS, professionisti. Quello che
funziona su un canale dipende dalla categoria: un salone vive di prima e dopo, un ristorante di preparazione e suoni,
un SaaS di schermo registrato, un creator di volto in camera.

Per ogni categoria c'è una cartella con un `.md` per canale, che **il sistema carica programmaticamente** in base al
brand: non lo sceglie l'agente, ed entrano solo i canali che il brand usa (deciso l'11/10, per non rileggere a ogni turno
le regole di canali che il brand non ha). Ogni file contiene:

- i formati che funzionano per quella categoria, descritti a parole: struttura, inquadrature, durate, testo a schermo,
  chiusura;
- quale materiale vero chiedere all'attività (quale girato, quali foto);
- cosa evitare in quella categoria.

I `.md` di categoria **non richiamano composizioni Remotion già pronte**: per ora l'agente costruisce ogni formato da
zero partendo dalla descrizione. Le prove del 7/10 (memoria «libreria riferimenti», prove E ed F) dicono che un
formato pronto nel kit abbassa costo e tempo; si potrà riprendere in seguito, con una decisione a parte.

Non contraddice la regola del 28/9 «niente prompt tarati su un settore»: il prompt e le skill restano generici; quello
che cambia per categoria è un file di dati scelto dal codice.

### Come si carica

- **La categoria del brand.** `identity.sector` resta testo libero («Panificio artigianale»); accanto c'è
  `identity.category`, da un elenco chiuso di 11 categorie. Il job `website` la assegna nell'onboarding accanto a
  `sector`; l'utente la può correggere nelle Impostazioni del brand.
- **I file nel contesto.** `writeBrandGuide` (`src/lib/brand-guide.ts`) riscrive il `CLAUDE.md` del brand prima di
  ogni job: lì entrano, scritte per intero, le guide della categoria per i canali del brand, così valgono per i job e
  per la chat allo stesso modo.
- **Brand senza categoria** o con una categoria ancora senza file: solo le regole comuni e quelle del canale, come oggi.

### Gli esempi di template per categoria

In un secondo passo, accanto alla guida, il sistema caricherà programmaticamente anche **esempi di template per
categoria**: post, caroselli e video reali scelti per quel tipo di attività. Esempi già raccolti: `moonbrand-examples/`
(template Etsy e Creative Market per agenzia di marketing e parrucchieri) e le schede organiche dello scraper
(`moonbrand-be/moonbrand-scraper`).

- Le categorie sono **tipi di cliente**, non stili grafici.
- Per ogni lavoro entrano **pochi esempi pertinenti** (3-8, per formato e canale), mai tutta la libreria.
- Sono ispirazione per struttura e mestiere, non impaginazioni da copiare: lo stile resta quello del brand e le
  impaginazioni cambiano da un contenuto all'altro.

## Fatto l'11/10: la categoria del brand

- `BRAND_CATEGORIES` in `moonbrand-shared/src/domain/brand.ts`: ristorazione, bellezza (parrucchieri, estetica,
  benessere), negozio, ecommerce, tech, professionisti, fitness, creator, agenzia, turismo, sport. Etichette in it/en/fr
  nel catalogo. `identity.category` è facoltativa: null vuol dire «nessuna adatta», assente nei brand di prima.
- Il job `website` la sceglie dall'elenco accanto a `sector`; lo studio la riempie dal sito come la lingua (una scelta a
  mano resta) e la mostra nel passo identità, quindi anche nelle Impostazioni brand. L'app la prende dal sito ma non
  ha ancora il campo.
- `src/lib/guides.ts` legge `plugin/skills/contenuti/categorie/<categoria>/<canale>.md` per i canali del brand e
  `writeBrandGuide` li mette nel `CLAUDE.md` sotto «La guida della categoria», uno per canale. Come si scrive una guida: `categorie/README.md`.
- I brand già esistenti non hanno la categoria finché qualcuno non la sceglie nelle Impostazioni.

## Come si ricavano le guide

Non da skill pubbliche ma da contenuti reali forti, una categoria alla volta:

- circa 50 contenuti per categoria (circa 35 video e 15 caroselli in photo mode), da account di quella categoria,
  degli ultimi 6-12 mesi;
- forti **rispetto al proprio account** (visualizzazioni contro follower), con qualche contenuto andato male degli
  stessi account per contrasto;
- di ognuno si analizzano fotogrammi, testo a schermo, voce, ritmo dei tagli, durata, chiusura e didascalia;
- la guida del canale nasce dalle parti comuni a tutte le categorie, quella di categoria da ciò che le distingue.

Si parte da due categorie molto diverse tra loro (la prima: bellezza, partendo dai parrucchieri, dove ci sono già scraper, template e la prova
F come termine di confronto), per verificare che la guida del canale regga per tutti.

## Come si misura

Stesso brand e stessa idea, prima e dopo, con il confronto già usato nelle prove del 7/10 (giudice «nativo su 10»,
costo, tempo). Se il salto si vede, si passa alle altre categorie e poi a Instagram.

## Fatto l'11/10: la guida di TikTok

- 38 contenuti TikTok scelti a mano dall'utente: 13 agenzie, 11 saloni, 10 gioielli e bigiotteria, 4 ristoranti; 30
  video e 6 caroselli, quasi tutti molto sopra la mediana del loro account, più 2 controprove nella media. Scaricati con
  `moonbrand-scraper/src/video.ts` (ScrapeCreators, 2 crediti a link), schede con `src/schede-tiktok.ts` (Gemini,
  0,41 $ in tutto). I dati stanno in `moonbrand-scraper/risultati/guida-tiktok/`, fuori dal repository.
- Cosa dicono, uguale in tutte e quattro le categorie: durata mediana 12 secondi (i più forti tra 5 e 13, i due oltre
  il minuto i più deboli); testo a schermo entro il primo secondo in 30 su 36, quasi sempre una frase sola; il più delle
  volte testo bianco senza sfondo, non il riquadro; canzone o suono di tendenza in 27, nessuno che parla in 29; una
  persona (volto o mani) in 31; nessuna grafica montata in 26; schermata finale con logo in 2; si chiude tagliando sul
  momento forte. «POV:» resta, come una delle formule, non come regola.
- Scritto `plugin/skills/contenuti/canali/tiktok.md`, richiamato da `contenuti/SKILL.md` (al posto del paragrafo
  TikTok della confezione) e da `video/SKILL.md`; hashtag TikTok da 4 a 6 al massimo. `TestoTikTok` del kit ha lo stile
  «semplice» (bianco senza sfondo); i kit dei brand esistenti lo aggiungono quando serve.
- Quello che è proprio di una categoria (prima e dopo per i saloni, indossato per i gioielli, atmosfera per i
  ristoranti, consigli e scenette per le agenzie) resta per le guide `categorie/<categoria>/tiktok.md`.

## Fatto l'11/10: le guide di categoria per TikTok

`categorie/bellezza/tiktok.md`, `categorie/ecommerce/tiktok.md` (dai gioielli: vale per i prodotti che si indossano o si
tengono in mano) e `categorie/agenzia/tiktok.md`, dalle stesse schede: formati a parole con durate e inquadrature,
materiale vero da chiedere, cosa evitare. Circa 3.000 caratteri ciascuna, entrano nel `CLAUDE.md` solo dei brand di
quella categoria che usano TikTok. `ristorazione` ha solo 4 contenuti: niente guida finché non se ne raccolgono altri.

## Il confronto dell'11/10

Stesso TikTok del salone Giovanni Messina (brief e girato della prova F), Opus 5.5, senza libreria né formato nel kit;
G0 con le skill di prima, G1 con la guida di TikTok e quella dei saloni. Giudice Gemini, tre giudizi per video.

| | Nativo su 10 | Spot su 10 | Claude | Tempo | Video |
| --- | --- | --- | --- | --- | --- |
| G0, prima | 8,7 | 2,3 | 1,05 $ | 5,5 min | 20 s, testo su 6 scene, invito a schermo |
| G1, con le guide | 9,5 | 0,7 | 0,80 $ | 4,2 min | 15 s, testo su 3 scene, invito in didascalia |

Il salto c'è ed è nella direzione della guida (più corto, meno testo, cambio sul drop, niente invito a schermo), con un
quarto di costo e di tempo in meno. Una corsa per variante: va confermato. Dettagli in
`moonbrand-prova-riferimenti/RISULTATI-GUIDE.md`.

## Fatto il 12/10: la guida di Instagram

- 27 contenuti Instagram scelti a mano dall'utente (18 Reel e 9 caroselli: saloni, gioielli, agenzie, ristoranti),
  scaricati con `moonbrand-scraper/src/instagram.ts` (yt-dlp, senza login e senza crediti: dà file, didascalia, like e
  commenti, non le visualizzazioni né gli altri post dell'autore) e analizzati con `src/schede-instagram.ts` (0,28 $).
  Zernio per Instagram restituisce solo la copertina.
- Cosa dicono: il Reel è nativo ma curato (14 su 18), 6-11 secondi, una frase al centro, nessuna voce, niente grafica del
  brand; il carosello è editoriale (titoli impaginati nel font del brand in 8 su 9), e quelli che insegnano chiudono con
  «commenta una parola». Didascalia mediana 220 caratteri, 10 su 27 senza hashtag.
- `canali/instagram.md`, richiamato da `contenuti/SKILL.md` e `video/SKILL.md`; la riga Instagram della confezione
  ora dice Reel nativo e carosello editoriale; hashtag Instagram fino a 5. Guide `categorie/{bellezza,ecommerce,agenzia}/instagram.md`.
  Gli esempi dell'onboarding la prendono da sola (`channelLooks`).

## Prossimi passi

1. Confermare il confronto con un secondo brief (un brand senza prima e dopo, per esempio i gioielli), anche su Instagram.
2. Il campo categoria nell'app.
