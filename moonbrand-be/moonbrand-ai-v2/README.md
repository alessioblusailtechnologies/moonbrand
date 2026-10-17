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

Per ora non ci sono prompt in più né tool di moonbrand. L'idea e lo slot passati dallo studio sono ignorati.

### Worker

Stessa coda Postgres `presenza.ai_jobs` di `moonbrand-ai`:
- claim con `for update skip locked`;
- affinità brand → worker, lease e heartbeat;
- step letti da Haiku;
- costo proprio e costo di sessione.

Il worker v2 prende solo `website`, `ideas`, `style` e `chat`. Gli altri kind (`welcome`, `video-setup`, `visual`) restano in coda: si prova il v2 scambiando il worker.

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

1. Nel `.env` dell'API: `AI_ENGINE=v2`.
2. Spegni il worker di `moonbrand-ai` e avvia questo: `npm run worker`.
3. Fai l'onboarding dallo studio di collaudo (https://45.14.185.228:4200), poi apri la chat.

I job si possono lanciare anche a mano: `npm run brand`, `npm run ideas`, `npm run cartella`, `npm run chat`.

Prove fatte il 17/10:
- onboarding completo su Tezenis, con cartella e `CLAUDE.md` corretti;
- chat con risposta coerente con il brand e ripresa della sessione al secondo turno;
- un turno dallo studio in 6 secondi per $0,20.

## Cosa manca

- Il job `welcome` (saluto e spunti del giorno): lo studio usa i saluti di riserva.
- Gli strumenti della chat: salvare un contenuto, generare immagini e video, toccare il piano.
- Passare l'idea e lo slot al prompt della chat.
- Nulla è ancora committato.
