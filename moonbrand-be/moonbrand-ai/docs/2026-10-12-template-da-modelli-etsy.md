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
