# moonbrand-ai-v3

Il v2 con i servizi come tool, nato il 26/10/2026. Nel v2 la chat chiamava Gemini, Atlas ed ElevenLabs da sé, con node o curl attraverso un proxy del worker, e il prompt le diceva indirizzi e chiavi. Nel v3 sono tool per mestiere (`media`, `guarda`, `audio`, sotto in «I tool dei servizi»): il proxy non c'è più, Claude non vede chiavi né indirizzi e non scrive script per chiamare i servizi. Non c'è una via d'uscita: se manca qualcosa si aggiunge un tool. Il resto è uguale al v2 e il testo sotto è quello del v2, aggiornato dove cambia.

---


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
- che immagini, clip, musica, voce ed effetti si fanno con i tool `media` e `audio`, e che video e audio si guardano con `guarda_file`; ffmpeg è nel PATH;
- prima di un carosello o di un video dice cosa farà e quanti crediti consumerà, e aspetta l'ok. Le cifre tipiche arrivano dal worker (`lib/estimate.ts`), il listino per le modifiche da `lib/prices.ts`;
- lavora in `lavoro/`, i file finiti vanno in `contenuti/`;
- quando un contenuto è pronto lo salva con `salva_contenuto`; contenuti, piano e idee li legge e li cambia con gli altri tool di moonbrand;
- l'uscita del piano e l'idea da cui si apre la chat vanno in fondo al messaggio, come nella v1: con lo `slotId` il contenuto si aggancia all'uscita.

Le righe stanno in `chat.ts` e non nel `CLAUDE.md`, così si cambiano senza riscrivere le cartelle dei brand.

#### Il passaggio a una sessione nuova (`passaggio.ts`)

Riprendere la sessione costa sempre di più: ogni chiamata di Opus rilegge tutto il contesto, e dopo un'ora di pausa la cache è scaduta e il resume lo riscrive per intero. Per questo, prima di riprendere, `chat.ts` legge il JSONL della sessione. Se all'ultima chiamata il contesto superava i 100K (`MOONBRAND_CHAT_MAX_CONTEXT`), o se dall'ultimo turno sono passati più di 55 minuti, apre una sessione nuova.

