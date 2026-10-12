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
5. **12/10, ristorazione.** I 30 set di bakery scaricati da Etsy, un agente per set con un brief comune, fino a 16
   alla volta. Nessuno scartato; dove due set venivano dallo stesso negozio il secondo agente ha evitato i segni del primo.

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

### Ristorazione

I 30 set di `moonbrand-examples/bakery/` (Etsy, scaricati il 12/10), uno per template: panetterie, pasticcerie,
bar-pasticceria. Nessuno scartato, nemmeno quelli con 4 o 5 immagini. Alcuni vengono dallo stesso negozio Etsy: cannella,
sfogliatina e maritozzo; glassa e focaccia; cornetto, girella, lampone e frusta; nocciola e ciambella. Per sfogliatina,
maritozzo e focaccia l'agente ha scelto slide e segni diversi dal template già fatto; gli altri si somigliano poco.

Comune a tutti:
- **Prodotti scontornati.** I modelli di bakery sono pieni di dolci ritagliati che passano davanti ai titoli; le foto
  d'esempio sono JPEG. Le soluzioni usate, tutte scritte nel TEMPLATE.md di chi le usa:
  - foto su fondo bianco in `mix-blend-mode: multiply` (cacao, fragola, mollica, lampone, albicocca, focaccia, frolla):
    regge solo con uno `--sfondo` chiaro;
  - filtro SVG che rende trasparente il bianco o il nero (ganache, briciola): regge su ogni fondo ma solo con foto su
    fondo uniforme;
  - maschera in un `<mask>` SVG con un file `<nome>-maschera.jpg` accanto alla foto (crosta, sfogliatina, tostato,
    pagnotta): pulita, ma con una foto nuova serve una maschera nuova. `mask-image` del CSS con `file://` non si carica;
  - foto rettangolari o tagliate a cerchio, ovale, arco (tutti gli altri).

  Con le foto vere del brand l'agente toglie l'effetto e mette il prodotto in un riquadro.
- **Titoli che si adattano.** Molti layout (cannella, moka, cacao, fragola, ciambella, ganache, crosta, lampone,
  maritozzo, sfogliatina) hanno un piccolo script `data-max` o `data-adatta` che rimpicciolisce il titolo quando il
  font del brand è più largo: senza, con Sora i titoli uscivano dal bordo.
- **Font fissi.** Il corsivo calligrafico o a mano (Pinyon Script, Great Vibes, Allison, Sacramento...) resta quello del
  modello anche con un brand: è il segno del template.
- **Testo sui pieni.** Dove il fondo è un colore del brand, il testo sopra diventa chiaro o scuro da solo
  (`--su-accento`, `--su-secondario`) secondo la luminosità.
- **Foto:** Pexels quasi sempre. Gli id si trovano leggendo le pagine di ricerca con WebFetch; curl prende 403 sulle
  pagine, `images.pexels.com/photos/<id>/pexels-photo-<id>.jpeg` invece scarica.

#### Cannella

- **Modello:** `bakery/01`, «Bakery/Café Instagram templates» (76 post), https://www.etsy.com/listing/4373919454. Rosa cipria e rosso con il crema delle righe; serif classico grande spesso maiuscolo e grottesco geometrico; foto di dolci da vicino in arco, tondo o a strisce; carta vera (manifesto stropicciato, sacchetto).
- **Font:** Cormorant Garamond (titoli; 700 per «Our New»), Montserrat (testi, sembra lo stesso), Allison (scritte a mano della novità).
- **Palette demo:** principale `#BE1B2C`, secondario `#F2EEE2`, accento `#CA1B2C`, sfondo `#F2D6D2`.
- **Foto:** 11 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Borcelle Cafe / You're Invited / BRUNCH & LUNCH» |
| aperti | «OPEN EVERYDAY / WE ARE OPEN» (manifesto sulle girelle) |
| preferito | «Staff Fave of the Month» |
| eventi | «UPCOMING EVENTS» |
| novita | «Our New DESSERT MENU» |
| ingrediente | «Ingredient Spotlight» |
| mattina | «MORNING MOOD» |

**Diverso dal modello:**
- aperti, eventi, novita, mattina erano storie 9:16 portate a 4:5;
- cornetto scontornato della copertina = foto rettangolare al centro;
- titolo verticale di eventi senza ombra, un solo blocco, a 44 px dal bordo;
- copertina/ingrediente/eventi/preferito hanno un piccolo script che rimpicciolisce il titolo con font larghi (data-max);
- righe di mattina = secondario schiarito;
- manifesto e sacchetto = carta con rumore SVG, carta e nastro con colori fissi (oggetti), fiocco in accento;
- riquadri data color-mix accento/sfondo;
- etichette 24 px invece di 20.

**Lasciate fuori:** BAKERY ripetuto, New!, baguette nel sacchetto, Weekly Bestseller, Vanilla Berry Cupcake (scontornati); Q&A, FAQ, Coffee event a mano, thank you, Stay tuned, Opening hours, quote of the day, diagramma, finte interfacce.

**Aperto:**
- da valutare pillole orari e bottone Ordina ora (del modello);
- con font larghi le righe del titolo verticale di eventi quasi si toccano;
- pieghe del sacchetto più regolari;
- foto novità più scura;
- lo script di adattamento usa document.fonts.ready: verificare che renderizza aspetti i font (nelle prove è andato).

#### Cornetto

- **Modello:** `bakery/02`, «Bakery/Cafè 77 Instagram Templates» di Noèka Lab, https://www.etsy.com/listing/4402422933. Marrone cannella e crema, serif stretto con una parola in corsivo calligrafico, foto di forno calde da vicino.
- **Font:** Noto Serif Display stretto 75% (titoli; serif condensato ad alto contrasto più vicino), Open Sans (testi), Pinyon Script (parola corsiva, fissa), Poppins corsivo semigrassetto (logo nel riquadro), Questrial (numeri calendario).
- **Palette demo:** principale `#8E4922`, secondario `#DCBDA0`, accento `#964A28`, sfondo `#FAEAD0`.
- **Foto:** 13 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Freshly Baked» |
| dietro-le-quinte | «Behind the scenes in the Bakery» |
| menu | «Bakery Menu» |
| offerta | «Sweet deal of the week / 2x1 on all cookies!» |
| recensioni | «your words, our Motivation» |
| fornaia | «Meet the baker» |
| storia | «How it all started» |
| evento | «CHRISTMAS Sale» con calendario 12-13-14 |

**Diverso dal modello:**
- storie 9:16 e post portati a 1080x1350, distanze verticali stimate in recensioni e dietro-le-quinte;
- oggetti scontornati diventano foto (biscotto a cerchio, cornetto in fascia che esce dal basso);
- carta stropicciata di menu = grana SVG leggera;
- arancio di logo/filetti/riquadro/bottone su accento con --su-accento;
- in copertina corsivo e serif si toccano appena (renderizza segnava sovrapposizione);
- offerta in colonna unica che si allunga;
- testi piccoli portati a 24 px;
- calendario 11-12-13 dicembre 2026 col 12 cerchiato.

**Lasciate fuori:** slide con oggetti scontornati (BAKERY ripetuto, CROISSANT Soft & Crunchy, Cake of the week, Join our team, motivo a righe), disegni a linea (from Heaven, Open Hour), finte interfacce (Delivery, Tag us, conto alla rovescia, Did you know, Ask me anything), FAQ e Coming soon, più altre oltre il tetto di 8.

**Aperto:**
- corsivo resta Pinyon Script anche con un brand;
- con font larghi «Forno» va su tre righe e «cominciata» tocca il bordo;
- paragrafo sulla foto fitta della copertina si legge meno;
- fumetti chiari delle recensioni da verificare con sfondo scuro.

#### Glassa

- **Modello:** `bakery/03`, «Bakery & Pastry Store Posts & Stories» (Little Bakery), https://www.etsy.com/listing/4406748503. Cioccolato, terracotta e pesca; titoli tondi e grassi accanto a un corsivo, foglietti di carta col nastro adesivo sopra foto di forno, stelline e frecce a ricciolo disegnate a mano.
- **Font:** Bagel Fat One (titoli; il bubbly del modello non è su Google; nei layout peso 800 con font-synthesis none), Poppins (testi, uguale), Great Vibes fisso (righe in corsivo).
- **Palette demo:** principale `#3D2420`, secondario `#A8705E`, accento `#D9C39A`, sfondo `#F0E1D1`.
- **Foto:** 10 (8 Unsplash, 2 Pexels).

| Layout | Slide del modello |
|---|---|
| copertina | «Little BAKERY» |
| orari | «Opening hours» |
| listino | «Little Bakery's Price List» |
| offerta | «Buy 1 Get 1 free» |
| prodotto | «Let's eat some CAKE» |
| contatti | «Contact us / Get a sweet treat now» |
| sfornati | «Freshly Baked» |
| crostate | «Bakery Tarts & Pies» |

