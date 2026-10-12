# Template di post dai modelli Etsy e Creative Market

12/10/2026. Come nascono i template che il brand sceglie nell'onboarding o nelle Impostazioni, e com'è ogni template
rispetto al modello da cui viene. Il contratto tecnico è in `plugin/templates/README.md`.

## Cosa sono

Un template è un riferimento di stile per una categoria di attività: impaginazione, tipografia, segni grafici, tono delle
foto e dei testi. Il brand ne sceglie uno in alternativa alle immagini di riferimento (`visual.template`); se la sua
categoria non ne ha, lo studio avvisa che arriveranno e si caricano le immagini come prima.

Il template non è un modulo da riempire. Ogni post, negli esempi dell'onboarding e nei contenuti, è una composizione
nuova in quello stile, con i colori, i font, il logo e i soggetti del brand. Chi guarda deve riconoscere il brand, non
il template.

## Come ci siamo arrivati

1. **11/10, disegnati da zero.** Sei template nostri, «senza segni da AI», con le gallerie di `moonbrand-examples/` solo
   come ispirazione. Bocciati dall'utente: sembravano fatti da un'AI.
2. **11/10, rifatti fedeli ai modelli.** Per ogni categoria tre set reali scelti dal provino delle copertine, ricostruiti
   in HTML con la stessa impaginazione e gli stessi segni grafici; testi italiani, foto vere di stock, font uguali o
   più simili.
3. **12/10, prima prova dell'utente.** Due problemi: gli esempi «annullavano il brand» (colori e font del template, niente
   logo) ed erano uguali al template con i testi cambiati. Da qui:
   - i font del brand letti dal sito e messi nei layout (`--font-titoli`, `--font-testo`);
   - gli elementi di evidenza dei layout sui colori del brand (accento e secondario), senza obbligo di usarli tutti;
   - il logo della bozza nella cartella degli esempi;
   - il template come riferimento di stile: composizioni nuove, mai un layout con i testi cambiati.
4. **12/10, tutti i set di agenzia.** I 24 set di `agenzia-marketing/` rimasti, un agente per set, otto alla volta.
   Nessuno scartato: anche i set fatti di mockup avevano almeno una griglia di slide piatte leggibili. Ogni agente ha
   scelto il nome e creato la cartella da solo (`mkdir` senza `-p`, così due agenti non prendono lo stesso nome);
   catalogo, descrizioni e doc li ha scritti chi li ha lanciati, dagli esiti. I set di parrucchieri restano da fare.

## Il procedimento

Per un template nuovo:

1. **Scegliere il modello.** Dalle gallerie in `moonbrand-examples/<categoria>/` (Etsy, Creative Market) si fa un provino
   con le copertine e si sceglie un set curato, diverso dagli altri della stessa categoria. Il link è in `fonti.txt`.
2. **Catalogo.** Id, categoria e nome in `moonbrand-shared/src/domain/templates.ts`, descrizione nelle tre lingue in
   `moonbrand-shared/src/i18n/messages/catalog.ts` (`templates`).
3. **Ricostruzione, un agente per template.** L'agente legge `plugin/templates/README.md` e `skills/contenuti/mestiere.md`,
   guarda tutte le immagini del set, sceglie da 6 a 8 slide utili per la categoria e le rifà in HTML 4:5:
   - impaginazione, proporzioni, margini e segni grafici come l'originale, anche quelli che il mestiere elenca tra i
     segni da AI (sono la mano di un grafico vero); niente di aggiunto;
   - colori del modello mappati su `--principale`, `--secondario`, `--accento`, `--sfondo` (la palette demo è quella
     dell'originale); gli elementi di evidenza su accento e secondario, non su bianco e nero fissi;
   - font uguali se sono su Google Fonts, altrimenti i più simili, con titoli e testi nelle due variabili;
   - testi in italiano per un'attività finta, foto vere di Unsplash o Pexels con le fonti in `esempio/FONTI.txt`
     (Gemini solo se non si trova niente; non è servito);
   - `TEMPLATE.md` con origine, carattere, tipografia, griglia, colori, segni ricorrenti, layout, cose da non fare.
4. **Controllo.** `npm run template-anteprime -- <id>` rende i layout con lo stesso Chrome e gli stessi controlli dei
   contenuti, controlla TEMPLATE.md e i blocchi di colori e font, e copia le anteprime piccole nello studio.
   `npm run template-anteprime -- <id> --prova` li rende con un brand finto molto diverso (blu notte, blu, arancio,
   bianco; Sora e Work Sans): il brand si deve riconoscere. L'agente confronta ogni anteprima con la slide originale.
5. **Layout nel catalogo**, nell'ordine in cui lo studio li mostra (il primo è la copertina).

## Licenza

Riprodurre impaginazione e sistema grafico di template venduti e offrirli nell'app probabilmente va oltre la licenza
di Etsy e Creative Market, che di solito copre l'uso per la propria attività. Testi, foto e font sono nostri o liberi;
la composizione è dei venditori. Da valutare prima della produzione.

## Com'è ogni template rispetto al modello

Le differenze comuni a tutti:

- **Testi** in italiano, per un'attività finta; nessun testo inglese copiato.
- **Foto** vere da Unsplash o Pexels al posto di quelle del modello, scelte per tono; massimo 1600 px di lato.
- **Colori e font** passano da variabili: nell'anteprima demo sono quelli del modello, con un brand diventano i suoi.
  Alcuni elementi che nel modello erano bianchi o neri ora prendono accento o secondario.
- **Trattini lunghi** e testi che escono dal bordo tolti, perché `renderizza` li segna da correggere.
- **Nessun colore fisso** per fumetti, bottoni, icone e fasce: anche dove il modello aveva il blu di un'app o un oro,
  prendono le quattro variabili. Restano fissi solo gli oggetti (metallo, carta, il cursore del telefono).
- **Testi chiari sulle foto** (Diario, Panna, Crema, Adesivi, Tortora): non `--sfondo` ma la sua tinta schiarita,
  `oklch(from var(--sfondo) max(l, 0.93) min(c, 0.06) h)`, così con un brand dallo sfondo scuro restano leggibili.
- **Foto d'esempio** che non si intonano con la palette di un brand non sono un difetto: le foto vere le sceglie chi fa
  il post.
- **Font con `size-adjust`** (Lime, Diario, Panna, Gigante, Adesivi, Ritaglio, Vaniglia): il `@font-face` punta a una
  versione precisa di fonts.gstatic.com; se Google la cambia, il font demo torna al ripiego e va aggiornato l'indirizzo.
- **Unsplash** dal 12/10 blocca la ricerca automatica con un controllo anti-bot: gli id si trovano con una ricerca web,
  `unsplash.com/photos/<id>/download` funziona ancora. Pexels va.

### Agenzia

#### Segnale

- **Modello:** `agenzia-marketing/03`, «signal.studio», https://www.etsy.com/listing/4551567063. Nero e giallo,
  grottesco pesante, dati grandi.
- **Font:** Archivo per i titoli, Inter per i testi, entrambi su Google Fonts come nell'originale.
- **Palette demo:** nero `#0C0C0E`, arancio `#FF9200`, giallo `#FFC915`, crema `#F2EFE8`.
- **Foto:** una (il caso); il modello è quasi tutto tipografico.

| Layout | Slide del modello |
|---|---|
| copertina | «Marketing that actually moves the pipeline.» |
| passi | «A hook that earns the second line.» |
| lista | «Pick one. Do it by Friday.» |
| dato | «73% of B2B buyers research you…» |
| citazione | «Marketing is just being useful in public, on repeat.» |
| offerta | «Want us in your corner?» |
| caso | «Same audience. One clearer offer. Triple the calls.» |
| chiusura | «Save it. Share it. Use it.» |

**Diverso dal modello:**
- il marchio a «S» è diventato un cerchio con l'iniziale del brand;
- le virgolette della citazione sono disegnate in SVG;
- i fondi bianchi di passi e caso sono `--sfondo`;
- la sfumatura è calcolata in oklab, così con colori lontani non diventa grigia;
- slide delle assunzioni lasciata fuori.

**Aperto:** il layout «caso» ha un vuoto ampio a metà pagina.

#### Studio

- **Modello:** `agenzia-marketing/06`, https://www.etsy.com/listing/4447663001 (link da verificare: `fonti.txt` lo dà
  per un'altra cartella con lo stesso numero di immagini). Bianco e nero editoriale, architettura, asterisco.
- **Font:** Instrument Sans al posto di Helvetica Now o Neue Haas, che non sono su Google Fonts. Inter Tight era più
  simile ma è un font di ripiego dell'AI.
- **Palette demo:** nero e bianco. Sulle slide scure le evidenze prendono l'accento, sulle chiare il secondario.
- **Foto:** tre, architettura in bianco e nero e un ritratto.

| Layout | Slide del modello |
|---|---|
| copertina | «Insights Lead The Way…» |
| punto | «The Market Won't Wait» |
| passo | «01 Markets Move In Real Time» |
| dato | «Did You Know 70%» |
| frase | «Measured decisions. Meaningful outcomes.» |
| servizi | «What We Offer» |
| citazione | «#QuoteOfTheDay» |
| persona | «Tech Talk» |

**Diverso dal modello:**
- titoli in minuscolo normale invece dell'Iniziale Maiuscola di ogni parola;
- il numero di «passo» tocca il bordo invece di esserne tagliato;
- la citazione non ha il trattino prima dell'autore;
- in «persona» le righe ripetute dietro la foto vengono dal CSS;
- l'ombra della foto in «persona» è colorata.

**Aperto:** il secondario è il colore delle evidenze sulle slide chiare: con un brand che ha un secondario chiaro va
controllato il contrasto.

#### Lime

- **Modello:** `agenzia-marketing/24`, «Corporate Business», https://www.etsy.com/listing/4565167123. Verde acceso e nero.
- **Font:**
  - Anton per i titoli stretti;
  - Poppins per i testi (sembra lo stesso del modello);
  - Kaushan Script per la cifra scritta a mano;
  - Herr Von Muellerhoff per la parolina dello slogan.

  Il modello non dichiara i suoi font.
- **Palette demo:** nero `#0A0A0A`, verde chiaro `#DBFFB8`, verde `#66BE10`, grigio `#DCDCDC`.
- **Foto:** due, scrivania dall'alto e folla.

| Layout | Slide del modello |
|---|---|
| copertina | «3 TIPS TO LEADERSHIP SUCCESS» |
| risultati | «Third Quarter Track Record» |
| numero | «$18B» |
| lo-sapevi | «DID YOU KNOW?» |
| domanda | «QUESTION / ANSWER» |
| processo | «Business Winning Funnel» |
| recensione | «TESTIMONIAL» |
| slogan | «STAND OUT From THE CROWD» |

**Diverso dal modello:**
- la foto della copertina ha più oggetti sul tavolo;
- nello slogan la folla è in bianco e nero con un'ellisse a colori sulla persona (nel modello aveva un abito verde);
- la parola di sfondo della recensione viene dal CSS;
- la parolina a mano si sovrappone meno al titolo;
- titoli più piccoli, perché reggano font larghi; per Anton un `@font-face` con `size-adjust` tiene la demo uguale.

**Aperto:** il `@font-face` di Anton punta a una versione precisa di fonts.gstatic.com. Se Google la cambia, va
aggiornato.

#### Retino

- **Modello:** `agenzia-marketing/01`, «Nova Studio», https://www.etsy.com/listing/4510090075. Giallo fluo, nero e
  crema, titoli con la fascia dietro, testi monospaziati, foto in bianco e nero a retino.
- **Font:** League Spartan per i titoli e Roboto Mono per i testi e le cifre, entrambi su Google Fonts. Sembrano gli stessi
  del modello, che non dichiara i suoi font.
- **Palette demo:** dai pixel del modello: nero `#141414`, magenta `#EF007A`, giallo fluo `#DEFE14`, crema `#FFFEF1`.
- **Foto:** sette, Unsplash. Cinque diventano a retino nel CSS (classe `.retino`), una resta in bianco e nero, una a colori.

| Layout | Slide del modello |
|---|---|
| copertina | «NOVA STUDIO_» con la griglia dei servizi |
| opinione | «//Unpopular opinion: Pretty doesn't always convert.» |
| storia | «//Meet the founder: My story» |
| caso | «The insane transformation of Astra Studio» |
| risultati | «// Case study» con +90%, +70%, 1, +60% |
| recensione | «// Review [Client love 002]» |
| disponibilita | «Q3 Now booking, last 4 spots left» |
| manifesto | «System built. Brand elevated.» |

**Diverso dal modello:**
- il retino delle foto è fatto dal CSS (punti, contrasto e fusione), così lo prende anche una foto del brand;
- in «copertina» la persona non è scontornata: è una foto su fondo nero fusa in «screen» col fondo;
- in «storia» la persona scontornata è diventata una foto rettangolare che esce dal bordo destro e da quello basso;
- il secondario (magenta) c'è solo nel logo del manifesto, come nel modello;
- le cifre dei risultati sono nel font dei testi, come nel modello (monospaziato);
- la cornice coi pulsanti di Instagram, la finestra del browser e i nastri inclinati del set sono rimasti fuori.

**Aperto:**
- il retino dipende dalla luce della foto: le foto scure diventano macchie nere, servono soggetti chiari o fondi
  contrastati;
- con un principale chiaro il «screen» delle foto sui fondi scuri non funziona più.

#### Affissioni

- **Modello:** `agenzia-marketing/02`, «muse archives», «40 Editable Ad mockup template»,
  https://www.etsy.com/listing/4581540828. Mockup pubblicitari in scena: cartelli, manifesti incollati, cartelloni,
  schede in tasca, bianco e nero con foto vere.
- **Font:** uno per layout come nel modello (set Canva):
  - Montserrat corsivo e Pinyon Script (copertina);
  - Oswald, Playfair Display corsivo, Archivo e Gilda Display (manifesto);
  - Roboto (assumiamo), Lato (squadra, offerta), Noto Serif Display stretto (tasca), Playfair Display corsivo (citazione), Jost (evento).

  Con un brand, titoli e testi diventano i due font del brand; Pinyon Script, Playfair corsivo e Gilda restano come dettaglio.
- **Palette demo:** dai pixel del modello: nero `#1C1C1A`, crema oliva `#D1CEA9` (il «We are hiring»), rosso `#C0322B`
  (il «20% off» di «Out of office»), carta `#ECEBE7`.
- **Foto:** undici, Unsplash: le scene (cartello su palo, pietra, calcare, cemento, muro con passanti, tasca di jeans,
  plastica su nero, galleria), la carta stropicciata e due ritratti.

| Layout | Slide del modello |
|---|---|
| copertina | «Signs you need a rebrand →» sul cartello |
| manifesto | «Timeless WEARABILITY.» in cornice sulla pietra |
| assumiamo | «We are hiring» sul foglio incollato |
| squadra | «The team (behind) your success» sul cartellone |
| offerta | «Black Friday» sul manifesto stropicciato |
| tasca | «Your business, in your back pocket.» |
| citazione | «Your brand (hits different) when it has purpose» nella busta |
| evento | «Event AW 25/26» sulla foto mossa |

**Diverso dal modello:**
- le scene sono foto di Unsplash e l'oggetto è in HTML sopra la foto (in copertina in prospettiva con `matrix3d`); la carta prende `--sfondo`;
- strisce e freccia del cartello, parole in corsivo del cartellone e riga dello sconto sono nell'accento (nel modello grigio scuro e nero);
- la striscia del manifesto è nel secondario (nel modello grigia);
- in «offerta» la foto è specchiata e i passanti sono due persone intere invece di un braccio e un piede;
- in «squadra» il muro di cemento non ha il marciapiede sotto;
- in «tasca» niente molletta di metallo; la foto ha una penna che le schede coprono;
- in «evento» la foto non è mossa (spazio bianco con persone di spalle, scurito perché il testo bianco si legga);
- in «assumiamo» titolo e invito sono il secondario schiarito, perché si leggano anche con un secondario scuro;
- lasciate fuori: telefono con chiamata in arrivo, sedia verde, vassoio d'argento, metropolitana, giornale, «Now taking clients» con le mollette, «Sorry we're out of office», le schede di vendita.

**Aperto:**
- i layout dipendono dalla foto: con un'altra scena l'agente deve rimisurare l'oggetto (in copertina la `matrix3d` vale solo per quel cartello);
- testi piccoli sotto i 24 px come nel modello (note del manifesto, account su tasca e citazione, nome sul cartello);
- `renderizza` segnala da valutare le onde della carta (assumiamo), le parole in corsivo nell'accento (squadra) e le schede arrotondate con ombra (tasca): sono del modello;
- nella prova (Sora/Work Sans) il ritratto di «assumiamo» sul principale blu notte viene chiaro e poco contrastato.

#### Lilla

- **Modello:** `agenzia-marketing/04`, «Classic Swiss Style» di vek studio, https://www.etsy.com/listing/4542576400 (link da
  verificare: `fonti.txt` lo dà per `corporate-b2b/04`). Lilla, nero e grigio chiaro, grottesco sottile, molta aria.