Alla sessione nuova arriva il dialogo fin qui, preso dal JSONL con il codice e non riassunto da un modello: i messaggi dell'utente parola per parola e la risposta finale di Claude a ogni turno, fino a 60.000 caratteri, con i più recenti per primi. Non arrivano i passaggi intermedi né i risultati dei tool. Dalle chiamate ai tool, sempre nel JSONL, il codice aggiunge «Cosa c'è già»: i contenuti salvati nella conversazione (titolo, formato, canali, id per riscriverli e file finali, all'ultimo salvataggio) e le cartelle di lavoro toccate, dalla più usata. Il brand resta quello del CLAUDE.md, che si carica a ogni sessione. Nello studio la conversazione resta una sola. Con `MOONBRAND_CHAT_HANDOVER=off` si riprende sempre la sessione, come nel v2.

Prova del 26/10 sulla chat di Velia (reel, 10 turni, 149K di contesto, ripresa dopo ore), con la domanda «ricordami cosa abbiamo deciso per voce e musica»:
- con la sessione nuova il dialogo passato era di circa 4K token: una chiamata a 44K, 0,19 $, 8 s;
- con il resume si riscrive tutto in cache: una chiamata a 160K, 6,00 $ (il costo dell'SDK), 11 s;
- la risposta ha lo stesso contenuto: le voci provate, le due musiche scartate, il punto da riascoltare al 13° secondo.
- poi un ritocco vero su una copia della cartella, «abbassa un po' la musica, la voce deve sentirsi meglio»: è andato dritto a `lavoro/video`, ha cambiato il volume, ha riesportato su Lambda, ha controllato con `guarda_file` e ha salvato con l'id giusto (il salvataggio fallisce fuori dal worker, perché manca il token). 11 chiamate a 41-67K, 0,53 $, 83 s; sul reel Sunraise, con il resume, un ritocco costava 1,2-1,7 $.

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

#### I tool dei servizi (`jobs/chat/media.ts`, `guarda.ts`, `audio.ts`)

Un tool per mestiere, con i campi in italiano e il modello facoltativo. Le chiavi arrivano dal worker al processo della chat (`MOONBRAND_GEMINI_KEY`, `MOONBRAND_ATLAS_KEY`, `MOONBRAND_ELEVENLABS_KEY`) e `chat.ts` le toglie dall'ambiente di Claude Code. I file si leggono e si salvano nella cartella del brand: a Claude torna solo il percorso, mai i byte.

- **`media`**
  - `genera_immagine`: prompt, riferimenti, proporzione, dimensione; di default `gemini-3-pro-image`, oppure un modello di Atlas col suo nome. Aspetta il risultato.
  - `genera_clip`: prompt, immagine iniziale e finale, durata, proporzione, risoluzione, audio; di default Gemini Omni Flash (da immagine) e Omni 1.1 Flash (da testo). Risponde subito.
  - `migliora`: upscaler di Atlas per foto e video. Risponde subito.
  - `attendi`: aspetta clip e miglioramenti, tutti insieme.
  - `modelli`: il catalogo di Atlas con i prezzi; con `modello` i suoi parametri.
- **`guarda`**: `guarda_file`, fino a 10 file (video, audio, immagini, PDF) e una domanda; di default `gemini-3.8-flash`. Oltre i 15 MB il file passa dalla Files API.
- **`audio`**: `genera_musica` (strumentale, con la durata) e `genera_canzone` (canzoni e jingle cantati, con il nostro testo o scritto da Suno), sempre con Suno (`suno/chirp-v6` su Atlas, varianti `-wild` e `-mini`): 2 versioni a generazione per 0,132 $. Il testo, se l'utente non chiede altro, è di tendenza e non parla di quello che fa il brand (lo dice la descrizione del tool). Poi, con ElevenLabs, `cerca_voci` (dell'account e condivise), `genera_voce` (di default `eleven_v3`), `genera_effetto`, `trascrivi` (il JSON delle parole con i tempi va in un file, a Claude torna il testo).

Ogni modello di Atlas chiama gli stessi parametri in modi diversi (`aspect_ratio` o `ratio`, `end_image` o `last_image`, `sound` o `generate_audio`): `atlas.ts` legge lo schema del modello e mette ogni campo nel nome giusto. Un campo che il modello non prende, o un valore fuori dal suo elenco, si scarta e il tool lo dice. I parametri propri di un modello passano in `parametri`.

Tutti i tool si dichiarano di sola lettura (`readOnlyHint`), così Claude Code li esegue insieme. Clip e upscaler, che durano minuti, rispondono subito e si aspettano con `attendi`.

I costi: ogni chiamata manda al worker una riga `moonbrand_usage` sullo stdout, come l'export su Lambda, e va in `ai_usage`, anche quando non riesce (senza costo).
- Gemini: dai token della risposta, anche quelli delle immagini, con il listino di `prices.ts`.
- Atlas: il prezzo misurato di `prices.ts` o, se non c'è, il prezzo base del catalogo, per i secondi chiesti (i video) o a pezzo. Per gli upscaler video i secondi si leggono dall'MP4. Si paga quando la generazione è pronta. Quelle che Claude non ha aspettato si controllano a fine chat e, se non sono fallite, si pagano.
- ElevenLabs: caratteri per la voce, secondi per musica ed effetti, durata dell'audio per la trascrizione.

Suno su Atlas passa da APIMart, un rivenditore non ufficiale: Suno non ha un'API pubblica. Può smettere di funzionare, e i diritti d'uso commerciale sono da chiarire. Il 26/10 MiniMax Music 3.0 ed ElevenLabs Music sono stati provati sullo stesso brief e scartati. Con Suno una generazione dura circa 25-35 s.

Formati: gli effetti in MP3 a 192 kbps; la voce a 128 kbps, perché a 192 vuole il piano Creator di ElevenLabs.

Prova del 26/10, con una chat lanciata a mano su una cartella di prova: tutti e dieci i tool funzionano. Immagine, upscaler, clip di 5 s, musica, effetto, voci, voce, trascrizione, attendi e guarda_file costano 0,81 $ in tutto, di cui 0,65 $ la clip, più 0,57 $ di Opus.

#### Sicurezza

- Dall'ambiente di Claude si tolgono il token del job e le credenziali S3; `DATABASE_URL` lo toglie già il worker.
- Read, Grep e Glob non leggono `.env` e `~/.claude` (regole `deny` nelle impostazioni del job).
- Con `BASH_SANDBOX=on`, solo su Linux, Bash gira nel sandbox dell'SDK: scrive nella cartella del brand e non legge il repo né la home. Se il sandbox non parte, la chat non parte (`failIfUnavailable`).
- Per ora il sandbox è spento anche in produzione, come nella v1: su Ubuntu 26.04 bwrap annidato è bloccato da AppArmor e serve prima un profilo (`SANDBOX-BASH.md`, nella radice del repo). Senza sandbox Bash resta libero e può leggere i file della macchina. Su Windows il sandbox non c'è comunque («feature gate off»).
- Le chiavi di generazione non sono nell'ambiente di Claude: le hanno solo i tool, nel processo della chat. Senza sandbox Claude potrebbe ancora leggerle dal `.env` con Bash. Database, Supabase, Dodo e simili non devono mai essere raggiungibili.


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

Il passaggio in produzione è per tutti in un colpo (`PRODUZIONE.md`, «Motore v2»): il servizio del worker lancia questo al posto di `moonbrand-ai`, poi `npm run passaggio` (`src/passaggio.ts`) mette in coda per ogni brand un job `style` con `migrate`. Quel job mette in `v1/` `CLAUDE.md`, `esempi/`, `riferimenti-da-seguire/`, `template/` e `video/` (`jobs/cartella/migrate.ts`) e prepara la cartella; la chat non legge `v1/`. L'API scrive in ogni job il motore che lo fa (`ai_jobs.engine`, migration `20261019100000_ai_engine.sql`): le conversazioni della v1 continuano con una sessione nuova.

- **moonbrand-api**
  - `src/modules/ai/engine.ts` legge l'interruttore.
  - L'account espone `aiEngine: 'v2'`.
  - Alla creazione del brand non mette in coda `video-setup`.
  - Rimette in coda la cartella anche quando cambiano le istruzioni.
  - Carica i riferimenti direttamente in `riferimenti/` invece di `file-riferimento/`. I brand nati prima restano lì e il job li copia.
- **moonbrand-shared**: `Account.aiEngine?: 'v2'`.
- **moonbrand-studio**: con `aiEngine === 'v2'` lo step visual nasconde font, template ed esempi, e l'onboarding non chiede gli esempi.

## Come si prova

Il v3 prende gli stessi job del v2 dalla stessa coda: si prova spegnendo il worker del v2 e lanciando `npm run worker` qui, con lo stesso `.env` (le chiavi restano `GEMINI_API_KEY`, `ATLASCLOUD_API_KEY`, `ELEVENLABS_API_KEY`). Per la chat a mano servono invece `MOONBRAND_GEMINI_KEY`, `MOONBRAND_ATLAS_KEY` e `MOONBRAND_ELEVENLABS_KEY`, che di solito mette il worker.

Dal v2:

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

- **Sandbox su Linux.** Provato il 18/10 sul server: bubblewrap, socat e ffmpeg ci sono, ma AppArmor blocca il namespace annidato. Spento finché non si fa il profilo (`SANDBOX-BASH.md`).
- **Scelta del modello delle clip.** Conta la qualità, non il prezzo: Gemini Omni Flash (0,13 $/s) era stato scelto il 2/10 dopo una prova sulle stesse foto perché è quello che segue meglio il prompt. Su Atlas c’è anche `google/gemini-omni-1.1-flash` a 0,039 $/s: va provato sulle stesse foto prima di preferirlo. Ora che il repo è chiuso, la chat sceglie dal catalogo (GET /api/v1/models, citato nel prompt solo come elenco dei modelli).

Rimandati dall'utente:

- **Un contenuto per più canali.** Claude ha salvato il carosello Instagram e quello TikTok come due contenuti separati, quindi nello studio non compare la barra dei canali. Per sistemarlo: dire nella descrizione del tool che un contenuto è uno per idea, e aggiungere `canale` facoltativo ai file (serve per il reel, dove Instagram e TikTok sono tutti e due 9:16).
- **Versioni dei contenuti.** Una modifica riscrive il contenuto e l'API cancella i file vecchi: si perde la versione precedente. Idea discussa: tabella delle versioni, file per versione, «torna a questa» nello studio.
