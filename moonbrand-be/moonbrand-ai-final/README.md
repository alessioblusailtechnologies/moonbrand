# moonbrand-ai-final

Il motore AI di moonbrand: un worker che prende i lavori dalla coda sul DB (`presenza.ai_jobs`) e li fa con Claude Code
nella cartella del brand, come se qualcuno aprisse Claude lì dentro: un `CLAUDE.md` che dice chi è il brand, le
immagini di riferimento che il brand ha caricato, e i tool.

È il motore principale (`moonbrand-ai`) snellito: niente template, niente esempi dell'onboarding, niente font, niente guida
di stile letta a parte, niente skill, niente download dei post social. Le regole sono poche righe nei prompt (`src/prompts`); lo stile Claude lo prende
dalle immagini di riferimento, guardandole.

## I tool di Claude

| Server | Tool | Cosa fa |
| --- | --- | --- |
| `grafica` | `renderizza` | esporta in PNG o JPEG una pagina HTML e CSS scritta da Claude, alle misure del formato |
| `immagini` | `genera_immagine` | foto e illustrazioni con Gemini (Nano Banana; `pro` per Nano Banana Pro) |
| `vista` | `guarda` | Gemini guarda immagini e video della cartella (riferimenti, allegati, video montati) e risponde a parole |
| `video` | `controlla_video`, `esporta_video` | Remotion: tipi e fotogrammi di controllo; MP4 finale (su Lambda se c'è `.env.lambda`, altrimenti qui) e copertina |
| `clip` | `gira_clip`, `attendi_clip` | le clip generate su Atlas Cloud (Kling 3.0 Pro, Omni Flash con i riferimenti), circa 14 crediti al secondo; nei lavori dello studio un tetto per lavoro |
| `musica` | `genera_musica`, `genera_canzone`, `attendi_musica` | ElevenLabs Music |
| `audio` | `cerca_voci`, `genera_voce`, `tempi_parole`, `genera_effetto` | voce fuori campo con i tempi delle parole, allineamento e trascrizione, effetti sonori (ElevenLabs) |
| `moonbrand` | `contenuto_*`, `piano_*`, `uscite_*`, `idea_*`, `video_avvia` | i dati di moonbrand via API, solo nella chat |

## I lavori

| Lavoro | Script | Cosa fa |
| --- | --- | --- |
| `website` | `jobs/website.ts` | legge il sito del brand: chi è, temi, colori (solo i colori), logo |
| `ideas` | `jobs/ideas.ts` | le idee di contenuto, salvate nella sezione Idee |
| `content` | `jobs/content.ts` | la **proposta** di un contenuto (per un video il copione), con il consumo stimato in crediti; l'utente la legge in Contenuti e conferma |
| `content-video` | `jobs/content-video.ts` | il contenuto dalla proposta confermata: testi per canale e immagini, o il montaggio del video |
| `content-edit` | `jobs/content-edit.ts` | un ritocco della proposta o del contenuto fatto, nella sessione che l'ha scritto |
| `chat` | `jobs/chat.ts` | un turno della chat: tutti i tool; i video si montano a parte (`video_avvia` → `content-video`) |
| `welcome` | `jobs/welcome.ts` | i saluti e gli spunti del giorno |
| `video-setup` | `jobs/video-setup.ts` | prepara il progetto Remotion del brand nuovo |
| `style`, `visual`, `visual-edit` | `jobs/non-disponibile.ts` | non ci sono più: `style` finisce vuoto, gli esempi dell'onboarding falliscono con il motivo |

Il consumo stimato (`service/estimate.ts`) si misura sui lavori `content-video` degli ultimi 30 giorni, per formato
(mediana e 80° percentile, in crediti: 1 credito = 1 centesimo di dollaro); sotto 5 campioni vale la riserva. La chat lo
dice prima di fare un contenuto, la proposta lo scrive in `visual.estimate`.

## La cartella

```
src/
  main.ts            avvia il worker
  config/            env.ts (variabili, cartelle, modelli), prices.ts (listini)
  worker/            worker.ts (la coda), runner.ts (un lavoro dall'inizio alla fine), registry.ts (tipo → script e
                     salvataggio), steps.ts (i passaggi mostrati all'utente), step-reader.ts (Haiku li traduce)
  jobs/              uno script per tipo di lavoro, lanciato dal worker come processo a parte
  service/           agent.ts (lancia Claude Code), brand.ts (CLAUDE.md e logo), content.ts (schemi e salvataggio),
                     estimate.ts, video.ts (progetto Remotion), ideas.ts, welcome.ts, website.ts, language.ts, usage.ts
  repository/        db.ts, jobs.ts (tutto l'SQL del worker), storage.ts (i file dei brand su S3)
  tools/             i server MCP: uno per file, index.ts li mette insieme
  prompts/           i testi: chat.ts, content.ts, video.ts, voice.ts
video-kit/           il progetto Remotion di partenza di ogni brand, con la documentazione di Remotion in docs/
prove/               script per prendere dal DB l'input vero di un lavoro e rilanciarlo a mano
```

## Lanciare

```
npm install
npm run worker
```

Uno script a mano, con l'input vero di un job preso dal DB:

```
node --env-file=.env prove/input-dal-db.mjs content <brandId> > prove/content.json
npm run job src/jobs/content.ts <cartella del brand> "$(cat prove/content.json)"
```

Serve `pnpm` sul PATH (installa le dipendenze del progetto video di ogni brand) e il login di Claude Code sulla macchina.