**Diverso dal modello:**
- in copertina e prodotto foto non a tutto campo, rimpicciolite e fuse col fondo (multiply e maschera radiale);
- in prodotto pane a fette invece della torta («Oggi ci vuole il PANE»);
- in crostate crostata intera dall'alto a cerchio, niente forchetta;
- bottone e nastro in accento, cornici e fascia contatti in secondario;
- foto di sfornati scurita;
- testi piccoli 22-24 px;
- corsivo fisso, dove fa da titolo (orari, offerta) non prende il font del brand.

**Lasciate fuori:** slide con prodotti scontornati (BAKERY ripetuto, Fruit Galette, Bakery & Cake Shop con la mano...), storie 9:16 e doppioni di sfornati, doppioni del foglietto orari, mockup del post Instagram.

**Aperto:**
- con font larghi il titolo di crostate tocca la crostata e quello di copertina passa i 900 px;
- Great Vibes resta uguale con ogni brand;
- stelline chiare su fondo chiare poco visibili (come l'originale);
- da valutare l'etichetta spaziata del listino (nel modello).

#### Cacao

- **Modello:** `bakery/04`, «150 Bakery social media pack» (post e storie, Canva), https://www.etsy.com/listing/4325988857. Crema e cioccolato, prodotto su fondo chiaro, titoli enormi con un font diverso per post, note a mano in ovali.
- **Font:** titoli League Spartan 700 (copertina, listino), Anton (offerta), Young Serif (gusti), Noto Serif Display wdth 62,5 peso 300 (ricetta, passo, sfornato), Pinyon Script (evento); testi Alegreya corsivo e 800, Young Serif, IBM Plex Sans Condensed, League Spartan secondo il layout; Pinyon Script per la chiusa calligrafica, Nothing You Could Do per note, prezzi e ovali a mano.
- **Palette demo:** principale `#2B1009`, secondario `#5B3621`, accento `#D9D0C1`, sfondo `#FFF7EC`.
- **Foto:** 11 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «introducing, your new favourite» |
| offerta | «DOUBLE FUDGE BROWNIE 50% OFF» |
| listino | «our menu.» |
| evento | «Save The Date !!» |
| ricetta | «BAKING CHOCOLATE chip cookies» |
| passo | «MIXING THE dough 03» |
| gusti | «Nutty Secret» |
| sfornato | «CROISSANT AWAITS» |

**Diverso dal modello:**
- «Nutty Secret» quasi quadrata allungata;
- scontornati = foto su fondo bianco in multiply con luminosità alzata (gusti, sfornato) o a tutta pagina (copertina, ruotata di -36°);
- prodotti del listino a cerchio;
- titoli di gusti e sfornato nel principale;
- ovali, frecce, bollo, pillole e filetti nel secondario (erano neri/marroni), voci del listino in accento;
- evento con velo del principale al 34%, numeri a una cifra;
- script calligrafico non si sovrappone più in passo;
- script data-max sui titoli;
- piega del listino = piano con ombra;
- in offerta niente icone telefono/sito, logo-biscotto = tondo nel secondario.

**Lasciate fuori:** mockup in prospettiva illeggibili e composizioni di scontornati (BREAD DELIVERY, combo deals, Valentine's cake...), giveaway, NEW release, FRESHLY BAKED, BAKERY MENU (doppione), Buy 1 free, Thank you 50k, altri passi del tutorial, icone highlight.

**Aperto:**
- gusti e sfornato in multiply, con sfondo scuro del brand la foto si scurisce;
- la copertina dipende dalla rotazione della foto (si vede un angolo di manica scura) e il testo in basso passa sopra la mano;
- ovali e note a mano con font fisso.

#### Girella

- **Modello:** `bakery/05`, Noèka Lab bakery e caffè, https://www.etsy.com/listing/4591106624. Marrone quasi nero, crema e rosa su bianco caldo, grottesco nerissimo largo, foto di prodotto a tutto campo con fogli, polaroid, fumetti chat.
- **Font:** Archivo 900 largo 112% (titoli; Garet/Agrandir non su Google), Arimo (testi, al posto di Helvetica), Ballet (parola a mano e firma), Nothing You Could Do (note del rullino), Libre Caslon Text (invito copertina, data novità).
- **Palette demo:** principale `#383330`, secondario `#FDF6EC`, accento `#FFA1DD`, sfondo `#F5F4F2`.
- **Foto:** 17 Pexels(16)+Unsplash(1), 3 ritagli.

| Layout | Slide del modello |
|---|---|
| copertina | «we are Open / Opening hours» |
| preordini | «PREORDERS ARE OPEN» |
| bevande | «Choose your drink» |
| novita | «New bake this week» |
| domanda | «I need dessert for the weekend…» |
| metodo | «Our Approach» |
| rullino | «Bakery camera roll» |
| recensione | «Customer kind words» |

**Diverso dal modello:**
- già 4:5;
- bevande strisce con foto vere ritagliate (no bicchieri scontornati), carta = secondario;
- novita cartoncino davanti a bignè col cioccolato invece del vortice con brioche scontornate;
- metodo striscia di biscotti cotti invece di impasto crudo;
- copertina croissant su marmo più radi con velo principale;
- recensione rifatta dalla storia 9:16;
- molla SVG grigia fissa (oggetto);
- fumetto risposta in accento con --su-accento.

**Lasciate fuori:** slide su prodotti scontornati (New flavors, Client's picks, Can't choose one?, Soft & golden, Coming soon); finti widget/app e chat iMessage; From our clients (doppione); slide visibili solo tagliate nei mockup.

**Aperto:**
- da valutare solo cose dell'originale (testi <24px, titolo verticale in metodo);
- etichette recensione poco leggibili sui chiari come nell'originale;
- nella prova carta di bevande/recensione/novita diventa blu pieno, perde il carattere di carta;
- schiuma di bevande più scura del modello.

#### Moka

- **Modello:** `bakery/06`, «40 Canva Instagram Carousel Post Templates» per coffee shop di CieloRosaStudio, https://www.etsy.com/listing/4562748233. Espresso scuro, crema e verde matcha, maiuscoli serif stretti accavallati a un corsivo calligrafico, foto scure e calde a tutto campo, stelline a quattro punte.
- **Font:** Noto Serif Display stretto wdth 62,5 peso 400 (titoli; il didone condensato del modello è a pagamento, questo è meno stretto), Lato (testi, come l'originale), Pinyon Script fisso (parole in corsivo).
- **Palette demo:** principale `#2A2420`, secondario `#8A5A36`, accento `#5F7448`, sfondo `#EEEAE3`.
- **Foto:** 13 Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «GOOD DAYS START WITH GOOD Coffee» |
| menu | «Breakfast MENU» |
| frase | «Powered by coffee & good vibes.» |
| listino | «Seasonal DRINK MENU / PRICE LIST» |
| sfornato | «FRESH FROM Oven» (finestra AirDrop) |
| assaggi | «Little treats» |
| assunzioni | «WE ARE HIRING A BARISTA» |
| pausa | «Life happens Coffee helps» |

**Diverso dal modello:**
- niente scontornati (tazza della copertina = adesivo dal bordo bianco, bicchieri = foto rettangolari dal bordo, tazza in assaggi = tondo);
- «Listino» dentro la larghezza;
- in assunzioni il corsivo non si accavalla al titolo (controllo);
- fascia di frase in accento (era nera), bottone in secondario, AirDrop in accento;
- script data-adatta che stringe i titoli con font larghi;
- grana leggera sui fondi chiari;
- prezzi del listino allineati.

**Lasciate fuori:** persone con teste di bicchieri scontornati, polaroid con fermaglio e chat, bicchiere scontornato su texture, collage doppioni di assaggi, interfaccia fotocamera, slide illeggibili nei mockup.

**Aperto:**
- corsivo resta Pinyon Script (in pausa tutto il titolo, lì il font del brand non c'è);
- da valutare pillole e bottone (del modello);
- testi chiari della copertina su una foto chiara del brand.

#### Ganache

- **Modello:** `bakery/07`, «Cake Shop Instagram templates» (Cake Solo Cakes, 25 post), https://www.etsy.com/listing/4590338116. Cacao scuro e crema con un tocco di senape; titoli grotteschi enormi e strettissimi da bordo a bordo con il dolce scontornato davanti alle lettere; corsivo serif tra filetti sottili; alcuni post a fondo pieno scuro.
- **Font:** Roboto Flex larghezza 25-50% con YTLC/YTUC alti (titoli; il grottesco ultra-stretto del modello non è dichiarato), Anton (ordina), Bagel Fat One (offerta), Poppins (testi), Libre Caslon Text corsivo fisso (frasi, inviti, recensione, tondi).
- **Palette demo:** principale `#2A1B14`, secondario `#4A3226`, accento `#E2A94F`, sfondo `#F3EEE6`.
- **Foto:** 8 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «treat yourself» |
| menu | «CAKE MENU» |
| ordina | «ORDER YOUR CAKE» |
| novita | «limited edition alert!» |
| offerta | «BUY 2 GET 1 FREE» |
| recensione | «CUSTOMER LOVE» |
| pasticcere | «meet the baker» |
| golosi | «CHOCOLATE CHOCOLATE CHOCOLATE» |

**Diverso dal modello:**
- lo scontorno lo fa un filtro SVG sulle foto JPEG (.chiaro toglie fondo chiaro, .scuro fondo nero), servono foto su fondo uniforme, le panne bianche diventano trasparenti;
- in golosi clip-path sul bordo della fetta, fetta su piatto invece di spatola e mano;
- in pasticcere foto delle mani in rettangolo senza scontorno;
- in menu torta su alzata nera;
- copertina crostatina in mano invece della fetta sulla forchetta, offerta mano con bignè invece della red velvet spezzata;
- script data-max che restringe i titoli con font larghi;
- filo di ordina e stelle in accento;
- elenco con trattini lunghi diventato una frase.

**Lasciate fuori:** 17 variazioni dello stesso schema (titolo enorme + dolce scontornato): tenute le 8 che coprono più usi.

**Aperto:**
- scontorno solo con foto su fondo chiaro o nero uniforme, con foto vere del brand va tolta la classe e il titolo non passa più dietro (scritto in TEMPLATE.md);
- con sfondo scuro del brand le parti bianche dei dolci diventano trasparenti;
- in offerta il profilo sta sopra il braccio;
- da valutare solo cose del modello.

#### Fragola

- **Modello:** `bakery/08`, «Bakery Social Media Template» (Canva, 45 post), https://www.etsy.com/listing/4530135167. Rosa acceso su crema e marrone, titoli enormi in un solo colore, prodotti veri su fondo chiaro o tenuti in mano, ogni slide con una voce tipografica sua.
- **Font:** titoli Noto Serif Display stretto (copertina, prodotto, dolce); per layout Old Standard TT (colazione), Bodoni Moda (torta), Gochi Hand (menu), Young Serif (orari), Unbounded 800 (offerta); testi Roboto Mono, Questrial, Poppins, Archivo, Karla corsivo, Old Standard TT, Unbounded secondo il layout; La Belle Aurore per note a mano.
- **Palette demo:** principale `#3A2216`, secondario `#8E4A26`, accento `#F862C0`, sfondo `#F3ECE0`.
- **Foto:** 9 Pexels (5 su fondo bianco schiarite, 2 con fondo allungato).

| Layout | Slide del modello |
|---|---|
| copertina | «Bakery & Cake Shop» |
| prodotto | «Croissant.» |
| colazione | «Time for breakfast» |
| dolce | «Tiramisu cake» |
| torta | «Let's eat some CAKE» |
| menu | «Bakery Favorites» |
| orari | «Open Hours» (scontrino con molletta) |
| offerta | «Cookies Sale 50% off» |

**Diverso dal modello:**
- scontornati = foto vere su fondo bianco fuse con multiply (in copertina cornetto invece di scone);
- in torta il dolce non copre la parola grande;
- in dolce fondo di legno scuro invece del drappo;
- in offerta il bollo accanto alla seconda riga (controllo);
- cornice a onde su quattro lati nel menu, schizzi ridisegnati in SVG;
- script che rimpicciolisce il titolo della copertina;
- molletta grigio metallo unico colore fisso, scontrino = sfondo schiarito.

**Lasciate fuori:** Cookie Attack!, Baking soon, Open daily, folded gold., It's brunch o'clock (scontornati o doppioni), collage di 01.jpg, profilo Instagram (mockup interfaccia).

**Aperto:**
- con sfondo bianco del brand si vede lo stacco tra muro beige della foto e lo sfondo in copertina, cornetto troppo schiarito;
- da valutare solo cose del modello;
- in orari il nome nel logo resta in Noto Serif Display finché non c'è il file del logo.

#### Albicocca

- **Modello:** `bakery/09`, «Bakery Shop Instagram Feed» (immagini 03-05; le 01-02 dell'inserzione sono un altro set rosa, non usato), https://www.etsy.com/listing/4531411658. Corallo e giallo su grigio caldo chiaro, titoli enormi grotteschi o monospazio, dolci scontornati che coprono il titolo, ellissi inclinate, stelline a quattro punte e frecce a mano.
- **Font:** Archivo 800 (titoli copertina, promo, sfornato), IBM Plex Mono 700 (altri titoli), Arimo (testi, per l'Arial), IBM Plex Mono corsivo fisso (etichette nelle ellissi).
- **Palette demo:** principale `#E35F52`, secondario `#5C4646`, accento `#F2D512`, sfondo `#E3DFDA`.
- **Foto:** 11 (6 Pexels, 5 Unsplash), 6 su fondo bianco ripulite.

| Layout | Slide del modello |
|---|---|
| copertina | «BEST SELLER» |
| promo | «PROMO PROMO… 20% OFF / ONLY MONDAY» |
| classifica | «BEST TOP 3 BAKERY IN AUGUST» |
| ricetta | «TASTE OUR SIGNATURE RECIPE» |
| offerta | «WEEKEND SALE / BUY 3 FREE 1» |
| colazione | «SPECIAL MONDAY OFFER» |
| sfornato | «FRESHLY BAKED» |
| recensione | «CUSTOMER TESTIMONIAL» |

**Diverso dal modello:**
- scontornato finto = foto su fondo bianco in multiply più div.sagoma con clip-path che segue il dolce e copre il titolo (poligono da rifare cambiando foto);
- in promo la parola ripetuta viene dal CSS;
- in ricetta foto rettangolare a tutta larghezza;
- torta su alzata e cupcake al posto degli originali;
- classifica con cuori interi;
- ellissi e fumetti in accento e secondario, scritte nelle ellissi gialle in secondario scurito;
- slide allungate a 4:5.

**Lasciate fuori:** NEW / MIX CAKE e CHOOSE YOUR FAVORITE TREAT (servono scontornati veri), tutto il set rosa delle immagini 01-02.

**Aperto:**
- scontornato regge solo con foto su fondo chiaro uniforme e sfondo del brand chiaro;
- leggero alone della sagoma sopra la macchia d'accento;
- con font larghi «WEEKEND» vicino ai bordi;
- due da valutare (testi vicini al bordo) come nell'originale.

#### Caramello

- **Modello:** `bakery/10`, «Bakery Instagram Posts» (50 post Canva di Casuarrina), https://www.etsy.com/listing/4329128419. Marrone caramello, nero caffè e crema; serif da rivista anche corsivo, foto del prodotto da vicino velate o sotto pannelli chiari, linee sottili, archi e fasce marroni.
- **Font:** Playfair Display (titoli, uguale), Poppins (testi, uguale).
- **Palette demo:** principale `#1F1612`, secondario `#B88E68`, accento `#7E5235`, sfondo `#FDF5EC`.
- **Foto:** 10 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Croissants / FRESHLY BAKED. FLAKY. FLAWLESS» |
| menu | «Our Menu» |
| orari | «OPENING HOURS» |
| offerta | «SPECIAL OFFER Bakery Sale UP TO 50% OFF» |
| novita | «New FLAVOR» |
| recensione | «Client Review» |
| sondaggio | «This or That» |
| curiosita | «DID YOU KNOW?» |

**Diverso dal modello:**
- nel menu tre crostate scontornate = tre foto tonde tagliate dal bordo, voci con prezzo;
- descrizioni menu a 24 px;
- carta stropicciata di curiosita = foto in bianco e nero moltiplicata sul secondario;
- titolo di sondaggio più piccolo (118 px) per «Questo o quello»;
- filetti ai lati di «Nuovo» si adattano alla parola;
- arance fresche invece che essiccate nella recensione;
- copertina velata con l'accento.

**Lasciate fuori:** 19 slide leggibili ma con impaginazioni già prese o poco utili (Giveaway, Coming soon, About us, Flash sale, FAQ, Best seller, ...).

**Aperto:**
- da valutare solo cose del modello (riga spaziata, stelline);
- foto di cannoli e tiramisù a fondo scuro (nell'originale chiare);
- con secondario molto scuro la carta della curiosità diventa quasi nera, il testo resta leggibile.

#### Mollica

- **Modello:** `bakery/11`, «Bakery Instagram Post Bundle» (80+ post e storie, Canva), https://www.etsy.com/listing/4495382408. Crema pieno e marrone caffellatte con tan chiaro; serif classico grande (maiuscolo, corsivo grassetto); prodotti scontornati su fondo bianco fusi con lo sfondo, forme piene tonde.
- **Font:** EB Garamond (titoli, inviti, nomi prodotti, bottoni in serif), Open Sans (testi).
- **Palette demo:** principale `#5A442F`, secondario `#E2C7AC`, accento `#61432B`, sfondo `#F6F4E7`.
- **Foto:** 15 file da 12 foto Pexels, schiarite per il multiply.

| Layout | Slide del modello |
|---|---|
| copertina | «A Slice of Happiness Awaits» |
| novita | «Morning Starts With a Roll» |
| offerta | «Get 10% off on all freshly baked goodies» |
| menu | «Bakery Menu» |
| prenota | «August pre order cookies» |
| recensione | «Why they love it» |
| racconto | «Crispy on the outside and soft on the inside.» |
| visitaci | «Try them today!» |

**Diverso dal modello:**
- scontornati = JPEG su fondo bianco in multiply (su fondi scuri non regge, scritto in TEMPLATE.md);
- cerchio, metà bassa, fascia, esplosione e bottone usano una tinta chiara del secondario oklch(max l 0.85, max c 0.07) perché con un secondario saturo i prodotti diventavano blu;
- bottoni scuri in accento;
- menu, recensione e prenota da storie 9:16 ricomposte;
- tondi di prenota = foto a cerchio;
- pancarrè in visitaci;
- testi piccoli a 24 px.

**Lasciate fuori:** collage di più scontornati (Bread Lovers Rejoice, BAKERY ripetuto, brownies, Our Best Seller Cookie, Our Story, Cookie box...), sondaggi e quiz da storia, mockup su telefono.

**Aperto:**
- da valutare solo cose del modello;
- con secondario saturo leggera dominante sui prodotti;
- piccola ombra grigia sulle girelle in novita;
- foto di fondo non fuse in racconto, recensione, offerta;
- nessun elemento logo nelle slide scelte.

#### Nocciola

- **Modello:** `bakery/12`, «Bakery Instagram Post Templates» (The Avery Shop), https://www.etsy.com/listing/4459334579. Marrone nocciola e crema, fondi a tinta unita, prodotto dall'alto ritagliato in tondo od ovale, serif elegante con una parola in corsivo calligrafico, capsule a filo.
- **Font:** titoli diversi per layout: Oswald 700 (copertina), Gilda Display (offerta, stagione, visione), Lexend 700 (storie, consigli, ingredienti); testi Source Sans 3 (Poppins in offerta); Pinyon Script per la parola corsiva e il titolo della recensione; Gilda Display scritto direttamente per le righe introduttive di consigli e ingredienti.
- **Palette demo:** principale `#5E2A1C`, secondario `#7F5943`, accento `#F3EFEA`, sfondo `#E9E1D6`.
- **Foto:** 8 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «SALE SALE SALE SALE» (biscotto) |
| offerta | «new flavour / get 15% off / Special OFFER» |
| storie | «Our Best Stories» |
| consigli | «MINDFUL BAKING» (3 capsule) |
| ingredienti | «benefits of BAKERY» |
| recensione | «Client Review-Testimonial» |
| stagione | «New Season, New Bakes» (titolo su arco, foto ovale) |
| visione | «Vision / Our mood» |

**Diverso dal modello:**
- copertina «SALDI» con le righe dentro il bordo (nel modello escono, renderizza segnava);
- biscotto, piatto, cesto = foto ritagliate in tondo/ovale (nel cesto resta un po' di tovaglia);
- stelle in principale (erano nere), scheda = sfondo schiarito, manca la scritta in trasparenza dietro;
- in visione manca la stellina nella «O»;
- arco di stagione con textLength fisso 800 px;
- testo sul secondario con --su-secondario;
- modello un po' più alto di 4:5 riportato a 1080x1350.

**Lasciate fuori:** slide visibili solo tagliate nei mockup, DAILY TIP (interfaccia), diagrammi decorativi, foto con sole scritte, NEW NEW (doppione della copertina), planner.

**Aperto:**
- capsule da valutare (del modello);
- con accento simile al secondario la parola ripetuta si legge male;
- con sfondo bianco la scheda della recensione si vede solo per il filo;
- righe introduttive restano in Gilda Display;
- con font larghi l'arco schiaccia le lettere.

#### Latte

- **Modello:** `bakery/13`, «200+ Bakery Insta Posts, The Latte Collection» (post e storie, Canva), https://www.etsy.com/listing/1471411387. Caffellatte, crema e caramello, un serif diverso per ogni post, foto calde nei tondi o a tutto campo.
- **Font:** titoli per layout: Playfair Display (copertina; 900 per le virgolette della citazione), Bellefair (concorso), Yeseva One (recensione), Gilda Display (prodotto), Gloock (vetrina), Lora (listino), Bodoni Moda (novita); testi Montserrat, Poppins, Prata o Lora; Ms Madi (parola a mano della copertina), Quicksand (logo nell'ovale del listino).
- **Palette demo:** principale `#2E2420`, secondario `#B98E6B`, accento `#5A2C1E`, sfondo `#FCF6F1`.
- **Foto:** 8 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Enjoy Breakfast Cookies» |
| concorso | «Giveaway / Get our product for free» |
| citazione | «People do not notice whether it is winter or summer when they are happy» (Čechov) |
| recensione | «Client Review» |
| prodotto | «Fresh from oven, Flaky x6, Cinnamon Roll $2.55» |
| vetrina | «Special Today, Choco Berry Cupcake» (ingredienti con frecce) |
| listino | «Master Bread, Bread Price List» |
| novita | «New Product, Organic gluten free bread» |

**Diverso dal modello:**
- post quadrati allungati a 4:5;
- girella scontornata = foto dall'alto in tondo con ombra, parola ripetuta «Burro», le parole non escono dal bordo;
- cesto del listino = foto che sfuma con maschera, icona del pane = nome del forno (logo);
- cupcake un po' più grande;
- blocco della citazione, virgolette, parola ripetuta, titolo curvo e stelle in accento, filetti, raggi, prezzo e fondi pieni in secondario;
- firma senza trattino;
- titoli del concorso e del prodotto un po' più piccoli per i font larghi.

**Lasciate fuori:** This or That, Special Offer Cake (simile al listino), Cinnamon Roll Order Now (spighe da disegnare), slide tagliate o piccole nelle anteprime (Baking, 50% OFF, FAQ, Homemade, Croissant, New Release).

**Aperto:**
- da valutare solo cose del modello;
- con font larghi il titolo di vetrina va su due righe;
- nel listino il cesto scuro si stacca da un secondario chiaro o freddo;
- foto della copertina più chiara in alto dell'originale.

#### Ciambella

- **Modello:** `bakery/14`, «Modern Cafe & Bakery Posts» (THE.AVERY.SHOPP), https://www.etsy.com/listing/4514479468. Grigio chiaro e tortora pieno con rosa e verde matcha di evidenza; grottesco nero, serif classico e corsivo calligrafico enorme; foto ritagliate a cerchio, ovale e arco.
- **Font:** Figtree 800 (titoli copertina, scelta, contatti), Montserrat 800 maiuscolo (orari, riga del menu), Noto Serif Display stretto (menu), Tinos (novita, per il Times), Pinyon Script (chi-siamo, prenotazioni); testi Arimo (per l'Arial), Figtree corsivo, Tinos maiuscolo; Pinyon Script e Tinos corsivo scritti direttamente per dettagli.
- **Palette demo:** principale `#5A4A3D`, secondario `#A9BE5F`, accento `#CF6FA0`, sfondo `#E7E6E2`.
- **Foto:** 11 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Good morning! fresh pastries are ready» |
| orari | «Opening Hours» |
| chi-siamo | «About Us» |
| menu | «How to explore our menu Here Online» |
| scelta | «Pick your drink» |
| novita | «New Season, New Flavor» |
| prenotazioni | «August Clients» |
| contatti | «Contact Us» |

**Diverso dal modello:**
- copertina, scelta, contatti dal quadrato allungati a 4:5;
- bevande scontornate = foto dall'alto a cerchio;
- cerchio del menu = ingrandimento di un waffle rettangolare (si vede un po' di piatto azzurro);
- nastro degli orari in secondario (era grigio), bordo bottone, stella e «tuo» in accento;
- schermo del telefono = color-mix sfondo/principale, telefono grigio fisso (oggetto);
- etichette e titoli chiari con la tinta chiara dello sfondo;
- script data-max in chi-siamo, novita, menu, prenotazioni.

**Lasciate fuori:** slide di scontornati (Iced latte, Coffee Break, Lattetoast, Avocado Toast, Happy Hour, NEW NEW NEW), finti telefoni/tablet, doppioni (We are Open!, 3 Tips), slide leggibili solo in piccolo.

**Aperto:**
- etichette di novita poco leggibili sulle parti chiare della foto (come l'originale);
- il titolo ad arco con font largo si rimpicciolisce parecchio;
- il secondario si vede solo nel nastro degli orari.

#### Crosta

- **Modello:** `bakery/15`, «Baked.» (feed di Flair Nook, Canva, quadrato), https://www.etsy.com/listing/1831177172. Tortora, crema e quasi nero, serif elegante col punto finale («Sfornato.»), foto di forno a tutta pagina e prodotti scontornati con frecce a mano.
- **Font:** Gilda Display (titoli), PT Serif (testi, quasi uguale), Playfair Display corsivo (dettagli in corsivo).
- **Palette demo:** principale `#1C1915`, secondario `#BAA68E`, accento `#522D1A`, sfondo `#F4F1E8`.
- **Foto:** 11 Pexels più 6 maschere ricavate dalle foto.

| Layout | Slide del modello |
|---|---|
| copertina | «Baked. est. 2024» (mani nella farina) |
| inaugurazione | «You are invited to the Grand Opening» |
| chi-siamo | «who's Baked.» |
| listino | «This month's Favorite» |
| novita | «NEW MENU» ripetuto con la girella |
| recensione | (due recensioni a 5 stelle) |
| prodotto | «freshly Baked.» con il brownie |
| domande | «Q & A» |

**Diverso dal modello:**
- quadrato allungato a 4:5 seguendo i tagli 4:5 visibili in 01.jpg;
- scontornati = svg con la foto e una mask di luminanza (<nome>-maschera.jpg fatta con PIL/scipy;
- mask-image CSS su file:// falliva);
- listino con tre cornetti e un caffè freddo;
- frecce, stelle e filetto in accento (erano bianchi/neri);
- scritte sul tortora con --su-secondario;
- «MENU NUOVO» con due girelle glassate;
- «D & R»;
- script data-adatta sui titoli;
- foto della copertina scurita del 20%.

**Lasciate fuori:** Barista Course, Baking Class, team (ritratti scontornati), giochi di parole inglesi (procaffeinating, you just got Baked.), trama di croissant, traguardo follower, Coffee's Speciality (doppione del listino).

**Aperto:**
- in chi-siamo testo bianco sulla farina poco leggibile (come l'originale);
- maschere dei cornetti con filo d'ombra grigia;
- brownie un po' morbido;
- con foto del brand in listino, novita e prodotto serve una maschera nuova, se no il prodotto resta in un riquadro;
- da valutare il corsivo di «grande apertura» (originale).

#### Biscotto

- **Modello:** `bakery/16`, «Bakery Instagram Templates» (100 post, Design Pixie), https://www.etsy.com/listing/4497594004. Rosa e cioccolato, serif morbido e grasso con corsivo a mano, riquadri smerlati, strisce verticali, foto di dolci in tondo.
- **Font:** Caprasimo (titoli, serif retrò grasso), Montserrat (testi; maiuscolo spaziato 700 per etichette e voci), Sacramento (scritte a mano), Anton (archi della copertina, prezzi, «Sconti in corso»).
- **Palette demo:** principale `#57190C`, secondario `#C8926C`, accento `#F7B0C0`, sfondo `#FADDE2`.
- **Foto:** 10 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Loaded cookies» |
| orari | «open today, 9AM to 3PM, see you soon!» |
| listino | «Price List» |
| preferiti | «favorites of the week» |
| fornaia | «meet the baker» |
| recensione | «kind words» |
| offerta | «Sale on now, 25% off sitewide» |
| gusto | «flavor of the month» |

**Diverso dal modello:**
- modello 3:4 allungato a 4:5;
- biscotti scontornati della copertina = foto su fondo scuro fusa nel principale (lighten e maschera), stessa foto sbiadita dietro;
- in gusto foto in tondo senza coriandoli;
- etichette del listino e cartellino del nome in --crema;
- coccarda con testo in principale;
- schede, linguette, bollo e fasce oblique in --tinta (sfondo con velo d'accento);
- disegni a linea di dolci = motivo SVG nostro al 7%;
- segnalibro della recensione con biscotto SVG.

**Lasciate fuori:** slide con frecce e prodotti scontornati (Strawberry cupcake, Customer favorites, Top seller, Best seller), doppioni (holiday hours, menu ad arco), Q&A, giveaway, slide con oggetti disegnati (forno, bancarella, busta), frasi solo tipografiche.

**Aperto:**
- con sfondo bianco del brand la scheda bianca della recensione sparisce;
- la copertina fusa regge solo con principale scuro e foto su fondo scuro;
- da valutare solo cose del modello.

#### Frolla

- **Modello:** `bakery/17`, «Bakery Instagram Templates», griglia coerente di 15 slide dell'immagine 03 («+25 Editable Bakery Instagram Templates»; le altre immagini sono mockup illeggibili di stile misto), https://www.etsy.com/listing/4553903236. Crema e cioccolato, serif maiuscolo spaziato con una parola a mano a pennello, prodotto grande sfumato nel fondo, bollini tondi e fascia marrone in basso.
- **Font:** Cormorant Garamond 500-700 (titoli), Josefin Sans (testi, come il modello), Ephesis fisso (parola a mano, variabile --corsivo).
- **Palette demo:** principale `#3E2116`, secondario `#7B4325`, accento `#A8673E`, sfondo `#F6ECE3`.
- **Foto:** 8 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Freshly Baked» |
| offerta | «Special Offer» |
| prodotto | «Cake of the Day» |
| torte | «Custom Cakes for Every Occasion» |
| menu | «Today's Special» |
| sconto | «Special Discount» |
| orari | «We Are Open» |
| grazie | «Thank You!» |

**Diverso dal modello:**
- slide quadrate allungate a 4:5;
- scontornati = foto con bordi sfumati da maschera (resta un po' del fondo);
- fascia chiara della copertina = sfondo con 7% di secondario;
- cuori, rametti, scarabocchi e festone in SVG su accento e secondario;
- corsivo fisso;
- tolta la cornice a scheda dei mockup, layout a pagina piena.

**Lasciate fuori:** doppioni dell'offerta (cupcake, Weekend Treats), slide coperte dal bollo «+25», slide con la stessa struttura di copertina e prodotto, tutti i mockup delle altre immagini.

**Aperto:**
- da valutare solo cose del modello;
- con font larghi il titolo di offerta finisce in parte sotto la foglia (anche nel modello);
- con fondo scuro le foto sfumate hanno un alone chiaro.

#### Lampone

- **Modello:** `bakery/18`, set di Noèka Lab («One pack. Limitless Combos», 50 post), https://www.etsy.com/listing/4591849178. Rosso pieno e bianco caldo, serif stretto in maiuscolo, dolci fotografati molto da vicino a tutto campo, quattro piccole scritte agli angoli.
- **Font:** Noto Serif a larghezza 62,5-87,5% (titoli, serif di transizione stretto), Archivo (testi), Pinyon Script (scritta a mano in aperti, novita, firma).
- **Palette demo:** principale `#820A0B`, secondario `#E3E2DD`, accento `#F8E8D0`, sfondo `#F5F4F0`.
- **Foto:** 12 (11 Pexels, 1 Unsplash), 5 scontornate su bianco con OpenCV.

| Layout | Slide del modello |
|---|---|
| copertina | «CUSTOM ORDERS» |
| aperti | «we are Open / OPENING HOURS» |
| prodotto | «RASPBERRY FLAVOUR» |
| filosofia | «Our Philosophy» |
| preordini | «PREORDERS ARE OPEN» |
| scelte | «THIS WEEKEND'S PICKS» |
| recensione | «CUSTOMER KIND WORDS» |
| novita | «New Bake THIS WEEK» |

**Diverso dal modello:**
- scontornati = JPEG ritagliati su bianco in multiply sul fondo chiaro;
- in filosofia un solo cornetto ruotato, con piccole sbavature;
- cartoncino delle schede = secondario schiarito, scritta a mano = accento schiarito;
- foto di aperti e novita velate;
- molla della copertina in CSS (oggetto fisso);
- grana SVG sul rosso;
- script data-max sui titoli;
- tolte le inclinazioni dei mockup (resta la polaroid della copertina).

**Lasciate fuori:** Textures e Pastry Menu (ritagli perfetti), svolazzi sui bomboloni, interfacce finte (Pastry Drop, ricerca, chat), Our Signature, prodotti scontornati su fondo pieno, telefono disegnato, slide piccole o doppioni.

**Aperto:**
- scritte agli angoli e testi lunghi a 19-22 px (come l'originale);
- su principale chiaro le scritte chiare della copertina si leggono poco;
- con sfondo scuro gli scontornati mostrano il fondo bianco;
- polaroid di preordini sparisce su sfondo bianco;
- candele visibili in preordini, ombra sul caffè freddo.

#### Cioccolato

- **Modello:** `bakery/19`, «Cake Artist Carousels» (10 caroselli, 70 slide), https://www.etsy.com/listing/4591529844. Cioccolato, crema e beige con un nocciola; serif classico, foto di torte in luce calda ad arco, in cornice o in fascia a tutta larghezza.
- **Font:** Libre Baskerville (titoli, uguale), Montserrat (testi, uguale).
- **Palette demo:** principale `#33231C`, secondario `#DED3C1`, accento `#B39572`, sfondo `#F8F0E5`.
- **Foto:** 7 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Find your CAKE STYLE» |
| stile | «Minimalist» |
| arco | «Botanical» |
| prenotazione | «When is your date reserved?» |
| listino | «A guide for your cake» |
| cura | «Care for this particular cake» |
| voto | «Which one feels most like you?» |
| chiusura | «Your style. Your celebration.» |

**Diverso dal modello:**
- i caroselli del modello sono una tela continua, qui ogni slide è a sé (le fasce non continuano);
- beige delle slide di mezzo = secondario schiarito (l almeno 0,86);
- segnaposto tra parentesi diventati testi veri;
- testi del corpo a 22-24 px;
- rettangolo sfalsato, cornici, filetti, numeri e striscia in accento, barra del voto in principale.

**Lasciate fuori:** diagramma degli strati e foto rotonda con cerchietti numerati (grafica su misura), slide dei caroselli leggibili solo in miniatura che ripetono gli schemi.

**Aperto:**
- da valutare numeri 01-04 e scritte sotto i 24 px, come nell'originale;
- con brand a fondo bianco il secondario schiarito di arco diventa azzurro pastello (si legge);
- foto più fredde e meno uniformi di quelle in studio del modello.

#### Sfogliatina

- **Modello:** `bakery/20`, set Canva per bakery con la copertina «BAKERY» (stesso negozio di cannella), https://www.etsy.com/listing/1801818842. Giallo burro, nero e crema, serif didone alto e stretto (anche corsivo maiuscolo), foto calde di sfoglia a tutto campo, lettere giganti e scritte inclinate.
- **Font:** Noto Serif Display font-stretch 62,5-87,5% (titoli), Montserrat (testi, come il modello), Ms Madi (firma a mano «Speciale di oggi»).
- **Palette demo:** principale `#1B1A17`, secondario `#8B6B47`, accento `#F5D35A`, sfondo `#F3EEE5`.
- **Foto:** 6 Pexels più una maschera.

| Layout | Slide del modello |
|---|---|
| copertina | «BAKERY BAKERY BAKERY» con croissant scontornati |
| speciale | «Special Today / VANILLA BERRY CUPCAKE» con frecce a mano |
| domande | «Q & A» |
| recensione | «Absolutely in love with this place!» |
| perte | «JUST for you / Brewed to Perfection» |
| arrivo | «NEW RECIPE / NEW TREAT IS LOADING» |
| faq | «FAQ / QUESTION / ANSWER» |
| tre | «Sweet / Fluffy / Buttery» (cerchi di Venn) |

**Diverso dal modello:**
- parola ripetuta e lettere giganti dentro i bordi (nel modello tagliate, renderizza segnava);
- scontorno = foto con mask SVG, ombra in secondario scurito;
- «D & R» con & e R dentro l'elemento della D;
- testi lunghi chiari invece che gialli (regola accento), stelle e nome in accento;
- foto scurite;
- speciale con 3 ingredienti e un brownie;
- in tre niente carta piegata (c'è già in cannella);
- FAQ, tre e recensione da quadrate a 4:5;
- script che rimpicciolisce i titoli. Scelte slide diverse da cannella.

**Lasciate fuori:** slide che ripetono cannella (eventi verticale, brunch, aperti, titolo curvo), tazza disegnata, NEW NEW NEW, quote card, campo commenti finto, slide piccole o con interfacce, slide di vendita.

**Aperto:**
- da valutare del modello (parole vicino al bordo, nome piccolo nell'ovale, maiuscolo spaziato);
- ovale del nome un po' simile all'etichetta di cannella;
- la copertina con foto del brand richiede prodotto scontornato o maschera;
- font-stretch solo con font che hanno l'asse larghezza (con Sora righe più basse e vuoti);
- in arrivo l'accento sulla foto scura si legge appena.

#### Briciola

- **Modello:** `bakery/21`, «230 Bakery Themed Instagram Templates» (DigiCraftStyle, Canva), https://www.etsy.com/listing/1876875262. Fondo quasi bianco o carta stropicciata, serif nero pesantissimo, prodotti scontornati che galleggiano sulla pagina, tocchi sabbia e caramello.
- **Font:** Literata 900 con opsz 12 (titoli; il serif Canva pesante a basso contrasto non è su Google, Gloock aveva troppo contrasto), Newsreader 300/400 (testi).
- **Palette demo:** principale `#161311`, secondario `#D3B48E`, accento `#C2864E`, sfondo `#EEEDEA`.
- **Foto:** 11 (9 Pexels, 2 Unsplash; la carta e un cornetto copiato da albicocca).

| Layout | Slide del modello |
|---|---|
| copertina | «Premium Bakery» |
| croissant | «We bake fresh pastries every day / Croissant» |
| dolce | «Special Dessert / Cinnamon Roll $6.50» |
| menu | «Bakery Menu» |
| orari | «Opening Hours» |
| colazione | «breakfast time / Coffee + fresh croissant» |
| sfornato | «Fresh Out of the Oven & Into Your Heart!» |
| inaugurazione | «grand opening» |

**Diverso dal modello:**
- storie 9:16 ricomposte in 4:5;
- scontornati = JPEG a fondo bianco con filtro SVG #scontorna sulla classe .ritaglio che rende trasparente il bianco (multiply colorava di blu con la prova);
- piatto del dolce ritagliato a cerchio;
- testi delle pennellate in accento (erano sabbia);
- invito in tinta chiara dello sfondo;
- fascia e piede con color-mix accento/principale;
- «affè» staccato dalla C (renderizza);
- foto di sfornato e inaugurazione scurite;
- logo a icona = nome del brand in testo.

**Lasciate fuori:** post quadrati di 02 e 05 (altro stile), copertine di storie miste, doppioni o slide solo in prospettiva, slide di vendita.

**Aperto:**
- da valutare del modello (pillole, «grande» vicino al bordo, «Merenda» larga);
- il filtro scontorna regge solo con foto su fondo bianco, con foto del brand si toglie .ritaglio (scritto in TEMPLATE.md);
- ombre grigie sotto i prodotti sui fondi colorati;
- con un accento caldo vicino al pane il titolo di sfornato e inaugurazione è al limite del contrasto.

#### Tostato

- **Modello:** `bakery/22`, «12 cafe-bakery templates» (marchio finto «psomi»), https://www.etsy.com/listing/4469013896. Grigio tortora con grana di cemento, titoli grassissimi tondi in crema minuscolo, scritte a pennarello marrone su carta, prodotti scontornati enormi.
- **Font:** Bagel Fat One (titoli), Gochi Hand (testi e scritte a mano grandi, al posto del pennarello).
- **Palette demo:** principale `#FEFFF1`, secondario `#7B3F20`, accento `#8C7563`, sfondo `#A59A90`.
- **Foto:** 8 Pexels (3 scontornate con la loro -maschera.jpg).

| Layout | Slide del modello |
|---|---|
| copertina | «good morning» |
| speciale | «today's special vanilla cake» |
| fame | «hungry?» |
| brunch | «Brunch Daily 10 am - 14 pm» |
| orari | «We Are Open 8AM-6PM» |
| visita | «Visit our Cafe» |
| scontrino | «psomi … TOTAL VISIT US!» |
| novita | «we serve matcha tea!» |

**Diverso dal modello:**
- marchio = nome in testo con un pane a linea in SVG e la riga «panetteria & pasticceria»;
- carta = sfondo schiarito, scritte a mano in secondario;
- caffè freddo in copertina, cornetto aperto senza briciole in fame;
- brunch con baguette ruotata e fogli strappati in clip-path;
- pani impilati negli orari;
- cartello di visita in CSS con cavalletto SVG;
- voci dello scontrino a mano, niente chicchi;
- novita con cornetti scuriti al posto della trama di matcha;
- grana di cemento come rumore SVG.

**Lasciate fuori:** freshly baked (pancarré a motivo), Happy Woman's Day, latte time (doppione), tre fasce di bevande, griglia e mockup del feed.

**Aperto:**
- da valutare del modello;
- nella prova logo scuro sopra il dolce in speciale si legge meno;
- con secondario chiaro le scritte sulla carta si leggono poco, con principale e sfondo entrambi chiari i titoli spariscono;
- con font larghi la frase di brunch va su due righe;
- piccola ombra grigia sotto il cornetto.

#### Pralina

- **Modello:** `bakery/23`, «Bakery Shop Instagram Post + Story» (Very Social Design), https://www.etsy.com/listing/4313532785. Tortora e cipria, serif classico con una parola scritta a mano, foto calde in ovali, cerchi e archi.
- **Font:** Libre Baskerville (titoli e testi, come il serif del modello), Allison (parola a mano, fissa).
- **Palette demo:** principale `#85564D`, secondario `#B6A18E`, accento `#9C6B5F`, sfondo `#E8E0D8`.
- **Foto:** 10 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Love at first bite» |
| chi-siamo | «About us» |
| ripetuto | «Baker baker baker» (parola ripetuta con cerchio di foto) |
| amore | «baked with love» |
| piu-amato | «weekly best seller» |
| menu | «Our menu» |
| sconto | «30% off today!» |
| recensione | «Testimonials» |

**Diverso dal modello:**
- modelli quadrati allungati a 4:5;
- in ripetuto la parola sta in una variabile CSS e la ripete ::before (come testo vero renderizza segnava le righe tagliate);
- in piu-amato cornetti scontornati = foto con bordo alto frastagliato (clip-path);
- in sconto «oggi!» sotto e non sovrapposto;
- parola a mano e cuore in accento, stelle in tinta chiara dello sfondo;
- recensione da storia 9:16 ricomposta.

**Lasciate fuori:** We are open (quasi uguale alla copertina), slide coperte dai mockup o poco leggibili, pagine dell'inserzione.

**Aperto:**
- con un secondario forte e scuro i testi in principale sul fondo tortora si leggono meno;
- titolo della recensione in Allison, non prende il font del brand;
- da valutare le etichette in maiuscolo spaziato (modello).

#### Frusta

- **Modello:** `bakery/24`, «Bakery 42» di Creative Vibes Lab, https://www.etsy.com/listing/4306798415. Rosso, giallo e nero su bianco caldo, una parola enorme per post, disegni a linea (frusta, cornetto), note di carta su foto di forno da vicinissimo.
- **Font:** titoli per layout: Archivo 900 (copertina), Bagel Fat One (forno, brunch; il display anni Settanta non è su Google), Libre Caslon Condensed (impasto), Oswald 600 (prodotto), Gochi Hand (cornice), Poppins (orari, curiosita); testi Poppins, Oswald, Playfair Display («dal 1958»); Mrs Saint Delafield per la firma, Archivo 900 diretto per la parola gigante di impasto e «Forno» di brunch.
- **Palette demo:** principale `#161412`, secondario `#FFCB00`, accento `#BC1D14`, sfondo `#F4F2F3`.
- **Foto:** 6 Unsplash.

| Layout | Slide del modello |
|---|---|
| copertina | «Bakery.» (frusta disegnata, «since 1930», firma) |
| orari | «open hour» |
| prodotto | «COOKIES» |
| impasto | «FROM FLOUR TO FLAVOR / DOUGH» |
| curiosita | «DID YOU KNOW?» |
| cornice | «CROISSANT» |
| forno | «from HEAVEN (and our oven)» |
| brunch | «BRUNCH 10-12 am not your typical Bakery» |

**Diverso dal modello:**
- in impasto la parola gigante è intera sul bordo basso (nel modello tagliata, renderizza la segnava);
- «Forno.» tutto dentro il post;
- titolo di prodotto in accento rosso (era arancio);
- cornetto e frusta SVG a linea più regolari degli schizzi;
- carta della nota = sfondo ingiallito, righe SVG;
- scheda di curiosita dritta;
- brunch nel font tondo anni Settanta;
- foto con soggetti diversi.

**Lasciate fuori:** slide con oggetto scontornato su fondo pieno (Crispy/Fluffy, get rollin', DONUT worry, ICED COFFEE, BITE ME...), finto post Facebook e barra di ricerca, collage a 9 riquadri, scritte su texture simili a forno e brunch, FAQ illeggibile, doppioni.

**Aperto:**
- da valutare del modello (parole vicino al bordo, scheda arrotondata con ombra);
- con un secondario scuro titolo e parola gigante di impasto si leggono poco sulla foto scura;
- con font larghi titolo di impasto su 3 righe copre le mani;
- Bagel Fat One, Gochi Hand e Oswald 600 con i font del brand escono più leggeri (400);
- foto degli orari più fredda.

#### Pagnotta

- **Modello:** `bakery/25`, «Bakery/Café Instagram, 130 templates» (The Musgram Studio), https://www.etsy.com/listing/4463123413. Arancio caramello, marrone e beige su crema, serif morbidi e grassi (Cooper e Recoleta), scacchi, quadretti da tovaglia, nastro di carta, prodotti scontornati.
- **Font:** Young Serif (titoli, simile a Recoleta), Caprasimo (titoli in maiuscolo grasso tipo Cooper: mercato, domande), Bodoni Moda chiaro (parola verticale di dietro); testi Poppins, Hind, Young Serif secondo il layout; Kalam 700 (scritta a mano nel mito).
- **Palette demo:** principale `#C5752E`, secondario `#865338`, accento `#BE9869`, sfondo `#FDEBD3`.
- **Foto:** 15 Pexels (19 file: tre ritagli di biscotto, tre scontornati con -maschera.jpg).

| Layout | Slide del modello |
|---|---|
| copertina | «New on the Menu» |
| listino | «Bakery Menu» |
| offerta | «Pick Your Cookies» |
| mito | «MYTH: Fresh bread should be soft» |
| mercato | «The Local Market Pop-Up» |
| domande | «Q&A TIME» |
| dietro | «behind the scenes» |

**Diverso dal modello:**
- scontornati di listino, domande e mercato = foto rettangolari tagliate dai bordi;
- un cornetto e un cupcake nel mercato, pagnotta a fette nel mito;
- mercato «IL / FORNO / VA IN / PIAZZA»;
- in dietro la parola verticale più piccola (250 px) per renderizza;
- tolte icone dei contatti e briciole;
- testo sui fondi pieni chiaro o scuro secondo la luminosità;
- nastri, quadretti e scacchi nei colori del brand, pirottino bianco (oggetto);
- linguette in tinte di principale e secondario.

**Lasciate fuori:** slide visibili solo in mockup inclinati o telefoni (ordine, giveaway, FAQ, collab, scontrino...), Special Discount e Creamy Macaron (scontornati a mano, simili), Opening Week (simile al listino), schede di vendita.

**Aperto:**
- da valutare del modello (pillole, riquadri con ombra, parole vicino al bordo);
- nella prova il profilo di domande è smorto;
- bordo del cornetto scontornato con un tratto dritto;
- con secondario chiaro i blocchi pieni diventano chiari e il testo passa a scuro.

#### Mandorla

- **Modello:** `bakery/26`, «The Bakery Instagram Posts» (20 post, 1080x1440), https://www.etsy.com/listing/4571249260. Caramello e cioccolato su carta stropicciata, rosa cipria e crema, serif classico leggero con maiuscolo spaziato, foto calde e scure.
- **Font:** Cormorant Garamond (titoli, come l'originale), Montserrat (testi, come l'originale).
- **Palette demo:** principale `#6B4126`, secondario `#D3A375`, accento `#E8BBA8`, sfondo `#F8F4EC`.
- **Foto:** 10 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Weekend Specials Checklist» |
| alba | «Behind the scenes, Baking Before Sunrise» |
| mito | «Myth or Fact?» |
| stagione | «Our Seasonal Specials» |
| consiglio | «Baking Tip: how to keep bread fresh longer» |
| citazione | «Life is what you bake it.» |
| domande | «3 questions to Ask Your Baker» |
| apertura | «Countdown to freshly baked goodness» |

**Diverso dal modello:**
- modello 3:4 schiacciato a 4:5;
- carta stropicciata = filtro SVG in soft-light sui fondi pieni (alba, domande);
- bollino smerlato e icona del forno ridisegnati in SVG;
- etichette chiare = secondario mescolato con lo sfondo;
- testo su secondario e accento passa da solo tra scuro e quasi bianco;
- in alba etichetta, titolo e orari in una colonna;
- in apertura un conto alla rovescia vero al posto dello spazio vuoto.

**Lasciate fuori:** slide con scontornati, cartine o acquerelli, giochi poco adatti a un forno italiano, doppioni (This or That, Afternoon Tea, Bakery Trends, Bakery Hashtags, Giveaway...).

**Aperto:**
- con secondario o accento di luminosità media il testo automatico può avere poco contrasto;
- con un principale chiaro domande, apertura e consiglio perdono il fondo scuro;
- da valutare solo il maiuscolo spaziato (modello).

#### Maritozzo

- **Modello:** `bakery/27`, «Bakery/Café Instagram templates» (84 post, Moxieque; stesso negozio di cannella), https://www.etsy.com/listing/1816678376. Corallo pieno e crema, serif classico enorme in maiuscolo, foto di dolci a tutto campo con riquadri chiari sopra.
- **Font:** Old Standard TT (titoli, uguale), Montserrat (testi, uguale).
- **Palette demo:** principale `#D7452C`, secondario `#2B2826`, accento `#D7452C`, sfondo `#F3EADB`.
- **Foto:** 10 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Tasty pastry for you!» |
| prodotto | «A cake taste of Sweet & Tangy» |
| domande | «Q&A Fridays / Ask us anything!» |
| citazione | «Cake: because no great story ever started with someone eating a salad.» |
| raccolta | «Mood board» |
| biglietto | «29-Nov / 30-Nov Black Friday deals» |
| edizione | «Limited Edition Treat Alert / Maritozzi» |
| fornaio | «Meet the baker Isabel» |

**Diverso dal modello:**
- post quadrati portati a 4:5;
- in domande la Q gigante = C disegnata in SVG, titolo «Chiedilo al forno»;
- in raccolta fondo pieno in principale;
- riga curva di prodotto in SVG textPath;
- in fornaio carta stropicciata = foto tinta dallo sfondo (multiply) con pieghe a filetti;
- riquadri e testi chiari in tinta schiarita dello sfondo;
- scotch grigio fisso (oggetto);
- titolo di edizione minuscolo, nome del prodotto in secondario. Scelte le 8 slide più diverse da cannella.

**Lasciate fuori:** slide già in cannella o con scontornati e disegni a mano (Brunch & Lunch, eventi, We are open, Ingredient spotlight...), altre slide solo in mockup storti o tagliate.

**Aperto:**
- da valutare del modello (etichette tonde, maiuscolo spaziato, fascia vicino al bordo);
- testi chiari in basso della copertina poco leggibili (come il modello);
- con accento = principale titoli ed evidenze hanno lo stesso colore. Corretto un bug nello script che rimpicciolisce i titoli (misurava il contenitore invece del testo, con Sora il titolo diventava minuscolo).

#### Amarena

- **Modello:** `bakery/28`, «Creamy Bakery», https://www.etsy.com/listing/4505509847. Bordeaux, rosso amarena, rosa bruno e crema; serif morbido accanto a un grottesco nero maiuscolo, schede color carta sulle foto, spighe e tazze disegnate a tratto.
- **Font:** DM Serif Display (titoli), Red Hat Display (testi, marchio, titolo di novita), Yellowtail (scritta a mano «Novità»).
- **Palette demo:** principale `#562427`, secondario `#966255`, accento `#9D2D29`, sfondo `#F1EDE1`.
- **Foto:** 6 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «CREAMY Bakery, EST. 2026» |
| listino | «CREAMY Bakery» con prezzi |
| novita | «MAISON LEMON CAKE / Special» |
| senza-zucchero | «Sugar-free desserts» |
| mattino | «Tasty Morning Joy» |
| prodotto | «Strawberry Almond Cake» |
| orari | «Opening hours» |
| frase | «Good Food Good Mood» |

**Diverso dal modello:**
- foto diverse (cornetti al posto dei macaron, cornetti con fragole, biscotti su carta forno, tartelletta alla fragola);
- copertina scurita (0.82);
- spighe, rametto, cupcake, tazze e pane in SVG a tratto semplici, più poveri delle incisioni;
- «Novità» tutta sulla foto;
- fondo del listino = sfondo un po' più scuro e caldo;
- orari con trattino corto;
- vetrina di mattino ingrandita per tagliare i prezzi in dollari.

**Lasciate fuori:** scheda rossa solo marchio, brunch (si sovrappone a orari e frase), mockup ricerca Google, calendario, chat, CREAMY x3, Sourdough Bread, WE'RE OPEN ad arco, scritta circolare (quasi tutte leggibili solo in miniatura).

**Aperto:**
- con sfondo bianco puro il fondo del listino diventa rosato;
- nel prodotto titolo arancio sul telo giallo della foto d'esempio poco leggibile;
- da valutare scritte sotto 24 px e corsivo «umore» (come il modello).

#### Lievito

- **Modello:** `bakery/29`, «IG Post Canva Template» di And Done Studio («Butterfield Home Bakery»), https://www.etsy.com/listing/4485475944. Kraft, beige e marrone con accento terracotta; serif classico, macchina da scrivere e corsivo a mano; carte vere appoggiate sulle foto del prodotto (foglio strappato, centrino, tagliando, cartolina, biglietti da visita).
- **Font:** Gelasio (titoli; il serif Canva a contrasto medio non è su Google), Courier Prime (testi, uguale), Sacramento (corsivo a mano: una parola, la data, la recensione).
- **Palette demo:** principale `#4E3F31`, secondario `#A8957E`, accento `#C4532F`, sfondo `#E8E1D7`.
- **Foto:** 13 Pexels (6 a tutta pagina, 7 crostate dall'alto rese tonde).

| Layout | Slide del modello |
|---|---|
| copertina | «Layers you can hear» |
| listino | «Sourdough Mini Pie» |
| orari | «Open Hour» |
| domande | «Q&A, Do you use any preservatives?» |
| recensione | «Kind words» |
| avviso | «Sorry we're Closed today» |
| preordine | «Next Pre-order 08 October» |
| biglietto | «What we do, Small batch bakes, made to share» |

**Diverso dal modello:**
- tolte le icone del cornetto da logo e timbro (logo = nome con motto in corsivo);
- centrino, foglio strappato, tagliando dentellato e molla disegnati in SVG;
- busta = rettangolo semplice, piatto d'argento = foto scura vera;
- crostate del listino = foto a cerchio con ombra;
- «D e R»;
- in orari e preordine etichetta e firma in principale (foto chiare);
- foto di avviso e biglietto scurite.

**Lasciate fuori:** slide con prodotti scontornati che volano (Buttery soft, Buy 1 get 1, Sourdough Loaf, Lemon Tart...), mockup di oggetti (busta col codice a barre, cornice dorata, vassoio con polaroid, sacchetti), Meet the baker e vlog (ritratto), collage ricetta.

**Aperto:**
- nel biglietto testo chiaro sull'accento, con accento chiaro si legge poco;
- da valutare del modello (etichette piccole spaziate, testi sotto 24 px, righe della fascia, prezzi vicino al bordo);
- in preordine l'etichetta cade sul fiocco del sacchetto nella foto d'esempio.

#### Focaccia

- **Modello:** `bakery/30`, «Bakery & Pastry Store Posts & Stories» (Cottage Bakery; stesso negozio di glassa), https://www.etsy.com/listing/4464918772. Cioccolato e nocciola su carta, corsivo a pennello enorme, prodotti ritagliati che si fondono col fondo, scarabocchi a matita.
- **Font:** Kaushan Script (titoli, corsivo a pennello), Courier Prime (testi, macchina da scrivere), Oswald fisso (etichette, fasce, seconde righe).
- **Palette demo:** principale `#4E2E1F`, secondario `#9B7C5F`, accento `#C2A586`, sfondo `#F5F0EA`.
- **Foto:** 7 Pexels.

| Layout | Slide del modello |
|---|---|
| copertina | «Bakery x5 / Order now» |
| torta | «Let's eat some CAKE / Strawberry shortcake» |
| gusti | «Choose your favorite Flavor» |
| forno | «Bakery & Cake Shop / Baked perfection» |
| cornetti | «Freshly Baked Croissants Only» |
| offerta | «Fruit Galette 20% off» |
| novita | «Coming stay tuned Soon» |

**Diverso dal modello:**
- ritagliati = foto su fondo chiaro fuse con la carta (multiply e bordo sfumato), con certe foto resta un alone;
- crostata a griglia al posto della galette;
- in gusti e novita le parole piccole non toccano più il corsivo (renderizza);
- testo sulla fascia bianco o nero secondo il secondario;
- scarabocchi in accento. Lasciati fuori tutti i segni di glassa (foglietti col nastro, telefono, tre foto in cornice, dolce tondo, titoli tondi);
- usati solo parola ripetuta in pila, corsivo enorme, parole incastrate, raggiere, anelli a scarabocchio.

**Lasciate fuori:** slide con segni di glassa (Price List, orari, FAQ, Contact Us, Buy 1 get 1, Tarts & Pies), interfaccia Instagram, slide troppo vicine a sfornati di glassa, doppioni in miniatura.

**Aperto:**
- velatura appena visibile in basso a destra in forno;
- con font larghi «TORTA» quasi al bordo;
- Oswald resta fisso.

## Dove sta cosa

- Catalogo e descrizioni: `moonbrand-shared/src/domain/templates.ts`, `moonbrand-shared/src/i18n/messages/catalog.ts`.
- Template: `plugin/templates/<id>/` (`TEMPLATE.md`, `layout/`, `esempio/`, `anteprima/`), contratto in `plugin/templates/README.md`.
- Copia nella cartella del brand con colori e font: `src/lib/templates.ts`. Font e link di Google Fonts: `src/lib/fonts.ts`.
- Regole per chi fa i contenuti: sezione «Il template» del CLAUDE.md del brand (`templateSection`), sezioni «I font» e
  «Il logo», skill contenuti.
- Esempi dell'onboarding: `src/jobs/visual.ts`. Font dal sito: `src/jobs/website.ts`.
- Studio: passo Visual (`moonbrand-studio/src/app/features/onboarding/steps/visual-step.*`), anteprime in
  `moonbrand-studio/public/templates/<id>/`.
