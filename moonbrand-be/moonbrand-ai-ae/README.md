# moonbrand-ai-ae

Il motore v2 con After Effects al posto di Remotion per i video.

È un prototipo in una cartella a parte, nato il 22/10/2026. È uguale a `moonbrand-ai-v2` tranne la chat (`src/jobs/chat/chat.ts`).

## Cosa cambia

La chat fa i video con After Effects e ne usa a fondo gli effetti.

- Claude scrive da sé uno script TypeScript con l'API di scripting di AE. Non ci sono template.
- Lo script si prepara e si esegue con gli strumenti in `after-effects/`.
- Non c'è l'export su Lambda né Remotion.
- ffmpeg viene da `ffmpeg-static`.

È la seconda prova su Sunraise («usa a fondo gli effetti»), fatta diventare una chat.

### Gli strumenti

| Strumento | Cosa fa |
|---|---|
| `prepara.mjs <file.ts>` | Controlla lo script con i tipi di AE 26 e lo converte in ExtendScript ES3, con i polyfill ES5. Il risultato va in una cartella con il nome dello script, accanto al file. |
| `esegui.mjs <file.ts> [fotogrammi]` | Esegue lo script nell'istanza di AE già aperta (`AfterFX -noui -r`) e renderizza la composizione `Video` con `aerender -mfr`. Lascia `video.mp4`, alcuni fotogrammi e `progetto.aep`. |
| `installa-font.mjs <font>` | Installa un font per l'utente di Windows. |

`esegui.mjs` lascia girare uno script alla volta in AE, per tutti i brand. Il lucchetto è `.ae-occupato`. I render invece possono andare in parallelo.

## Installazione (solo Windows con After Effects)

1. `npm run installa-ae` copia gli strumenti in `AE_TOOLKIT` (default `C:\moonbrand-ae`), installa i pacchetti e scarica la documentazione di docsforadobe.dev. Gli strumenti stanno fuori dal repo e dalla home perché la chat non legge il repo, ma deve leggere la documentazione e i tipi.
2. After Effects va aperto a mano e lasciato aperto. Avviato da script, al primo colpo dà errore.

## Sul collaudo

Si prova scambiando il worker, come per argon. Il `.env` è quello del v2.

- `avvia-collaudo.ps1` avvia questo worker, dopo aver fermato quello del v2. Il log va in `%TEMP%\moonbrand-worker-ae.log`.
- `avvia-v2.ps1` rimette il v2.

## Numeri della prova (Sunraise, chat Alba)

| Prova | Tempo | Turni | Costo |
|---|---|---|---|
| Effetti a fondo | 58 min | 98 | 7,29 $ |

- Ogni render dura 4-7 minuti sulla CPU di questa macchina, che non ha GPU.
- Il v2 con Lambda impiega 13-20 secondi.
