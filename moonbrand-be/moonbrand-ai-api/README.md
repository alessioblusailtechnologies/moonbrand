# moonbrand-ai-api

Prototipo del 22/10/2026: il motore v2 con la chat che non usa Claude Code. Il giro con Opus lo fa il nostro codice con la
Messages API di Anthropic. Tutto il resto (onboarding, idee, saluti, titoli, worker, coda, proxy, tool di moonbrand,
export su Lambda) è uguale al v2.

## Perché

- **Comandi che si bloccano.** Con Claude Code un comando piantato (ffmpeg in prod il 22/10) tiene ferma la chat fino al
  limite di 10 minuti. Qui un comando che per 3 minuti non stampa niente e non scrive file si ferma, con un messaggio che
  dice a Claude cosa è successo.
- **Contesto.** Oltre 150K token la conversazione la riassume l'API. Il 23/10 c'era anche il taglio dei risultati
  vecchi dei tool oltre 80K, ma toglieva a Claude gli screen di riferimento e la qualità calava: tolto.
- **Controllo.** Prompt, tool e informazioni sono tutti nel nostro codice.

## Com'è fatta la chat (`src/jobs/chat/chat.ts`)

- Modello `claude-opus-5-5`, effort `xhigh` (con `high` il 23/10 la qualità era calata), ragionamento adattivo. Gli aggiornamenti tra un tool e l'altro
  (`display: "updates"`) arrivano allo studio come testo. Il fallback sulle risposte rifiutate è attivo
  (`fallbacks: "default"`).
- Prompt di sistema: il `CLAUDE.md` del brand, poi l'ambiente e i servizi (le stesse righe STRUMENTI del v2). Sta in
  cache per tutta la conversazione.
- Tool:
  - `bash` (lo strumento di Anthropic, eseguito in `strumenti.ts`): ogni comando parte dalla cartella del brand. Si
    ferma dopo 3 minuti senza output né file scritti in `lavoro/` e `contenuti/`, o dopo 30 minuti.
  - `str_replace_based_edit_tool`: legge, scrive e modifica i file, e guarda le immagini. Lavora solo nella cartella
    del brand.
  - `web_search` e `web_fetch` dell'API.
  - I tool di moonbrand e `esporta_video` su Lambda: le stesse definizioni del v2, convertite.
- La conversazione si salva in `sessioni/<brand>/<id>.json`, fuori dalla cartella del brand. L'id va al worker come
  `session_id`, come con Claude Code.
- Al worker scrive le stesse righe JSON di Claude Code, con i nomi dei tool di Claude Code (Bash, Read, Write…):
  passi, testo e costo arrivano allo studio senza cambiare il worker.
- Il costo si calcola dai token: 4 $ entrata, 20 $ uscita, 5 $ scrittura in cache, 0,20 $ lettura per milione; ricerca
  web 0,01 $.

## Chiave

La chiave API è `CHAT_ANTHROPIC_API_KEY` nel `.env`. Non è `ANTHROPIC_API_KEY`, perché gli altri job girano ancora con
Claude Code e l'abbonamento: con `ANTHROPIC_API_KEY` passerebbero alla chiave. La chiave resta allo script della chat;
i comandi della shell non la vedono.

## Sul collaudo

1. `ferma-worker.cmd` ferma il worker che gira, qualunque dei motori sia.
2. `avvia-collaudo.ps1` avvia questo worker. Il log va in `%TEMP%\moonbrand-worker-api.log`.
3. Per tornare al v2: `ferma-worker.cmd`, poi `avvia-v2.ps1`.

## Video con After Effects

Con `VIDEO_ENGINE=ae` nel `.env` (così sul collaudo dal 23/10) i video si fanno con After Effects invece che con Remotion
su Lambda: il prompt descrive gli strumenti di `moonbrand-ai-ae` (installati in `AE_TOOLKIT`, default `C:\moonbrand-ae`,
con `npm run installa-ae` da quella cartella) e `esporta_video` non c'è. After Effects va tenuto aperto.