- **Font:**
  - Host Grotesk per titoli e testi (il modello usa un neo-grottesco tipo Helvetica Now, non su Google Fonts; Instrument
    Sans è già di «studio», Inter Tight è un ripiego dell'AI);
  - Newsreader corsivo chiaro per la chiusa dei titoli, e tondo chiaro per le pillole;
  - IBM Plex Mono per testata e righe di servizio.
- **Palette demo:** dai pixel del modello: nero `#1A1A1A` (principale e secondario: il modello ha un solo scuro), lilla
  `#9A75E6`, grigio chiaro `#F4F4F4`.
- **Foto:** quattro, Unsplash (ritratto con trench, tulipani in bianco e nero, forme bianche, archi di pietra).

| Layout | Slide del modello |
|---|---|
| copertina | «Is your pricing based on value or on fear of losing the client?» |
| dato | «When brand messaging is consistent across channels, they're 3x» |
| domanda | «What does your brand sound like that your competitors don't?» |
| segnali | «4 signs your brand strategy needs a rework» |
| percentuale | «Almost nobody reads to the bottom / 20%» |
| scheda | «Not every lead deserves your best pitch» |
| secondi | «Most websites lose visitors in under ten seconds / 8 sec» |
| tesi | «Virality is not a fast strategy, it's a one-time lottery ticket.» |

**Diverso dal modello:**
- la scheda scura di «scheda» è il secondario (nel modello è nera come i fondi);
- il testo sull'accento è bianco o nero da solo, appena tinto dell'accento (nel modello è un nero violaceo);
- nella copertina la foto è scurita con un filtro per reggere il titolo bianco, senza velo sfumato;
- in «percentuale» al posto del vaso di ceramica scura c'è un vaso di tulipani in bianco e nero;
- la testata ha il nome del brand al posto di «VEK STUDIO» e una rubrica al posto di «SWISS STYLE TEMPLATES 6»;
- copertina e domanda hanno titolo, testo e pillola in flusso, così con font larghi non si sovrappongono.

Lasciate fuori: Differentiation (titolo verticale con foto, simile a «percentuale»), 90% of rebrands fail (simile a
«dato»), Nobody needs another free PDF, You're not too small, Clarity converts, Free advice is why you're stuck, The gap
between a logo and a brand strategy.

**Aperto:**
- testata e righe mono restano a 18-20 px come nel modello: `renderizza` le segna piccole sul telefono;
- pillole, numeri 01-04 e corsivo nel titolo sono segnalati come segni da AI ma sono del modello;
- il secondario della demo è uguale al principale: con un brand la scheda di «scheda» prende il suo secondario.

#### Salvia

- **Modello:** `agenzia-marketing/05`, «The Strategy Haus» (nome del brand finto del set), https://www.etsy.com/listing/4330198779. Verde bosco, menta e beige su bianco, serif classico con parole in corsivo, adesivi disegnati.
- **Font:**
  - Libre Baskerville per i titoli (sembra lo stesso del modello);
  - Roboto per i testi e le pillole;
  - Oswald fisso per la firma `[ NOME ]` e le etichette delle barre.
- **Palette demo:** dai pixel del modello: verde bosco `#253A33`, beige `#E4E1CE`, menta `#D8F0CE`, bianco caldo `#F8F8F8`.
- **Foto:** nove, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «How do I turn followers into real clients?» |
| frase | «Your dream brand deserves a strategy that works. Let's build it together.» |
| dato | «94% of users say design impacts trust» |
| numeri | «Our business / In numbers» |
| domanda | «What KPI actually matters for small brands?» |
| passi | «Pre-Launch Must-Do's» |
| recensioni | «What people say about us» |
| squadra | «Our talented team» |

**Diverso dal modello:**
- gli adesivi (fulmine, megafono, fuoco, cursore) sono ridisegnati in SVG, più semplici;
- la foto della copertina è più chiara e ha una manica blu, quella del modello era scura e calda;
- in «dato» la foto è una donna bionda di spalle invece di una donna dai capelli grigi in giacca rossa;
- nella seconda recensione il testo va a capo dentro la parte che si vede invece di essere tagliato dal bordo;
- il fondo di «domanda» è l'accento scurito di poco verso il principale, come il menta più spento del modello;
- in «squadra» i tre ritratti hanno fondi diversi (vetrata, beige, muro bianco), nel modello erano tutti beige.

Lasciate fuori:
- Engage, We're hiring, Meet the team / Hi I'm, Get in touch;
- Our services, hello, We bring great loyal community, dream team;
- Content is fire, Web Design, Business in Numbers (torta), checklist Pre-Launch, 4.7x;
- copertine delle highlight.

**Aperto:**
- gli adesivi sono più semplici dell'originale e il megafono resta un po' piccolo;
- con un brand dall'accento acceso, come l'arancio della prova, i fondi di «passi» e «domanda» diventano pagine intere nell'accento;
- Oswald resta fisso anche con i font del brand.

#### Burro

- **Modello:** `agenzia-marketing/07`, «Instagram Templates for Coaches, Creators, SMM & Influencers» di Content Edit
  Studio, https://www.etsy.com/listing/4543013941. Foto di strada e di bar a tutta pagina, titoli in minuscolo giallo burro,
  adesivi da interfaccia del telefono.
- **Font:** Hanken Grotesk 800 per i titoli (il grottesco nero e stretto del modello, tipo Helvetica Heavy), Quicksand per
  gli adesivi (gli stessi tondi del modello). Schibsted Grotesk provato e scartato: la «I» maiuscola ha le grazie.
- **Palette demo:** dai pixel del modello: marrone `#3B2A14`, burro `#FFFFCD` (secondario e sfondo), giallo cartella
  `#FEC832`. Titoli e adesivi usano il secondario schiarito (`oklch` con luminosità almeno 0,95), così restano leggibili
  sulla foto con qualunque brand; il fondo a pois è l'accento mescolato col bianco.
- **Foto:** dieci, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «my biggest Etsy mistake» (menu Copy / Select / Share) |
| lista | «my 5-figure system» (lista con la spunta) |
| note | «nobody finds you» (nota del telefono) |
| calendario | «your first sale roadmap» (widget del calendario) |
| ricerca | «SEO made simple» (posizione «coffee date» e ricerche) |
| post | «AI changed everything» (post Instagram inclinato) |
| cartelle | «things I would never do on Etsy» (cartelle gialle) |
| scheda | carosello a pois «Digital Invitations» (finestra con i tre puntini) |

**Diverso dal modello:**
- nel modello la persona è scontornata e passa davanti al titolo: qui il titolo sta sopra la foto intera;
- nella «scheda» le persone e gli oggetti scontornati sono due foto rettangolari inclinate;
- adesivi senza ombra (renderizza la segna come card da AI);
- la riga scelta della ricerca e la spunta sono nell'accento invece che nere;
- i titoli non escono dal bordo; in «cartelle» il titolo sta nella metà destra perché la persona della foto è a sinistra;
- il fondo a pois è un SVG ripetuto, non una sfumatura.

Lasciate fuori: «this saves hours» (notifica delle 9:00), «I wish I knew this sooner» (barra di ricerca), «Etsy myths»
(agenda oraria), le slide a quadretti con oggetti scontornati e la chiamata all'azione del carosello.

**Aperto:**
- con un secondario scuro i titoli diventano una sua tinta chiarissima: il colore del brand si legge soprattutto negli
  adesivi in accento;
- le foto chiare (muro grigio della copertina) danno poco contrasto ai titoli: l'ombra aiuta, ma serve una foto con toni medi;
- il pois è pensato per accenti chiari o medi: con un accento scuro il fondo diventa un colore pieno.

#### Diario

- **Modello:** `agenzia-marketing/08`, «70 posts» di Agent Site Shop, https://www.etsy.com/listing/4585224311. Foto
  spontanee a tutta pagina, testi crema, un font diverso per ogni post.
- **Font:**
  - Montserrat, Schibsted Grotesk (al posto di un grottesco tipo Helvetica), Noto Serif Display stretto, anche corsivo
    (al posto di un serif condensato a contrasto alto), Nanum Brush Script e Gaegu per i titoli: uno per layout, come
    nel modello;
  - Open Sans, Montserrat e Gaegu per i testi;
  - DotGothic16 per le righe a pixel tra graffe, Pinyon Script e Yesteryear per le parole scritte a mano: fissi,
    decorativi.

  Il modello non dichiara i suoi font.
- **Palette demo:** dai pixel del modello: testo crema `#F2EDCE`, stella gialla `#FCAC30`, stella rosa `#F682A6`,
  principale `#2A2724` per il velo e il testo del fumetto.
- **Foto:** otto, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Your Offer Needs Clarity» |
| forte | «Build A Strong Brand» |
| pubblico | «Your Audience Is Watching Something» |
| elegante | «Write Better Hooks / Grab their attention» |
| a-mano | «Plan Your Content Smarter» |
| pensa | «Think Like a Business» |
| spaziato | «Create Content That Converts» |
| giornata | «A Day Worth Keeping» |

**Diverso dal modello:**
- sopra ogni foto c'è un velo del principale (22-30%), perché il testo regga su foto più chiare di quelle del modello;
- il fumetto è il colore dei testi schiarito invece che bianco;
- in «giornata» la stella blu è il secondario girato di tono in oklch (nel modello rosa, blu e giallo);
- in «giornata» il nome in alto («STUDIO NORTH») è il logo del brand;
- Noto Serif Display stretto e Nanum Brush Script hanno un `@font-face` con `size-adjust: 150%`: le misure dei titoli
  valgono per i font del brand, molto più larghi, e la demo resta uguale;
- la stellina con la faccina di «giornata» è una stella semplice; niente emoji.

Lasciate fuori: «Content Ideas that convert» (riquadro dietro la parola), «Stop Posting Randomly», «Content Without
Burnout», «Why Most Social Media Strategies Fail», «Grow Smarter»: tipografie già coperte da altri layout.

**Aperto:**
- i `@font-face` di Noto Serif Display e Nanum Brush Script puntano a versioni precise di fonts.gstatic.com (v29, v26):
  se Google le cambia, vanno aggiornati;
- in «spaziato» con un font largo (Sora) «CONTENUTI» arriva quasi ai bordi: parole più lunghe di 9 lettere non ci
  stanno;
- il template vive delle foto spontanee: con foto di stock in posa perde il carattere.

#### Brace

- **Modello:** `agenzia-marketing/09`, «Modern Marketing» (68 post e storie per Canva), https://www.etsy.com/listing/4499265113.
  Arancio e nero, fondo nero granuloso, grottesco pesante, fasce inclinate.
- **Font:**
  - Poppins per titoli e testi (sembra lo stesso del modello, che non dichiara i suoi font);
  - Mr Dafoe per la parola scritta a mano di guida e recensione (il modello usa un pennello tipo firma, non su Google Fonts).
- **Palette demo:** dai pixel del modello: nero `#141414`, quasi nero `#1E1E1E` (secondario), arancio `#F85A15`, carta `#F5F5F3`.
- **Foto:** una, Unsplash (ritratto su fondo arancio pieno); il resto del modello è tipografico.

| Layout | Slide del modello |
|---|---|
| copertina | «Market» verticale con la ragazza e il telefono, «Adapt to the market trends…» |
| lo-sapevi | «DID Know YOU» |
| dato | «Only the top 1% of marketers post daily. …what about you?» |
| parola | «Talk Talk Talk Talk» con il fumetto |
| indovina | «Can you Guess?» con le caselle |
| guida | «Capaign Guide» con il foglio spuntato |
| calendario | «15 JUL Creator Spotlight…» |
| recensione | «what Our Client Says» |

**Diverso dal modello:**
- la persona della copertina non è scontornata: è una foto su fondo arancio che sfuma a destra nel fondo; la parola verticale è piena sopra un taglio fisso e solo contorno sotto, non dove passa la persona;
- la parola verticale della copertina, le righe ripetute di «parola» vengono dal CSS (`data-parola`), così `renderizza` non le conta come testi sovrapposti;
- in «lo-sapevi» le parole sono «LO / sapevi / CHE» (in italiano non si possono mescolare come «DID Know YOU»);
- in «guida» tolti la penna e la tastiera scontornate; il foglio ha bordi irregolari dal CSS;
- stelle della recensione nell'accento invece che bianche, senza il trattino prima dell'autore;
- la fascia nera della parola chiave in copertina è il secondario;
- icone social: Instagram, LinkedIn e TikTok invece di Pinterest, Instagram e LinkedIn;
- grana del fondo nero e della carta generata in SVG (feTurbulence) invece della texture fotografica.

Lasciate fuori: Get the Insights (SEO), Online Webinar (badge), Market Move (biliardo), 3 Tips for SEO Growth (cartelle), Blog Digital Tactics (armadietti), Growth built on Stages, Where Attention Becomes Revenue, Your Goals Checklist: quasi tutte richiedono oggetti scontornati o 3D.

**Aperto:**
- il secondario della demo è quasi nero ed è usato solo nella fascia della copertina: con un brand si vede poco altrove.

#### Quota

- **Modello:** `agenzia-marketing/10`, «Modern Business» (nome del profilo nel mockup), https://www.etsy.com/listing/4547645220 (link da verificare: `fonti.txt` lo dà come `corporate-b2b/10`). Quasi nero melanzana e bianco, grottesco tipo Helvetica, corsivo serif negli angoli, griglia a quadretti, pillole a filetto.
- **Font:**
  - Arimo per titoli e testi (il modello usa un grottesco tipo Arial o Helvetica);
  - Newsreader corsivo per le parole negli angoli e il sottotitolo di «progetto» (il corsivo serif stretto del modello; Instrument Serif era più simile ma è un font di ripiego dell'AI).
- **Palette demo:** dai pixel del modello: melanzana quasi nera `#15121D`, secondario `#2B2735`, accento bianco `#FFFFFF`, fondo bianco `#FFFFFF`. Sulle slide scure le evidenze prendono l'accento, sulle chiare e sulla foto il secondario.
- **Foto:** nove, Unsplash: architettura dal basso, un vicolo, persone al lavoro, tre ritratti.

| Layout | Slide del modello |
|---|---|
| copertina | «YOUR SUCCESS STARTS WITH SMARTER DECISIONS» |
| manifesto | «BUSINESS DOESN'T CHASE ATTENTION. IT EARNS TRUST.» |
| guida | «HOW TO DEFINE MARKETING STRATEGY» |
| perche | «WHY BRANDS CHOOSE TO WORK WITH US» |
| progetto | «DISCOVER Projects» |
| numeri | «The Power of Purpose: Values Drive Engagement» |
| evento | «Event … 02 Feb» |
| articolo | «Clear goals and achieve sustainable growth.» (blog) |

**Diverso dal modello:**
- il marchio a mezzelune è diventato il nome del brand in testo (`.logo`) nello stesso punto di «guida»;
- in «manifesto» la foto è un vicolo con un edificio in fondo invece della torre tra due palazzi, ed è scurita con un filtro;
- in «perche» la barra accanto al titolo segue l'altezza del titolo, e le pillole sono 4 voci ripetute due volte, come nel modello;
- «numeri» nel modello è visibile solo per due terzi: il secondo cerchio in basso a destra, con la freccia, è ricostruito;
- titoli e cifre rimisurati per reggere font larghi (titolo di «evento» 100 px, cifre 118 px, data 232 px).

Lasciate fuori: brief con le finestre, Strategic Partnership, Turning decisions into growth, nuvola di servizi a pillole, assunzioni, sondaggio, annuncio.

**Aperto:**
- `renderizza` segna come «da valutare» la griglia di «guida» (fatta con gradienti CSS), le pillole di «perche» e i testi da 19-23 px. Sono tutti nel modello.
- In «perche» il titolo bianco sta sul cielo grigio: con foto chiare il contrasto va controllato.
- Molto vicino a «Studio» per tono (B2B, architettura). Le differenze: maiuscolo, fondo melanzana, corsivi negli angoli, griglia, filetti e schede.

#### Cielo

- **Modello:** `agenzia-marketing/11`, «Startup & Investor Social Media Kit» (Canva, 60 design),
  https://www.etsy.com/listing/4535364330 (link da verificare: `fonti.txt` lo dà per `corporate-b2b/11`, con lo stesso
  numero di immagini). Azzurro tenue, nero e bianco, forme a pillola, frecce nei cerchi.
- **Font:** Hanken Grotesk per i titoli (il modello usa Open Sauce, che non è su Google Fonts), Albert Sans per i testi.
- **Palette demo:** dai pixel del modello: nero `#11120D`, blu acciaio `#8FABC2`, azzurro `#E0F2FC`, azzurro pagina `#DEF0FA`.
- **Foto:** tre, Unsplash: ritratto, stretta di mano, edificio.

| Layout | Slide del modello |
|---|---|
| copertina | «Growth Metrics +145%» |
| numeri | «The numbers speak for themselves.» |
| dato | «$25B» con il grafico a linea |
| passi | «01. 02. 03.» |
| frase | «We are proud of what we achieved…» |
| persona | «Olivia Bennett» |
| citazione | «Daniel Carter, Founder & CEO» |
| evento | «Investor Pitch Masterclass» |

**Diverso dal modello:**
- le cornici scure dei mockup sono tolte: le slide vanno a filo;
- le cifre e le parole su forma scura («dato», numeri di «passi», «arriva.» in «frase») prendono l'accento invece del bianco;
- la pagina dei numeri e la carta della frase sono un misto di accento e sfondo, così con un brand dallo sfondo bianco
  la riga bianca e la forma bianca restano visibili;
- nell'evento la foto va da bordo a bordo; il titolo tocca la foto solo con la prima riga;
- lasciate fuori: mappa dei paesi, griglia ARR, diagramma di Venn, timeline, colonne arrotondate, assunzioni.

**Aperto:**
- con i font del brand più alti (Sora) il titolo dell'evento scende e non tocca più la foto;
- nella demo accento e sfondo sono quasi uguali (due azzurri del modello): con un brand l'accento si vede molto di più.

#### Rivista

- **Modello:** `agenzia-marketing/12`, «Creative Studio» di Brand Your Own Temp, https://www.etsy.com/listing/1874472716.
  Giallo, grigio caldo e quasi nero, foto di moda in ufficio, grottesco stretto mescolato a un serif.
- **Font:**
  - Archivo per i titoli (grottesco con l'asse della larghezza: largo e nero per «Servizi», largo e sottile per
    «Work shop»); il modello non dichiara i suoi font, sembra un Neue Haas;
  - Newsreader per il serif (corsivi della citazione, «(parentesi)» di prenota, titolo di consulenza, note);
  - Source Sans 3 per le didascalie in grassetto con i pezzi in corsivo sottolineato.

  Archivo è anche in Segnale; qui il carattere viene dal serif, dalle foto e dalle sottolineature.
- **Palette demo:** dai pixel del modello: quasi nero `#333334`, grigio caldo `#A09D98`, giallo `#FFF36B`, avorio `#E8E5E0`.
- **Foto:** otto, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Collab & Create» |
| servizi | «Services» (foglio giallo inclinato) |
| manifesto | «More than a branding studio, it's a collab space» |
| frase | «It's a collab space where ideas come to life.» |
| evento | «Work shop work shop» |
| prenota | «(now) booking» |
| citazione | «Good branding isn't just seen, it's felt.» |
| consulenza | «Consulting that transforms» |

**Diverso dal modello:**
- il trattino lungo all'inizio della seconda metà del manifesto è tolto;
- «Work shop» resta dentro il bordo (nel modello la seconda riga è tagliata a destra);
- il fondo del manifesto è `--sfondo` scurito col principale (nel modello un grigio fisso);
- la citazione, quadrata nel modello, è portata a 4:5 lasciando vuota la parte bassa;
- in consulenza la foto è un ritratto frontale desaturato, non una ragazza sdraiata dall'alto;
- lasciate fuori: polaroid nella busta, «rebrand identity», «mode dept», podcast, collage e le slide con persone scontornate.

**Aperto:**
- didascalie e testi nell'accento stanno sopra le foto: con un accento scuro o medio (nella prova l'arancio) la
  didascalia della copertina e il testo di «frase» si leggono poco; vanno su zone scure delle foto del brand;
