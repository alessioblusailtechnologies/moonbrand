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
    parrucchieri.md         ← caricato solo per i brand di quella categoria
    ristorazione.md
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

Per ogni categoria c'è un `.md` che **il sistema carica programmaticamente** in base al brand: non lo sceglie
l'agente. Contiene, per canale:

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

- **La categoria del brand.** Oggi `identity.sector` è testo libero («Panificio artigianale»). Serve un elenco chiuso
  di categorie (una decina: ristorazione, beauty, negozio, e-commerce, SaaS e tech, professionisti, salute e fitness,
  creator, agenzia, turismo, sport). Il job `website` la assegna nell'onboarding accanto a `sector`; l'utente la può
  correggere nelle Impostazioni del brand.
- **Il file nel contesto.** `writeBrandGuide` (`src/lib/brand-guide.ts`) riscrive il `CLAUDE.md` del brand prima di
  ogni job: lì si aggiunge la guida della categoria (copiata nella cartella del brand o richiamata per percorso), così
  vale per i job e per la chat allo stesso modo.
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

## Come si ricavano le guide

Non da skill pubbliche ma da contenuti reali forti, una categoria alla volta:

- circa 50 contenuti per categoria (circa 35 video e 15 caroselli in photo mode), da account di quella categoria,
  degli ultimi 6-12 mesi;
- forti **rispetto al proprio account** (visualizzazioni contro follower), con qualche contenuto andato male degli
  stessi account per contrasto;
- di ognuno si analizzano fotogrammi, testo a schermo, voce, ritmo dei tagli, durata, chiusura e didascalia;
- la guida del canale nasce dalle parti comuni a tutte le categorie, quella di categoria da ciò che le distingue.

Si parte da due categorie molto diverse tra loro (la prima: parrucchieri, dove ci sono già scraper, template e la prova
F come termine di confronto), per verificare che la guida del canale regga per tutti.

## Come si misura

Stesso brand e stessa idea, prima e dopo, con il confronto già usato nelle prove del 7/10 (giudice «nativo su 10»,
costo, tempo). Se il salto si vede, si passa alle altre categorie e poi a Instagram.
