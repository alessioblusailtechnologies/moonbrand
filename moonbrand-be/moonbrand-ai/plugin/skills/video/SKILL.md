---
name: video
description: Come si fa un video per il brand della cartella (Reels, TikTok, Shorts, video per il feed) con Remotion - copione, stile, animazione, musica, controllo dei fotogrammi ed esportazione. Da usare ogni volta che si crea o si ritocca un video.
---

# Fare un video

Il brand è descritto in CLAUDE.md. I video si fanno con Remotion nel progetto video del brand, in video/: com'è fatto lo spiega video/README.md. Per scrivere codice Remotion segui la skill moonbrand:remotion-best-practices. In moonbrand però non si apre lo studio di Remotion: il video si controlla dai fotogrammi e alla fine si esporta sempre.

## Il copione

Prima di scrivere codice, scrivi il copione: le scene in ordine, per ognuna quanto dura, cosa si vede, il testo a schermo e cosa succede nell'audio.

- I primi 1 o 2 secondi devono fermare lo scorrimento: una frase, un numero o un'immagine che fa venire voglia di restare.
- Una scena porta una sola idea. Il ritmo lo decide l'idea: tagli veloci per un elenco, più respiro per un racconto.
- Molti guardano senza audio: il testo a schermo deve bastare a capire il video. Frasi brevi, grandi, a contrasto, e ferme abbastanza da leggerle con calma.
- La durata è quella che serve all'idea, senza allungare.
- La chiusura lascia il brand riconoscibile, di solito con il logo o un'azione.

Il testo a schermo segue le stesse regole dei testi del brand (skill moonbrand:contenuti): voce del brand, niente fatti, numeri o nomi inventati, segnaposto tra parentesi quadre per quello che non sai.

## Formati

| Proporzione | Misure | Dove |
| --- | --- | --- |
| 9:16 | 1080×1920 | Reels di Instagram e Facebook, TikTok, YouTube Shorts |
| 4:5 | 1080×1350 | feed di Instagram, Facebook e LinkedIn |
| 1:1 | 1080×1080 | feed di tutti i canali |
| 16:9 | 1920×1080 | X, LinkedIn, YouTube |

- 30 fotogrammi al secondo.
- In 9:16 i social coprono i bordi con i loro pulsanti e le didascalie: tieni testi e logo lontani da circa 250 px in alto, 400 px in basso e 150 px a destra.
- Se servono più proporzioni, fai una composizione per ciascuna e ripensa l'impaginazione: non ritagliare quella di un'altra.

## Stile

- Lo stile del brand si prende come per le immagini: riferimenti-da-seguire e file-riferimento danno palette, font, tono delle foto e dettagli grafici, da seguire senza ricalcare l'impaginazione.
- video/src/brand.ts raccoglie colori, font e misure del brand per i video: se non c'è, crealo al primo video. I font si caricano con @remotion/google-fonts, oppure con @remotion/fonts dai file in video/public/brand.
- video/src/kit contiene i pezzi riusabili del brand. Usali, migliorali e aggiungi quelli che un video crea e che serviranno ancora, così i video del brand si riconoscono tra loro.
- Guarda le composizioni degli altri video in video/src/contenuti e fai qualcosa di diverso: ogni video deve essere riconoscibile come del brand e diverso dagli altri.
- Il movimento ha un senso: fa entrare le cose nell'ordine in cui vanno lette, mette in risalto il punto importante, dà ritmo. Niente animazioni messe tanto per muovere.

## Immagini, clip e audio

- Foto e clip dell'utente sono in allegati/ o in file-riferimento/: copiale in video/public/contenuti/<id>/ e usale da lì.
- Le immagini nuove le generi con genera_immagine, salvandole direttamente in video/public/contenuti/<id>/.
- La musica la componi con genera_musica, lunga quanto il video: descrivi genere, atmosfera, strumenti, tempo e come cresce e si chiude, in accordo con la voce del brand. Non puoi ascoltarla, quindi descrivila con precisione. Nel video chiudila con una dissolvenza negli ultimi secondi.

## Controllo

Non puoi guardare il video mentre scorre: lo controlli dai fotogrammi.

- Esporta in PNG il primo e l'ultimo fotogramma e, per ogni scena, quello in cui il testo è tutto visibile. Guardali uno per uno: testo leggibile, niente tagli o sovrapposizioni, margini rispettati, colori del brand, nessun fotogramma vuoto per errore.
- Correggi e riesporta finché è tutto a posto; lancia anche `pnpm check` per i tipi.
- Poi esporta il video finale in MP4 e una copertina in JPEG o PNG, scegliendo il fotogramma che meglio lo rappresenta.

## Dove vanno i file

- La composizione in video/src/contenuti/<id>/, registrata in video/src/Root.tsx.
- Musica, immagini e clip in video/public/contenuti/<id>/.
- I fotogrammi di controllo, il video finale e la copertina nella cartella indicata dal lavoro.