- `renderizza` segnala tra i «da valutare» le parole del titolo in accento di «frase»: sono dell'originale.

#### Appunti

- **Modello:** `agenzia-marketing/13`, «Content Creator & SMM» (30 post, 30 storie, 5 caroselli, Canva),
  https://www.etsy.com/listing/4572031614. Foto lifestyle a tutta pagina, titoli giallo pallido, rosa e blu da chat,
  segni del telefono.
- **Font:**
  - Playfair Display per la parola serif enorme (copertina, parola) e il corsivo di «numero»;
  - League Spartan per i titoli grotteschi (consiglio, nota, chiusura) e gli adesivi, il più vicino al geometrico del modello;
  - Arimo per frasi, utente e firma (il modello usa un Helvetica);
  - Noto Color Emoji per le emoji del modello (✨ ⭐ 🍒 👀).

  Il modello non dichiara i suoi font.
- **Palette demo:** dai pixel del modello: marrone `#2E2620` (testo della nota), rosa `#FF64C8`, giallo pallido `#FCF5BE`,
  crema `#FCFAF2`.
- **Foto:** otto, Unsplash e Pexels (letto, colazione, asciugamano, divano, bibita, accappatoio, specchio, tablet).

| Layout | Slide del modello |
|---|---|
| copertina | «If you run a small business, / READ THIS» |
| numero | «#1 Save this for brand strategy» |
| consiglio | «Address one common problem / follow for more» |
| nota | «Notes / Focus on lighting» |
| messaggio | «never do this / I stop buying fake followers… / SEND MESSAGE» |
| ripresa | «Lighting is 90% of the visual» (mirino e griglia della fotocamera) |
| parola | «strategy / SMART / that drives high organic reach» (storia 9:16 portata a 4:5) |
| chiusura | «Need more content ideas that actually convert? / Link in bio» |

