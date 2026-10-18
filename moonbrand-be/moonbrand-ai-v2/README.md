# moonbrand-ai-v2

Una versione molto semplificata del motore AI di moonbrand (`moonbrand-ai`), ripartita da zero il 17/10/2026.
Per ora copre l'onboarding e una prima chat.

## Perché

`moonbrand-ai` è cresciuto per strati:
- circa 5.400 righe di TypeScript;
- un plugin di skill in Markdown;
- template, stile con Gemini, esempi nell'onboarding;
- prompt lunghi con molte regole.

Le prove fatte finora sono andate tutte nella stessa direzione: con meno regole Claude lavora meglio.
- Il 12/10 Opus, senza i nostri prompt, ha rifatto lo spot molto meglio della chat.
- I risultati deboli si correggono togliendo regole, non aggiungendone.

L'idea del v2 è tenere solo l'essenziale:
- una cartella del brand con un `CLAUDE.md` scritto una volta sola;
- i riferimenti dell'utente;
- le istruzioni personalizzate;
- Claude Code che lavora dentro quella cartella.

Il resto si aggiunge solo quando serve davvero.

Il v2 è un prototipo in una cartella a parte: `moonbrand-ai` non si tocca e la produzione resta com'è.

## Le scelte

- **Claude Code, non la Messages API.** Tutti i job girano con `query()` dell'Agent SDK (`@anthropic-ai/claude-agent-sdk`), come in `moonbrand-ai`. Così restano gli step agentici mostrati nello studio, la ricerca sul web e la ripresa della sessione.
- **Opus** come modello.
- **Niente template né stile nell'onboarding.**
  - Del sito si prende solo la palette di 4 colori.
  - Niente font.
  - L'utente può caricare immagini di riferimento.
- **Il logo lo trova Claude.** Nessuna euristica nel codice: Claude scarica i candidati, li guarda e sceglie l'indirizzo. Il codice lo scarica e lo valida.
- **Il `CLAUDE.md` non cambia dopo l'onboarding.**
  - Inizia con il prompt di moonbrand: chi è l'assistente e come parla all'utente.
  - Seguono i dati del brand.
  - Istruzioni e riferimenti stanno in file a parte, che possono cambiare.
- **Prompt corti.** Il job delle idee ha un prompt di poche righe e nessuna skill.

## Cosa c'è

```
src/
  worker.ts              coda ai_jobs, avvio dei job, step, costi, sincronizzazione della cartella
  jobs/
    brand/               kind "website": legge il sito, palette, logo
    ideas/               kind "ideas": le idee del piano
    cartella/            kind "style": la cartella del brand a fine onboarding
    chat/                kind "chat": Claude Code dentro la cartella del brand
  lib/                   copiati da moonbrand-ai: step-reader, brand-sync, brand-logo, language
```

In tutto circa 1.500 righe.

### Job `website` (brand/)

Claude legge il sito con WebFetch, WebSearch, Bash e Read, poi restituisce un JSON con:
- nome, settore, categoria;
- sintesi, pitch;
- temi, obiettivi, pubblico;
- 4 colori presi dal CSS vero;
- l'indirizzo del logo;
- la lingua.

`logo.ts` scarica il logo e lo trasforma in data URI, con la stessa validazione di `moonbrand-ai`.

### Job `ideas` (ideas/)

Prompt breve: i dati del brand in linea più una sezione «Come»:
- poche idee ma forti;
- prima cerca sul web;
- un trend solo con una fonte vera, al massimo 2;
- ricorrenze fino a 42 giorni;
- al massimo 3 idee per tema.

Lo schema del risultato e il salvataggio sono gli stessi di `moonbrand-ai`.

### Job `style` (cartella/)

Non usa Claude: scrive la cartella del brand e basta.

```
<brand>/
  CLAUDE.md                     scritto solo se manca, poi mai più toccato
  istruzioni-personalizzate.md  riscritto a ogni giro (vuoto se non ce ne sono)
  logo.<estensione>             lo scrive il worker
  riferimenti/                  le immagini caricate dall'utente
```

L'API lo mette in coda:
- a fine onboarding;
- quando cambiano i riferimenti;
- quando cambiano le istruzioni personalizzate.

Il `CLAUDE.md`:
1. inizia con `moonbrand.ts`: chi sei e «Come parli all'utente», presi dalla vecchia chat senza le regole dei tool;
2. poi `# Il brand`: pitch, settore, sito, lingua dei post, obiettivi, pubblico, temi, palette, logo;
3. infine dice dove trovare i riferimenti e le istruzioni personalizzate.

