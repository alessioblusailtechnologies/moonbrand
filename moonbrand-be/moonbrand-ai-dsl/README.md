# moonbrand-ai-dsl

Il motore che segue l'[ADR-001](../../ADR-001-motore-reel-after-effects.md): reel in After Effects da un documento JSON
che sceglie e combina mosse di un vocabolario curato, più la via «su misura» che fa crescere il vocabolario.

È un prototipo in una cartella a parte, nato il 24/10/2026 come copia di `moonbrand-ai-api` (chat con la Messages API,
niente Claude Code). Cambia la chat (`src/jobs/chat/chat.ts`: niente Lambda né Remotion, il prompt descrive gli strumenti
dei reel) e c'è `reel/`.

## Come lavora la chat

1. Opus legge il catalogo (`node reel/reel.ts catalogo`) e scrive il documento del reel in `lavoro/`: kit del brand,
   beat con testi, riprese, layout e mosse.
2. `node reel/reel.ts rendi <doc.json>` lo valida, passa il linter, lo compila, rende un'anteprima, controlla testi fuori
   zona e contrasto, poi rende il video (circa 1 minuto e mezzo sulla VM).
3. Le modifiche sono modifiche al documento, poi un nuovo `rendi`.
4. Se una richiesta non si fa con le mosse che ci sono, Opus scrive una mossa su misura (`guida-mosse`, poi `mossa`): si
   usa subito ed è una **proposta** finché una persona non la approva.

## reel/

| File | Cosa fa |
|---|---|
| `vocabolario/catalogo.json` | Le mosse di base (26), con parametri, limiti, energia, tag, signature. |
| `vocabolario/stile.json` | Token: famiglie di curve, energia, formati con zone sicure, punti focali, scala tipografica. |
| `vocabolario/libreria.ts` | Le mosse come codice AE parametrico (TypeScript → ES3), solo effetti nativi. |
| `vocabolario/mosse/` | Mosse su misura approvate: fanno parte della libreria. |
| `vocabolario/proposte/` | Mosse su misura proposte dalla chat, con i reel in cui sono state usate. |
| `schema.ts` | Lo schema JSON del documento, con gli id delle mosse come enum. |
| `compila.ts` | Il compilatore: schema, linter con correzioni, layout in coordinate, tempi sulla griglia della musica, JSX. |
| `rendi.mjs` | Render con nexrender: il `.aep` contenitore più lo script come asset di tipo script. Non serve AE aperto. |
| `reel.ts` | Gli strumenti da riga di comando. |

Regole del linter: hook entro 1,5 s; testi lunghi solo con mosse adatte; mai due entrate consecutive dallo stesso lato;
al massimo una mossa signature ogni 6 s; tempo minimo di lettura proporzionale alle parole; riprese che bastano per il
beat; anti-ripetizione sugli ultimi 5 reel del brand (`lavoro/.reel-storico.json`).

## Gate di gusto

Dalla cartella `reel/`:

- `node reel.ts galleria` scrive `vocabolario/proposte/galleria.html` con le proposte e i loro reel.
- `node reel.ts promuovi <id>` la porta nella libreria; `node reel.ts scarta <id>` la toglie.

## Sul collaudo

1. `ferma-worker.cmd` ferma il worker che gira, qualunque dei motori sia (da `cmd`, non da bash).
2. `avvia-collaudo.ps1` avvia questo worker. Il log va in `%TEMP%\moonbrand-worker-dsl.log`.
3. Per tornare al v2: `ferma-worker.cmd`, poi `avvia-v2.ps1`.

Al primo render nexrender ha modificato `commandLineRenderer.jsx` di After Effects (copia dell'originale in
`Support Files\Backup.Scripts`), per far girare gli script dentro aerender.