**Diverso dal modello:**
- le persone scontornate col bordo bianco (nota) sono foto intere sotto la scheda;
- i fumetti chat di «nota» e «messaggio», blu nel modello, e il bottone «invia», blu-viola, sono nel secondario; il testo sopra diventa bianco o nero da solo (sul rosa demo è nero);
- il mirino è l'accento scurito verso l'oro;
- «CAPTURED» è «Preso»; le durate della fotocamera restano «3m 60s 15s»;
- titoli serif un po' più piccoli e pillola «furba» staccata dalla parola, perché reggano font larghi senza sovrapporsi;
- slide lasciate fuori: Filming col pannello della fotocamera, Things I would never do, Your Feed, highlight.

**Aperto:**
- gli «da valutare» (pillole, scintille, card con ombra, velo sfumato in «ripresa») sono tutti del modello e restano;
- con un accento chiaro i titoli sulle foto chiare (consiglio, chiusura) reggono grazie al velo scuro: va controllato con brand dall'accento medio.

#### Panna

- **Modello:** `agenzia-marketing/14`, Noèka Lab, https://www.etsy.com/listing/4552270050. Foto lifestyle a pagina
  piena, titoli grotteschi in minuscolo color panna, adesivi da storia Instagram.
- **Font:**
  - Hanken Grotesk per titoli (ExtraBold, spaziatura molto stretta) e testi, il più vicino al grottesco del modello;
  - Libre Caslon Condensed per il layout «idee» (serif stretto come nel modello), ingrandito con `size-adjust`;
  - Pinyon Script, fisso, per la parola scritta a mano.
- **Palette demo:** dai pixel del modello: marrone scuro `#3B3130`, verde interruttore `#7EC736`, giallo stelle
  `#F7CF3E`, panna `#FEFFDF` (i titoli sono `--sfondo`).
- **Foto:** otto, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «why your content gets skipped» |
| parola | «let's talk about SEO» |
| sprint | «[content sprint] CONTENT Batch» |
| controlli | «3 checks before your post goes live» |
| idea | «one idea / five posts» |
| prenota | «your content needs a reset» + BOOK NOW |
| idee | «UGC content ideas 2026» |
| perline | «you don't need more CONTENT» |

**Diverso dal modello:**
- le emoji (fuoco, occhi, cuore, luccichii) sono tolte o disegnate in SVG: stelle, luccichii e cuore nell'accento;
- in «sprint» il titolo non passa dietro la testa della persona (servirebbe una foto scontornata);
- il velo sulla foto è uniforme, non a sfumatura;
- perline, selettore e bottone prendono `--sfondo` invece del bianco;
- i titoli italiani sono più lunghi: misure ridotte perché reggano font larghi.

Lasciate fuori: le slide con cartelle, note vocali e bolle di chat (meet your coach, story prompts, Red Flags).

**Aperto:**
- il `@font-face` di Libre Caslon Condensed punta a una versione precisa di fonts.gstatic.com;
- il layout «parola» non ha l'accento sui titoli: il brand si riconosce solo da stella e font.

#### Gigante

- **Modello:** `agenzia-marketing/15`, «The Agency» di Studio TSM, https://www.etsy.com/listing/1832593721. Lilla, nero e
  bianco, parole giganti in grottesco stretto, foto di persone in bianco e nero.