### Job `chat` (chat/)

Claude Code parte con la cartella del brand come cwd:
- `settingSources: ['project']`, così carica il `CLAUDE.md`;
- `resume` della sessione della conversazione;
- risposta in streaming nello studio;
- lo stop dallo studio interrompe e lascia la sessione riprendibile.

In più, al prompt di Claude Code si aggiungono poche righe (`STRUMENTI` in `chat.ts`):
- gli indirizzi e le chiavi dei servizi: `GEMINI_BASE_URL`/`GEMINI_API_KEY` (immagini e per guardare i video), `ATLASCLOUD_BASE_URL`/`ATLASCLOUD_API_KEY` (clip video), `ELEVENLABS_BASE_URL`/`ELEVENLABS_API_KEY` (voce e musica). Le chiama lui con node o curl, niente tool. Indirizzi e chiavi sono quelli del proxy (sotto);
- prima di un carosello o di un video dice cosa farà e quanti crediti consumerà, e aspetta l'ok. Le cifre tipiche arrivano dal worker (`lib/estimate.ts`), il listino per le modifiche da `lib/prices.ts`;
- lavora in `lavoro/`, i file finiti vanno in `contenuti/`;
- quando un contenuto è pronto lo salva con `salva_contenuto`; contenuti, piano e idee li legge e li cambia con gli altri tool di moonbrand;
- l'uscita del piano e l'idea da cui si apre la chat vanno in fondo al messaggio, come nella v1: con lo `slotId` il contenuto si aggancia all'uscita.

Le righe stanno in `chat.ts` e non nel `CLAUDE.md`, così si cambiano senza riscrivere le cartelle dei brand.

#### I tool di moonbrand (`moonbrand.ts`)

Le stesse rotte `/v1/agent/*` della v1, con il token del job e descrizioni di una frase: `contenuti_elenca`, `contenuto_leggi`, `contenuto_approva` (solo se lo chiede l'utente), `contenuto_riapri`, `pubblicazione_proponi` (il pulsante «Pubblica ora», non pubblica), `piano_leggi`, `piano_proponi`, `uscite_crea`, `uscita_cambia`, `uscita_togli`, `idee_elenca`, `idea_salva`. Le regole del piano (ritmo, orari, temi) le applica l'API in `piano_proponi`.

`salva_contenuto` salva in Contenuti, come bozza, con la stessa rotta dell'API della v1 (`POST /v1/agent/contents`, con l'`id` `PUT`).
- Input corto: titolo, formato (post, carosello, video), canali, testo e hashtag per canale, file con la proporzione, `slotId` facoltativo.
- Ruolo e ordine dei file li deduce il codice: l'MP4 è il video, le immagini sono copertina o, nei caroselli, slide.
- Prima carica i file sullo storage, perché l'API li copia da lì.
- Il token del job (`agent_token`, passato dal worker) resta nel processo: Claude non lo vede.

#### Il titolo della conversazione (`lib/title.ts`)

A fine primo turno il worker chiede a Sonnet (`claude-sonnet-5-5`) un titolo di al massimo 6 parole, dal messaggio e dalla risposta, nella lingua dell'account, e lo scrive in `presenza.conversations` al posto del messaggio tagliato che mette l'API. Non blocca il job e non costa crediti.

### Job `welcome` (welcome/)

Saluti per fascia oraria e spunti per la prima domanda, come nella v1, con un prompt corto: il tono di Claude, simpatico ma professionale. Sonnet 5.5, senza tool né cartella; `save.ts` scarta emoji, doppioni, testi troppo lunghi e parole che indovinano il genere. Lo mette in coda l'API, gratis.

#### Il PDF del carosello per LinkedIn (`lib/document.ts`)