- **Font:**
  - Oswald per i titoli (il grottesco stretto del modello, non dichiarato), con un `@font-face` «Oswald Gigante» ingrandito
    da `size-adjust: 150%` nei layout con la parola grande, così le misure reggono font larghi;
  - Mulish per i testi (simile all'Avenir del modello);
  - Archivo Black per la parola dello slogan, pesante e larga come «grow»;
  - Allison per la firma della recensione.
- **Palette demo:** dai pixel del modello: nero `#0E0E10`, lilla chiaro `#EAD2E8`, lilla `#D5ABD1`, grigio `#E8E6E3`.
- **Foto:** tredici, Unsplash (sette volti per la griglia).

| Layout | Slide del modello |
|---|---|
| copertina | «WE BUILD ICONIC BRANDS» |
| parola | «AGENCY» con la foto e lo smile |
| servizi | «SERVICES» con le capsule |
| manifesto | «YOUR STORY IS WORTH TELLING…» |
| benvenuto | «WELCOME» |
| recensione | «The Agency changed everything…» con la firma |
| slogan | «Your business deserves to grow» |
| risultati | «In the last year we have helped over 200…» con la griglia di volti |

**Diverso dal modello:**
- il modello è quasi tutto quadrato: tutto allungato a 4:5;
- le parole grandi stanno nei margini invece di uscire dal bordo (renderizza le segna da correggere);
- in «benvenuto» la parola passa davanti a tutta la foto: nel modello la persona scontornata stava davanti alle lettere;
- lo smile a retino di «parola» è diventato un tondo con il logo del brand;
- le persone scontornate su lilla (risultati, recensione) sono foto in bianco e nero stampate in moltiplica sull'accento;
- la «o» con la foto dello slogan è un anello in CSS, non la lettera del font;
- il testo delle capsule diventa bianco o nero da solo sul secondario;
- lasciate fuori: Launch e Freebie (oggetti scontornati), Meet the Founder, Coming soon, Black Friday, Thank you, Podcast.

**Aperto:**
- la «o» dello slogan ha misure fisse in em: con font dalla x molto alta o bassa l'anello può staccarsi dalla riga;
- il `@font-face` di Oswald punta a una versione precisa di fonts.gstatic.com (v57): se Google la cambia, va aggiornato.

#### Cobalto

- **Modello:** `agenzia-marketing/16`, «200 Business Instagram Templates» per Canva, https://www.etsy.com/listing/1462960570
  (link da verificare: `fonti.txt` lo dà come `corporate-b2b/16`). Blu cobalto in sfumatura, foto velate di blu,
  tagli diagonali.
- **Font:**
  - Titillium Web per titoli e testi (sembra lo stesso del modello);
  - Pathway Gothic One per la copertina (il modello usa un grottesco strettissimo e leggero che non dichiara).
- **Palette demo:** dai pixel del modello: blu notte `#021F67`, blu `#3569CF`, blu scuro `#0A1F5B` (accento), bianco `#FFFFFF`.
- **Foto:** dieci, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «YOUR. TEXT. HERE.» |
| annuncio | «YOUR TITLE GOES HERE», con la foto a chevron |
| servizio | «TITLE HERE» con il grattacielo e la fascia bianca |
| lista | «TITLE HERE / Your content here» con le foto ad arco |
| pagina | «PAGE TITLE HERE» con il numero di pagina |
| domanda | «Write here a question or something?» A/B/C/D |
| recensione | stelle, testo e «NAME HERE» sul triangolo |
| scadenza | «ONLY 05 DAYS LEFT» |

**Diverso dal modello:**
- il modello è quadrato: tutto allungato a 4:5;
- in «servizio» le icone di Facebook, Instagram e Twitter sono diventate il nome del brand (`logo`);
- le foto sotto i veli di «pagina» e «scadenza» sono in bianco e nero, così il velo prende il colore del brand;
- in copertina la persona ha un cappotto grigio invece del tailleur;
- le stelle della recensione restano bianche.

Lasciate fuori: Contact us (icone in una capsula), Follow us, calendario, podcast, promemoria finto (interfaccia
disegnata), «write your quote here», Find the word, 10 days challenge, orari, checklist, collage di polaroid.

**Aperto:**
- con un accento chiaro la parola centrale della copertina, sul velo, può avere poco contrasto;
- in «annuncio» il titolo sta nel triangolo bianco: con font larghi va a capo su tre righe (12 lettere per riga al massimo).

#### Crema

- **Modello:** `agenzia-marketing/17`, «My Digital Route» (Mdr.), https://www.etsy.com/listing/4524818393. Foto
  spontanee da creator, titoli crema, adesivi da storia Instagram.
- **Font:**
  - Host Grotesk 800 per i titoli (grottesco stretto tipo Helvetica Now del modello) e i fumetti;
  - Libre Caslon Condensed per i titoli serif stretti di `collage` e `casa`;
  - Corinthia per la parola a mano che attraversa il titolo;
  - Lekton per le righe tra graffe e tonde e i sottotitoli in maiuscolo.

  Il modello non dichiara i suoi font.
- **Palette demo:** dai pixel del modello: bruno `#2B2723`, grigio fumetto `#E8E6E3`, giallo stellina `#F5C02C`,
  crema `#F1EBCF`.
- **Foto:** dieci, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «{ steal my } content Strategy» |
| frase | «build trust ( and the rest will follow)» |
| verita | «here's the truth OF GROWING ON INSTAGRAM» |
| domanda | «is faceless marketing Worth it?» |
| segreto | «SECRET to go viral on instagram (2026)» |
| persona | «how to create Personal Brand» |
| collage | «content line-up» con «HOME» |
| casa | «join me work from home» |

**Diverso dal modello:**
- le stelline emoji sono disegnate in SVG sull'accento; la stellina rosa e la scintilla argento sono sul secondario;
- i fumetti, le perline e l'etichetta del luogo prendono il secondario, con il testo che diventa bianco o nero da solo;
- la slide quadrata «build trust» è allungata a 4:5;
- un velo piatto del principale sulle foto, per leggere i titoli crema anche su foto chiare;
- in «persona» la seconda parola è in basso a destra e più piccola, perché «personale» è più lunga di «Brand».

Lasciate fuori: Hooks you need e Content Batch (il riquadro giallo di messa a fuoco), MYTHS debunked (perline uguali a
«segreto»), niche Hooks, why your reels are flopping, Pinterest, UGC photos, 10k followers, monetize, Mindset Shift,
What i would do if i had 0 followers.

**Aperto:**
- il cursore e l'etichetta col segnaposto hanno bianco e nero fissi (come nel modello);
- `renderizza` segna da valutare il fumetto di «persona» come pillola: è nel modello;
- vicino a «diario» (agenzia-marketing/08, stesso genere da creator): qui distinguono perline, cursore, collage,
  serif stretto, righe monospaziate a macchina da scrivere e il ricciolo a mano.

#### Cappuccino

- **Modello:** `agenzia-marketing/18`, «Trending iOS Core Aesthetic» (40 post, 40 storie, 15 reel per Canva),
  https://www.etsy.com/listing/4583542884. Foto lifestyle a tutta pagina, beige e oro, pezzi d'interfaccia del
  telefono (calendario, notifica, note, fumetti), titoli bianchi in grottesco strettissimo.
- **Font:**
  - Hanken Grotesk per i titoli strettissimi e le scritte sparse (il modello usa un grottesco tipo Helvetica Now);
  - Montserrat sottile e nerissimo per «frase» (sembra lo stesso del modello);
  - Open Sans, Figtree e Poppins per le schede (calendario e notifica, «lo sapevi», domanda);
  - Cormorant Garamond per il titolo della nota, IBM Plex Mono per il biglietto, Source Serif 4 per il luogo.
- **Palette demo:** dai pixel del modello: testo `#2B2620`, crema `#FFF3D0`, oro `#D4BF80`, bianco `#FFFFFF`.
- **Foto:** otto, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Let's Build a Business That Supports You» |
| calendario | «Plan social media posts» 9:00-11:00 con «The Brand Studio» |
| promemoria | «REMINDER / Okay! Got it!» |
| lo-sapevi | «Did you know?» con i «??» |
| domanda | «QUESTION» |
| lista | Notes «Business Clarity Checklist» |
| frase | «What my business actually runs on [as a studio owner!]» |
| lavora-con-me | «[I'm Olivia] Work With Me» |

**Diverso dal modello:**
- le storie 9:16 e i post 4:5 sono tutti 4:5;
- velo scuro leggero e uniforme sotto i titoli bianchi (il modello non ce l'ha, ma con le nostre foto il bianco si leggeva poco);
- la notifica è bianca velata senza sfocatura dietro (`backdrop-filter` segnato come segno da AI);
- i «??» di «lo sapevi» sono nell'accento invece che arancio chiaro;
- le scritte su carta e la parola selezionata prendono il testo bianco o nero da sole (`--su-secondario`, `--su-accento`);
- slide lasciate fuori: About us, Trust creates sales, Consistency beats motivation, Strategic Direction, finestre del browser, ricerca, fotocamera, foto «Photo 1/2», blocco schermo, chat.

**Aperto:**
- nella copertina la parola selezionata resta bianca come nel modello: con un accento molto chiaro si legge poco;
- in «frase» l'ultima riga è nel secondario: con un secondario scuro (la prova: blu) su foto scura il contrasto è basso;
- i pezzi d'interfaccia (notifica, nota, calendario) sono nell'elenco dei segni da AI del mestiere: qui sono il carattere del modello.

#### Adesivi

- **Modello:** `agenzia-marketing/19`, «Noèka Lab», https://www.etsy.com/listing/4554386331. Foto lifestyle a pieno
  formato, titoli crema minuscoli e stretti, corsivo calligrafico, adesivi «scrapbook» (stelle gialle, cursore,
  interruttore, perline con le lettere, cartella).
- **Font:**
  - Hanken Grotesk per titoli e testi (il modello usa un grottesco tipo Helvetica Now, non dichiarato);
  - Libre Caslon Condensed per il titolo di «guida» (serif stretto ad alto contrasto), con `size-adjust` perché regga
    font larghi;
  - Pinyon Script per la parola scritta a mano.
- **Palette demo:** dai pixel del modello: marrone `#36302F` (fondi della presentazione), verde `#7EC036`
  (interruttore), giallo `#F6D22E` (stelle), crema `#FBF5DE` (titoli). Lo sfondo è il colore dei titoli sulla foto.
- **Foto:** otto, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «why your content gets skipped» |
| errori | «instagram Red Flags» |
| parola | «let's talk about SEO» |
| miti | «CONTENT Myths debunked» |
| tre-punti | «3 checks before your post goes live» |
| guida | «UGC content ideas 2026» |
| perline | «you don't need more CONTENT» |
| prenota | «your content needs a reset» |

**Diverso dal modello:**
- adesivi disegnati in SVG e CSS al posto delle emoji e dei PNG (fiamma, occhi, sole, cuore, cartella, cursore);
- la cartella, blu nel modello, è nel secondario (verde nella demo) come l'interruttore;
- fumetto, scelte, perline e targhetta restano bianchi come oggetti dell'interfaccia; le lettere delle perline sono nel
  principale;
- un velo scuro uniforme sulle foto al posto del ritocco del modello;
- lasciate fuori: «story prompts», «one idea five posts», «steal my strategy», «here's the truth» (nota vocale),
  «faceless marketing», «CONTENT Batch», «3 pillars», «Bio Mistakes», «insta Hacks».

**Aperto:**
- in «errori» la foto chiara del letto rende i testi piccoli poco contrastati;
- `renderizza` segnala il fumetto di «miti» come pillola: è nell'originale;
- il `@font-face` di Libre Caslon Condensed punta a una versione precisa di fonts.gstatic.com.

#### Tortora

- **Modello:** `agenzia-marketing/20`, «Digital Marketing» di My Digital Route, https://www.etsy.com/listing/4522301941.
  Foto lifestyle a tutta pagina, smorzate e beige, scritte crema, adesivi da Instagram (stelline, fumetti, perline).
- **Font:**
  - Hanken Grotesk Bold, tracking molto stretto, per i titoli grotteschi (il modello usa un grottesco tipo Helvetica);
  - Noto Serif Display stretto (62.5%) per i titoli serif di guida, giornata e collage (il modello usa un serif
    condensato a contrasto alto che non è su Google Fonts);
  - IBM Plex Mono per i testi piccoli (il monospaziato tra parentesi del modello);
  - Italianno per la parola scritta a mano; Hanken Grotesk fisso per fumetti ed etichetta del luogo.
- **Palette demo:** dai pixel del modello: quasi nero `#161414` (testo di fumetti e perline), grigio fumetto `#E9E9EB`,
  giallo stellina `#F4C542`, crema delle scritte `#F3EED0`.
- **Foto:** dieci, Unsplash (persone di spalle o col viso coperto, scrivanie, caffè), smorzate con un filtro CSS.

| Layout | Slide del modello |
|---|---|
| copertina | «here's the truth of growing on Instagram» |
| fiducia | «build trust (and the rest will follow)» |
| domanda | «is faceless marketing Worth it?» |
| segreto | «SECRET to go viral on instagram (2026)» |
| miti | «social media MYTHS debunked» |
| guida | «how to use Pinterest the CORRECT way» |
| giornata | «join me / work from home» |
| collage | «content line-up» con tre foto |

**Diverso dal modello:**
- le stelline emoji sono disegnate in SVG con l'accento, la scintilla a quattro punte è piena nel secondario invece che glitterata;
- le perline sono nel secondario con la lettera che diventa bianca o nera da sola;
- il testo sulle foto è `--sfondo` schiarito (crema nella demo, resta chiaro con qualunque brand);
- le foto del modello hanno già i toni smorzati; qui li dà un filtro CSS;
- il modello è a post quadrati e 4:5 insieme: tutto 4:5;
- in «fiducia» la parola a mano tocca appena quella grande invece di sovrapporsi (`renderizza` segnava la sovrapposizione);
- lasciate fuori: «Content Batch with me» (quadrato giallo di messa a fuoco), «how i got 10k followers», «What i would do if i had 0 followers», «Mindset Shift», «meet the coach», «steal my content strategy» (troppo simile a fiducia).

**Aperto:**
- cursore finto e fumetti arrotondati sono segni che il mestiere elenca tra quelli dell'AI: sono nel modello, `renderizza` li segna «da valutare»;
- il titolo in alto sulla foto copre spesso la testa della persona, come nel modello: con foto del brand va scelta la zona calma.

#### Cartella

- **Modello:** `agenzia-marketing/21`, https://www.etsy.com/listing/4588183468 (il nome «Social Media Manager Instagram Posts»
  viene dal mockup di Canva nel set). Marrone, azzurro, giallo e rosa pastello, cancelleria: cartelle, tasche, fogli
  forati, polaroid.
- **Font:** Archivo 900 a larghezza 115 per i titoli (il grottesco nerissimo e largo del modello non è dichiarato),
  Hanken Grotesk per i testi al posto del grottesco tipo Inter del modello (Inter è un font di ripiego dell'AI).
- **Palette demo:** dai pixel del modello: marrone `#543928`, azzurro `#C3D9E7`, rosa `#F6DDE0`, giallo `#F7EEC7`.
- **Foto:** dieci, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Social Media Services» (cartelle con le linguette) |
| novita | «Updates you need to know» (schede nella tasca) |
| notizia | «Instagram 01» (scheda con polaroid e graffetta) |
| caso | «Client Case Study» |
| risultati | «Results» |
| passo | «03 We will manage all your comms» (foglio forato) |
| recensione | «Client Testimonial» |
| checklist | «Your daily social media checklist» |

**Diverso dal modello:**
- la carta testurizzata dei fogli è bianco pieno;
- le schede di «novita» non hanno la riga puntinata spezzata dietro la tasca, ma una intera;
- la graffetta è disegnata in SVG, in un grigio ricavato dal principale;
- in «passo» c'è solo la colonna di fori a destra della pagina singola (il modello la ripete nelle pagine del carosello);
- la foto sfocata in alto della copertina è una foto vera con `blur`;
- lasciate fuori: Olivia Wilson (scatola di latta, badge), webinar con il conto alla rovescia e col calendario, POV,
  Hiring, Out of office, Concept to creation, tweet, griglia del feed, Client challenges, See the full case study:
  molte sono oggetti scontornati o fotografati.

**Aperto:**
- con un secondario acceso (prova: blu `#005CFF`) il testo nel principale scuro su cartella, tasca e piede di «notizia»
  ha poco contrasto: si legge, ma i titoli su `--secondario` vanno controllati con brand scuri;
- la foto di «passo» ha un foglio con un curriculum finto; la foto di «caso» ha etichette «facebk» dei flaconi mockup.

#### Ritaglio

- **Modello:** `agenzia-marketing/22`, «Social Media Manager templates», https://www.etsy.com/listing/4341888416. Collage
  editoriale rosso mattone, bordeaux e carbone, foto di moda, ogni slide con un trucco grafico diverso.
- **Font:**
  - Hanken Grotesk per i titoli bastoni (il modello sembra Helvetica Now Display, non su Google Fonts);
  - Archivo largo per «rumore», Noto Serif Display stretto per «manifesto» e per il corsivo di «citazione»;
  - Roboto Mono per i testi;
  - Patrick Hand per la scrittura a mano (passo, capsule dei servizi).

  In copertina, citazione e manifesto il font demo è ingrandito con `size-adjust`, così le misure reggono font larghi.
- **Palette demo:** carbone `#2F323B`, bordeaux `#6E2620`, rosso mattone `#CB4426`, grigio carta `#ECEBE7` (dai pixel
  e dalla striscia di colori del modello; il blu `#0052C8` e l'arancio chiaro sono rimasti fuori con le slide che li usano).
- **Foto:** sette, Unsplash (sei ritratti e dettagli più la carta stropicciata di «tono»).

| Layout | Slide del modello |
|---|---|
| copertina | «Creativity vs. Consistency» |
| passo | «01 Without Strategy, Social Media Is Just Posting.» |
| servizi | «OUR SERVICES» con le capsule a mano |
| citazione | «Reels catch eyes. Content builds trust. Branding sells.» |
| tono | «BRAND VOICE & TONE» |
| rumore | «NO PLAN, NO ANALYSIS. Just noise.» |
| cornice | «SEO speaks quietly» |
| manifesto | «Build a Brand, Not Just a Feed» |

**Diverso dal modello:**
- il modello è quadrato (e storie 9:16): tutto portato a 4:5, con più aria in verticale;
- «Creatività vs. Perseveranza» spezza «Perseveranza» come il modello spezzava «Consistency»;
- le virgolette giganti sono disegnate in SVG; la cornice da negativo è un riquadro pieno senza i bordi irregolari;
- in «tono» il ritaglio di foto è un poligono in CSS e la carta stropicciata è una foto in `multiply` sul fondo;
- in «rumore» il foglio di plastica a bolle è un velo bianco con `backdrop-filter` leggero (renderizza lo segnala da valutare: è nell'originale);
- in «cornice» la lastra grigio azzurra è il secondario trasparente; le foto in bianco e nero sono rese tali dal CSS;
- lasciate fuori: «Let's talk» e «Create with clarity» (persone scontornate), «Intentional» (nastro adesivo), «algorithm» (pennellata), «Silent SEO wins», «Design with insight», «hashtag», «SEO» con le macchie.

**Aperto:**
- i `@font-face` con `size-adjust` puntano a versioni precise di fonts.gstatic.com (Hanken Grotesk v12, Noto Serif Display v29): se Google le cambia, vanno aggiornati;
- Patrick Hand è fisso: con un brand la scrittura a mano resta quella del template.

#### Inchiostro

- **Modello:** `agenzia-marketing/23`, «Bianco Disegno», https://www.etsy.com/listing/4449736663. Bianco e nero da
  rivista di moda: serif Didone enormi, grotteschi pesanti, foto chiare di persone in completo nero.
- **Font:**
  - Playfair Display per i titoli serif (è nel brand board del modello, con TAN Mon Cheri che non è su Google Fonts);
  - Archivo per i testi, per il titolo nerissimo di «chi-siamo» e per quello leggero di «notizia»;
  - Anton per il titolo stretto di «manifesto»;
  - Pinyon Script per le parole scritte a mano della citazione.
- **Palette demo:** dai pixel del modello: nero `#0B0B0B`, antracite `#2F2F2F`, grigio `#8C8C8C`, bianco caldo `#F4F4F2`.
- **Foto:** sette, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Business Story» |
| processo | «OUR PROCESS» |
| manifesto | «ALIGNED STRATEGY CHANGED EVERYTHING.» |
| chi-siamo | «ABOUT ME» |
| notizia | «NEWS HEADLINE / Clarity first. Growth followed.» |
| persona | «MEET THE CO ACH» |
| citazione | «ANYTHING worth having TAKES TIME» |
| passi | «HOW to plan STRATEGIC CONTENT» |

**Diverso dal modello:**
- in «processo» la prima riga del titolo sta dentro la pagina invece di uscire dal bordo alto (renderizza la segna da
  correggere), il titolo è più piccolo;
- la fascia della notizia, il riquadro del metodo e i punti dei passi sono il secondario (antracite nella demo, nel
  modello la fascia era nera); la parola a mano della citazione è nel secondario;
- il filetto della copertina e la linea dei passi sono nell'accento;
- in copertina la foto sfuma in alto nel fondo invece di coprire la pagina intera;
- «passi» ha cinque passi come la versione intera del modello;
- testi portati ad almeno 24 px (nel modello erano più piccoli);
- in «manifesto» il testo sotto segue il titolo, così con font larghi non si sovrappone.

Lasciate fuori: storie 9:16, copertine dei reel, infografiche (torte, barre), carosello «PLAN», recensione a scheda.

**Aperto:**
- nella prova con un font largo «manifesto» va su cinque righe e scende molto: regge, ma il testo sotto si avvicina al fondo;
- in «chi-siamo» il testo giustificato con font larghi lascia buchi tra le parole (c'è anche nel modello);
- restano «da valutare» presenti nell'originale: testata in maiuscolo spaziato (citazione), ruolo spaziato (persona),
  numeri 01/02/03 (processo), parole in corsivo nel titolo (passi), titoli a meno di 32 px dal bordo (copertina, processo).

#### Ricciolo

- **Modello:** `agenzia-marketing/25`, «Flux Studio», https://www.etsy.com/listing/4457253018. Nero e verde fluo,
  etichette storte, linea che si arriccia, foto in bianco e nero.
- **Font:** Archivo largo (asse wdth a 112) per titoli e testi, pesi 500-660. Il modello usa un grottesco largo che non
  dichiara; Archivo largo è il più vicino tra quelli su Google Fonts (provati anche Schibsted, Host, Bricolage, Funnel).
- **Palette demo:** nero `#000000`, grigio scuro `#1C1C1C`, verde `#39FF14`, bianco `#FFFFFF`.
- **Foto:** quattro, Unsplash (riprese, cucina, squadra, ritratto), in bianco e nero da CSS.

| Layout | Slide del modello |
|---|---|
| copertina | «Viral? Nah. Timeless? Yes!» |
| servizi | «Services» con le etichette |
| chi-siamo | «What Is Flux Studio?» |
| persona | «We're Not Just "Another Agency"» |
| citazione | «A brand without strategy shouts at everyone…» (#QuoteOfTheDay) |
| dati | «Ad Data By The Numbers» |
| processo | «Work Process» |
| grafico | «Cost Per Acquisition» |

**Diverso dal modello:**
- il marchio a «S» è un segno nostro di due barre tonde nell'accento;
- in copertina il grande asterisco dietro le foto è diventato due barre che escono dal bordo, come si vedono nel modello;
- le foto sono a colori e passano in bianco e nero con `filter: grayscale`;
- il grigio dei perni della fascia in «persona» è un mix di sfondo e principale;
- il secondario serve solo all'etichetta scura della copertina.

Lasciate fuori: le slide col grafico a linee, a ciambella e a barre orizzontali, la squadra in griglia, «We Are Hiring»,
il sondaggio, le schede servizio con foto (ripetono gli stessi segni).

**Aperto:**
- Archivo è anche il font di Segnale (lì normale e più pesante): con un brand senza font suoi i due template si
  somigliano nella tipografia;
- con un secondario chiaro l'etichetta della copertina perde il contrasto con l'accento.

#### Menta

- **Modello:** `agenzia-marketing/26`, «Modern Marketing» (68 post e storie Canva, profilo demo «shapestud»),
  https://www.etsy.com/listing/4528639103 (link da verificare: `fonti.txt` lo dà come `corporate-b2b/26`). Verde menta
  e salvia scuro, fondi sfumati, oggetti in rilievo con l'ombra.
- **Font:** Poppins per titoli e testi, in grassetto 700-800 e sottile 300 nella stessa frase (sembra lo stesso del
  modello, che non dichiara i suoi font).
- **Palette demo:** dai pixel del modello: salvia scuro `#2F3F39`, menta chiaro `#B8D8BC`, verde `#7CB68E`, grigio
  chiaro `#EEEEEE`.
- **Foto:** quattro, Pexels (persona a braccia conserte, clessidra su bianco, due ritratti per gli avatar).

| Layout | Slide del modello |
|---|---|
| copertina | «market / Your Strategy Actively in Motion / Solutions» |
| recensione | «#review», lettere giganti e scheda di James Smith |
| checklist | «Your Monthly SEO Checklist» |
| lo-sapevi | «DID YOU KNOW? A Smart Strategy Drives 3x Growth» |
| tempo | «Time Waits for nobody» |
| giorni | «6 Days» |
| disciplina | «Growth Demands CONSISTENCY» |
| pensiero | «Knowledge gives tools to succeed.» |

**Diverso dal modello:**
- in «copertina» la persona non è scontornata: è una foto rettangolare nel pannello, fusa col fondo del pannello
  (`mix-blend-mode: darken`), quindi il pannello si vede solo dove la foto è chiara e la persona prende un po' il suo colore;
- nella «recensione» la parola gigante è «rece / nsio» in due blocchi inclinati (dal CSS, `data-lettere`), non «review»
  sparsa lettera per lettera;
- la fascia dell'hashtag, l'asta chiara di «disciplina» e il bottone di «lo-sapevi», bianchi nel modello, sono il
  secondario quasi bianco;
- le stelle sono nell'accento invece che nere;
- in «tempo» la sabbia della clessidra prende l'accento con una tinta in CSS (`mix-blend-mode: color`), come la prova
  «Before / After» del venditore; la clessidra è più dritta di quella del modello;
- in «disciplina» la parola è «Disci / plina»; i profili sono LinkedIn, Instagram, Facebook (nel modello Pinterest);
- il «6» del calendario e «Il tempo» sono sfumati dal secondario all'accento; i grassetti sui fondi scuri sono l'accento schiarito.

Lasciate fuori: Tip of the Day (persone viste dall'alto attorno a un post), Online Webinar (cartellino della porta),
Guess the Word, Stand out ONLINE, You're targeting a massive market (folla scontornata), dadi su scacchiera, envelope
checklist, chip dei servizi con emoji, Our Services, Results That Move Brands: servono oggetti 3D o scontornati, o sono
leggibili solo a metà nei mockup.

**Aperto:**
- in «copertina» la foto deve avere un fondo chiaro, se no il pannello sparisce;
- «pensiero» ha il menu di selezione del telefono (Copia / Seleziona tutto / Cerca), un elemento d'interfaccia che il
  mestiere elenca tra i segni da evitare: tenuto perché è il segno della slide;
- la tinta della clessidra in «tempo» vale solo per oggetti su fondo bianco.

#### Vaniglia

- **Modello:** `agenzia-marketing/27`, «Content Creator Templates» di Loreo Design, https://www.etsy.com/listing/4581500478.
  Foto lifestyle a tutta pagina, titoli crema in minuscolo con una parola in corsivo con grazie.
- **Font:**
  - Poppins per titoli e testi (sembra lo stesso del modello);
  - Playfair Display italic per la parola in corsivo (il venditore usa Playfair nelle sue pagine);
  - Anton per la parola stretta della copertina, ingrandito con `size-adjust` come in Lime.
- **Palette demo:** dai pixel del modello: marrone scuro `#2A2622`, giallo pennellata `#ECD084`, crema dei titoli `#FFF0C5`,
  bianco della nota `#F7F5F0`.
- **Foto:** otto, tutte Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «MY 2026 HIGHLIGHT» |
| verita | «the reality of content creating» |
| pennellata | «creating content that actually feels like me» |
| domanda | «WHAT ARE YOU WAITING for?» |
| note | nota «Tasks for the Day» sull'uomo alla scrivania |
| elenco | «things i'm doing for myself» |
| pausa | «take it easy.» con la barra di ricerca |
| giornata | «a day in [as a freelancer] my life [in Toronto]» |

**Diverso dal modello:**
- la copertina ha una donna appoggiata allo schienale invece che seduta di lato, e la foto è ingrandita perché il viso stia sotto il titolo;
- in «domanda» il bicchiere non copre il titolo (nel modello la cannuccia passa davanti alla parola);
- in «pausa» il bicchiere è più grande e l'arco della frase più largo; il fondo è legno scuro con fiori, nel modello legno chiaro;
- le etichette tra parentesi di «giornata» sono il secondario scurito verso il principale (nel modello verde oliva);
- i titoli più lunghi del modello sono accorciati per l'italiano.

Lasciate fuori: August recap, Outfit of the Day, week dump, Behind the scenes, What I consume, Algorithm, le storie 9:16
del bonus (simili a quelle tenute o con troppe scritte piccole).

**Aperto:**
- nota, barra di ricerca e icone del post sono interfacce disegnate, che il mestiere elenca tra i segni da AI: tenute perché
  sono nel modello; la barra di ricerca resta «da valutare» (pillola) nei controlli;
- con foto chiare il titolo crema perde contrasto: le foto sono scurite con `filter: brightness()`.

#### Carteggio

- **Modello:** `agenzia-marketing/28`, «Poppy Studio» di And Done Studio, https://www.etsy.com/listing/4433832423.
  Dossier editoriale: fogli di carta su fondo scuro, verde lime, cancelleria vera, foto di moda in bianco e nero.
- **Font:**
  - Playfair Display per i titoli (sembra lo stesso del modello), con l'ultima parola in corsivo;
  - Courier Prime per i testi a macchina da scrivere, giustificati;
  - Sacramento per la scrittura a mano (biglietto, campi della recensione).
- **Palette demo:** dai pixel del modello: inchiostro `#2E2B26`, verde oliva `#7A9024`, lime `#C5DC7E`, carta `#E4E3DB`.
- **Foto:** tredici, dodici Unsplash e una Pexels (già usata in `appunti`), stampate in grigio dal CSS tranne in
  «pilastri» e «recensione», a colori come nel modello.

| Layout | Slide del modello |
|---|---|
| copertina | «Poppy Studio / Meet Our Founder» |
| perche | «Why Your Business Needs a Marketing Partner» |
| domanda | «Q: What happens during a discovery call?» |
| pilastri | «Think of content pillars…» |
| processo | «Our Process 01. 02. 03.» |
| caso | «Our Most Successful Campaign Breakdown» |
| recensione | «Client's Love» |
| lettera | «To: business owners who feel stuck…» |

**Diverso dal modello:**
- il timbro col fiore disegnato è un anello col nome del brand (lettere messe in giro da uno script, `data-testo`) e il logo al centro;
- grana, pieghe, puntini e fori della carta vengono dal CSS; le texture fotografiche del modello (carta stropicciata, pagina di libro) non ci sono;
- il fondo di «perche» è schiuma di mare invece della roccia scintillante;
- in «caso» il fondo scuro è il principale, non il marrone del modello;
- in «caso» il prodotto è un flacone satinato senza etichetta invece del profumo sulla sabbia;
- in «processo» la foto centrale è una galleria con persone invece della scacchiera;
- in «lettera» gli anelli del raccoglitore sono disegnati in SVG;
- testate e anelli del timbro a 24 px (nel modello più piccoli), per non finire sotto la soglia di leggibilità.

Lasciate fuori: Meet the team (scheda a mano), Recent Works, Let's Talk (cornetta scontornata), Out of Office, What's Included (cartellino), Behind the scene (pellicola), finestra Inbox, Content Strategy (cartella).

**Aperto:**
- la molla del biglietto, le puntine, gli anelli e il cartellino del cliente hanno colori fissi (metallo, carta bianca): sono oggetti, non grafica del brand;
- con un font largo il titolo di «caso» arriva vicino alla colonna di testo.

#### Granata

- **Modello:** `agenzia-marketing/29`, «Trendy Vibes», 50 post per creator e social media manager,
  https://www.etsy.com/listing/4567859814. Bordeaux e azzurro polvere a fondi alterni, giallo, collage di carta.
- **Font:**
  - Libre Caslon Condensed (copertina) e Libre Caslon Text dritto e corsivo (annuncio) per i serif stretti del modello;
  - Arimo per il grottesco nero maiuscolo (servizi, guida), Lexend per «parliamone», Poppins per la scheda;
  - Courier Prime per la cartellina, Gochi Hand per la scritta a mano spaziata;
  - PT Sans per la riga social e i testi (Poppins in annuncio e strumenti).

  Il modello non dichiara i suoi font. Con un brand, titoli e testi diventano i due font del brand.
- **Palette demo:** dai pixel del modello: bordeaux `#730F0F`, giallo chiaro `#FBE9A6`, giallo `#EAE065`, azzurro `#B7CBE3`.
- **Foto:** quattro, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Ready to take your brand to the next level?» |
| servizi | «OUR SERVICES» |
| guida | «THE ROLE OF STORYTELLING IN BRAND CONTENT» |
| citazione | «In marketing, details create the big picture» |
| strumenti | «BEST tools & Apps» |
| parliamone | «Let's Talk» |
| unisciti | «WE'RE READY TO ELEVATE YOUR SOCIAL GAME!» |
| annuncio | «Stay tuned! Coming soon» |

**Diverso dal modello:**
- il modello è in parte 2:3: tutto portato a 4:5;
- l'azzurro è `--sfondo` e fa anche cornici, polaroid, cartella e bottone; su un fondo del brand quasi bianco i titoli
  bianchi di «guida» e «annuncio» e il bordo delle voci vuote diventano neri (calcolato dalla luminosità dello sfondo);
- la didascalia e il profilo della scheda «strumenti» sono bianchi o neri secondo la luminosità del principale, con un velo del
  secondario (nella demo giallo chiaro, come l'originale); cuore e freccia nel secondario;
- in «citazione» manca il disegno a linea della ragazza che legge: la frase è più grande e centrata in altezza nella
  cornice, l'asterisco va in basso a destra dove stava il disegno;
- in «parliamone» la persona scontornata è una foto rettangolare con il bordo alto strappato;
- in «servizi» la griglia è un pattern SVG (il gradiente veniva segnato come sfumatura);
- lasciate fuori le slide con oggetti scontornati (gatto, sveglia, telefono giallo, sedia, macchina da scrivere),
  la scacchiera ondulata, «Colors of the season» e i fogli di quaderno.

**Aperto:**
- pillole, bottone e scheda con ombra sono segnati «da valutare»: sono del modello;
- la riga social sopra le righe verticali di «guida» si legge male, come nell'originale (ha un'ombra leggera).

#### Mimosa

- **Modello:** `agenzia-marketing/30`, «Yellow Accent Instagram Templates», https://www.etsy.com/listing/4539123349.
  Crema, azzurro polvere e giallo evidenziatore, serif corsivo, foto di moda.
- **Font:** Newsreader (ottico 72) per i titoli, quasi sempre in corsivo, al posto del serif da display stretto del
  modello, che non dichiara i suoi font; Work Sans per i testi, che sembra lo stesso del modello. Entrambi su Google Fonts.
- **Palette demo:** dai pixel del modello: testo `#22201D`, azzurro `#C4D8E1`, giallo `#FDF955`, crema `#F9F9ED`.
- **Foto:** sei, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «how we make viral content» |
| cartella | «Trend 01 – The rise of the micro-expert» |
| passo | «Step 1 – Start with the idea, not the trend» |
| domanda | «ask me anything» (Q / A) |
| servizi | «Our services» con le cartelle |
| promemoria | «The key to visibility» con le notifiche |
| routine | «My ultimate content routine» |
| frase | «01 – Your audience doesn't buy content. They buy trust.» |

**Diverso dal modello:**
- Q e A sono diventate D e R;
- pillole, testata e piede a 24 px invece di 21-22, perché `renderizza` non li segni piccoli;
- la grana della carta viene da un rumore SVG, su passo e frase;
- la foto di domanda è ingrandita per tenere il titolo sotto il viso;
- l'adesivo della routine sta dentro la scheda e la segue se si allunga;
- titoli a righe bilanciate (`text-wrap: balance`).

Lasciate fuori: chat a fumetti, «Cleo Creative» con le parole in riquadri, foto con la clip, collage, toolbox, newsletter,
caricamento file, testimonianza, FAQ. Molte usano oggetti scontornati o finte interfacce.

**Aperto:**
- nella routine il viso della foto d'esempio resta dietro la scheda (nel modello la persona è a destra);
- con un accento medio (arancio della prova) il titolo di domanda sulla foto ha poco contrasto;
- con font larghi il titolo di passo va su tre righe.

### Bellezza

#### Bordeaux

- **Modello:** `parrucchieri/02`, «Luxury Hair Instagram Templates» di anny_sketches,
  https://creativemarket.com/anny_sketches/292239184-Luxury-Hair-Instagram-Templates. Bordeaux e beige.
- **Font:**
  - Noto Serif Display stretto per i titoli (il più vicino al serif condensato del modello);
  - Poppins per i testi (lo stesso del modello);
  - Courier Prime per nastri, fasce, testata e piede.
- **Palette demo:** bordeaux `#3F0F0E`, crema `#E7DFCC`, senape `#DAB061`, beige `#D9C4A9`.
- **Foto:** dieci, Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «We're now booking for September» |
| servizi | «Services» |
| prenotazione | «Booking Process» |
| recensione | «Client Review» |
| novita | «New Service Alert» |
| cliente | «Client of The Week» |
| prima-dopo | «Before & After Transformation» |
| consigli | «How to know which hair style suits you?» |

**Diverso dal modello:**
- le persone scontornate del modello sono foto rettangolari (in «novita» si fondono col fondo);
- il nastro di carta è il secondario, con il testo che diventa bianco o nero da solo;
- in «novita» e «prenotazione» titolo e nastro vanno a capo insieme.

Lasciate fuori: Q&A, Hair Myth Busted, Product Spotlight, Did you know, Summer Musts, Other Services, How to Maintain.
Molte richiedono oggetti scontornati.

**Aperto:** con font larghi alcuni titoli escono dalla loro forma; l'agente deve ridurne la misura.

#### Neutro

- **Modello:** `parrucchieri/13`, «Hair Salon Instagram Post Template» di ShopRShop Designs,
  https://creativemarket.com/ShopRShop_Designs/10951592-Hair-Salon-Instagram-Post-Template. Beige, firma a mano,
  foto ad arco.
- **Font:**
  - Cinzel, Bodoni Moda e Playfair Display per i titoli;
  - Montserrat, DM Sans e Arimo per i testi;
  - Mrs Saint Delafield per la firma.

  Con un brand, titoli e testi diventano i due font del brand.
- **Palette demo:** dai pixel del modello: `#1F1B18`, `#BD9E84`, `#866B4F`, `#E6D7C8`.
- **Foto:** dieci, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «We make your hair beautiful» |
| prima-dopo | «Before & After» |
| consiglio | «Tip of the day» |
| recensione | scheda recensione con la barra di ricerca |
| listino | «Treatment – Price List» |
| prenota | «Book an appointment today!» |
| offerta | «$25 OFF – Limited time offer» |
| salone | collage «hair salon – cutting & hair care» |

**Diverso dal modello:**
- il modello è quadrato: tutto allungato a 4:5;
- stelle della recensione nell'accento invece che oro;
- la firma è «il salone»;
- lo sconto è «20%» senza segno meno;
- la scheda del consiglio si allunga se il testo è più lungo.

**Aperto:** la foto della copertina è un po' più fredda dell'originale.

#### Barberia

- **Modello:** `parrucchieri/16`, «Barbershop V.4» di Azruca,
  https://creativemarket.com/Azruca/5280346-Barbershop-V.4-Instagram-Templates. Scuro, verde militare e cammello,
  carta stropicciata.
- **Font:** Bevan per i titoli (il modello usa uno slab tipo Clarendon pesante, non uno stencil), Bebas Neue per i testi.
- **Palette demo:** cammello `#C9AF7E`, verde militare `#4A5444`, carta `#DCDCD9`, antracite `#363635`.
- **Foto:** dodici, Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «No barber shaves so close but» |
| servizio | «Classic haircut» |
| offerta | «Styles / Offer you can customize» |
| barbiere | «Musctache popular» |
| recensione | «It's more than a haircut» |
| consiglio | «What your favourite style hair» |
| bottega | «To make / a fine gentleman» |
| annuncio | «We are open» |

**Diverso dal modello:**
- nel «barbiere» il nome è diviso tra le due fasce invece di essere ripetuto e tagliato;
- nella «recensione» le scritte della fascia stanno dentro l'immagine;
- in «bottega» c'è un barbiere con un cliente invece dell'interno pieno di barbieri;
- testi rimisurati per reggere font larghi.

**Aperto:**
- con un brand dai colori accesi l'annuncio diventa una pagina tutta nell'accento;
- il titolo in accento sulla foto della copertina può avere poco contrasto;
- in «servizio» il secondario non compare.

## Dove sta cosa

- Catalogo e descrizioni: `moonbrand-shared/src/domain/templates.ts`, `moonbrand-shared/src/i18n/messages/catalog.ts`.
- Template: `plugin/templates/<id>/` (`TEMPLATE.md`, `layout/`, `esempio/`, `anteprima/`), contratto in `plugin/templates/README.md`.
- Copia nella cartella del brand con colori e font: `src/lib/templates.ts`. Font e link di Google Fonts: `src/lib/fonts.ts`.
- Regole per chi fa i contenuti: sezione «Il template» del CLAUDE.md del brand (`templateSection`), sezioni «I font» e
  «Il logo», skill contenuti.
- Esempi dell'onboarding: `src/jobs/visual.ts`. Font dal sito: `src/jobs/website.ts`.
- Studio: passo Visual (`moonbrand-studio/src/app/features/onboarding/steps/visual-step.*`), anteprime in
  `moonbrand-studio/public/templates/<id>/`.