Su LinkedIn il carosello esce come PDF delle slide (`publisher.ts` nell'API). Quando un carosello ha LinkedIn tra i canali, `salva_contenuto` riunisce le slide in 4:5 (o quelle della prima proporzione) in un PDF, una per pagina, con `pdf-lib`, senza browser, e lo aggiunge come file `document`. Se il PDF non riesce si salva senza, e la pubblicazione su LinkedIn dirà che manca.

#### L'export dei video su Lambda (`jobs/chat/lambda.ts`)

Il tool `esporta_video` (server `lambda`) pubblica su S3 il progetto Remotion che Claude ha fatto nella cartella del brand (un sito per brand) e renderizza le composizioni su Remotion Lambda, come `tools/lambda.ts` della v1: un Reel di 20 s in 19 s di render, 37 s con la pubblicazione, 0,8 centesimi (prova del 18/10). La funzione su AWS è di Remotion 4.0.529 (`@remotion/lambda` fissato a quella versione): se il progetto ne usa un'altra il tool lo dice prima di partire. Le chiavi stanno in `.env.lambda` in questa cartella (le stesse della v1, da copiare anche sul server); senza, il tool non c'è e Claude esporta in locale. Il costo del render arriva al worker con una riga `moonbrand_usage` sullo stdout e va in `ai_usage`.

#### Il proxy dei servizi (`lib/proxy.ts`)

Per ogni chat il worker apre un server su 127.0.0.1 che inoltra a Gemini, Atlas ed ElevenLabs. Claude ha l'indirizzo del proxy, con un token del job nel percorso, e come chiave lo stesso token: le chiavi vere restano nel worker e ai servizi veri il token non vale niente.
- Ogni generazione va in `ai_usage` con job, brand e costo, e da lì partono i crediti, come nella v1.
- Gemini: dai token della risposta (anche quelli delle immagini), con il listino di `prices.ts`.
- Atlas: prezzo base del catalogo (`/api/v1/models`, letto all'ora) per secondi o immagini; si registra quando la predizione risulta finita, o a fine job. Per alcuni modelli il prezzo base è un «a partire da»: ogni tanto confrontare il totale con `public/v1/model-costs`.
- ElevenLabs: caratteri per la voce, durata chiesta per musica ed effetti, durata dell'audio per la trascrizione.
- Un modello senza prezzo si registra lo stesso, senza costo, con un avviso `[proxy]` nel log del worker.
- Gli indirizzi dei servizi nelle risposte (i link di Atlas per controllare una clip, l'indirizzo di caricamento dei file di Gemini) diventano quelli del proxy, e viceversa nelle richieste.

#### Sicurezza

- Dall'ambiente di Claude si tolgono il token del job e le credenziali S3; `DATABASE_URL` lo toglie già il worker.
- Read, Grep e Glob non leggono `.env` e `~/.claude` (regole `deny` nelle impostazioni del job).
- Bash gira nel sandbox dell'SDK solo su Linux: scrive nella cartella del brand e non legge il repo né la home. Se il sandbox non parte, la chat non parte (`failIfUnavailable`).
- Su Windows (il collaudo, questa macchina) il sandbox non c'è («feature gate off»): lì Bash resta libero e può leggere i file della macchina. Scelta consapevole per poter provare.
- Le chiavi di generazione non sono più nell'ambiente di Claude: le ha solo il proxy. Su Windows, senza sandbox, Claude potrebbe ancora leggerle dal `.env` con Bash. Database, Supabase, Dodo e simili non devono mai essere raggiungibili.
- Da verificare su Linux: che dal sandbox la chat raggiunga il proxy su 127.0.0.1 (potrebbe servire `sandbox.network`).


### Worker

Stessa coda Postgres `presenza.ai_jobs` di `moonbrand-ai`:
- claim con `for update skip locked`;
- affinità brand → worker, lease e heartbeat;
- step letti da Haiku;
- costo proprio e costo di sessione.

Il worker v2 prende solo `website`, `ideas`, `style`, `chat` e `welcome`. Gli altri kind (`video-setup`, `visual`, `content`, `content-edit`, `content-video`) restano in coda: si prova il v2 scambiando il worker.

Per i job che lavorano sulla cartella del brand (`style`, `chat`), il worker:
1. scarica la cartella dallo storage (Supabase S3, se configurato);
2. scrive il logo;
3. lancia il job;
4. ricarica la cartella, anche se il job è stato fermato.

## Modifiche fuori da questa cartella

Tutte dietro l'interruttore `AI_ENGINE=v2` nel `.env` dell'API. Il default è `v1`, quindi la produzione è invariata.

- **moonbrand-api**
  - `src/modules/ai/engine.ts` legge l'interruttore.
  - L'account espone `aiEngine: 'v2'`.
  - Alla creazione del brand non mette in coda `video-setup`.
  - Rimette in coda la cartella anche quando cambiano le istruzioni.
  - Carica i riferimenti direttamente in `riferimenti/` invece di `file-riferimento/`. I brand nati prima restano lì e il job li copia.
- **moonbrand-shared**: `Account.aiEngine?: 'v2'`.
- **moonbrand-studio**: con `aiEngine === 'v2'` lo step visual nasconde font, template ed esempi, e l'onboarding non chiede gli esempi.

## Come si prova

1. Nel `.env` dell'API: `AI_ENGINE=v2`. Nel `.env` di questa cartella: `DATABASE_URL` e le chiavi `GEMINI_API_KEY`, `ATLASCLOUD_API_KEY`, `ELEVENLABS_API_KEY`.
2. Spegni il worker di `moonbrand-ai` e avvia questo: `npm run worker`.
3. Fai l'onboarding dallo studio di collaudo (https://45.14.185.228:4200), poi apri la chat.

I job si possono lanciare anche a mano: `npm run brand`, `npm run ideas`, `npm run cartella`, `npm run chat`.

Prove fatte il 17/10:
- onboarding completo su Tezenis, con cartella e `CLAUDE.md` corretti;
- chat con risposta coerente con il brand e ripresa della sessione al secondo turno;
- un turno dallo studio in 6 secondi per $0,20.

Prove fatte la sera del 17/10, dopo chiavi e `salva_contenuto` (chat di Tezenis dallo studio):
- post della t-shirt di Natale, carosello Instagram e TikTok, reel con 5 clip, musica e montaggio: tutto salvato in Contenuti;
- costo totale circa 9,5–10 $: Claude 5,85 $ (5 turni, il reel 2,46 $), Atlas circa 2,4 $, Gemini circa 1,3 $, ElevenLabs circa 0,15 $;
- una clip (la cena aziendale) bloccata due volte dal filtro di Gemini Omni Flash su Atlas: Claude l'ha rifatta da solo con Kling v3.

## Cosa manca

Rispetto a moonbrand-ai, in ordine di priorità. Fatti il 18/10: costi dei servizi e stima prima di caroselli e video, tool di contenuti, piano e idee, idea e uscita nel messaggio, saluto del giorno, titoli delle chat (questi ultimi non c'erano nemmeno nella v1), PDF del carosello per LinkedIn, export dei video su Lambda. Il 18/10 sera anche Read/Grep/Glob limitati alla cartella del brand (regole di divieto attorno al percorso, in chat.ts), ffmpeg nel PATH (su Windows quello di Remotion) e i prezzi misurati di Grok 1.5 e Kling 3.0 Pro, che vincono sul catalogo di Atlas (prices.ts). Nello studio, con `aiEngine === 'v2'`, i contenuti vecchi della v1 non hanno più Rigenera, Modifica, video dal copione e nuovo canale (job che il worker v2 non prende). I link social (Instagram, Facebook) la chat li scarica già da sé, senza `scarica_social`.

- **Canzoni con Mureka (`genera_canzone`).** Qui c'è solo la musica di ElevenLabs; serve solo se si vogliono ancora canzoni cantate.

Tecniche:

- **Sandbox su Linux.** Va provato prima della produzione (bubblewrap, socat e ffmpeg installati: oggi sul server ffmpeg non c’è), compresa la chat che raggiunge il proxy su 127.0.0.1.
- **Scelta del modello delle clip.** Conta la qualità, non il prezzo: Gemini Omni Flash (0,13 $/s) era stato scelto il 2/10 dopo una prova sulle stesse foto perché è quello che segue meglio il prompt. Su Atlas c’è anche `google/gemini-omni-1.1-flash` a 0,039 $/s: va provato sulle stesse foto prima di preferirlo. Ora che il repo è chiuso, la chat sceglie dal catalogo (GET /api/v1/models, citato nel prompt solo come elenco dei modelli).

Rimandati dall'utente:

- **Un contenuto per più canali.** Claude ha salvato il carosello Instagram e quello TikTok come due contenuti separati, quindi nello studio non compare la barra dei canali. Per sistemarlo: dire nella descrizione del tool che un contenuto è uno per idea, e aggiungere `canale` facoltativo ai file (serve per il reel, dove Instagram e TikTok sono tutti e due 9:16).
- **Versioni dei contenuti.** Una modifica riscrive il contenuto e l'API cancella i file vecchi: si perde la versione precedente. Idea discussa: tabella delle versioni, file per versione, «torna a questa» nello studio.
