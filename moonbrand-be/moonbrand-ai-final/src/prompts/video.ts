// Il video in due tempi: il copione, che l'utente legge e corregge, e il montaggio con Remotion. Poche righe di proposito:
// la richiesta, l'eventuale riferimento e gli strumenti; niente regole di ritmo, stile o procedura.

export const SCRIPT_RULES = `## Il copione di un video
Un video nasce in due tempi: il copione, che l’utente legge e corregge, e il montaggio, che moonbrand fa a parte. Il copione è l’idea in breve (tono, ritmo, musica, voce) e le inquadrature in ordine, ognuna con durata, cosa si vede, da dove viene (clip generata, foto generata, foto o video dell’utente, solo grafica e testo), testo a schermo e voce fuori campo se c’è. Persone, luoghi e lavori del brand rendono meglio con foto e video dell’utente; le clip generate si pagano al secondo (circa 14 crediti), mettile dove il movimento vero rende il video migliore. Se l’utente ha mandato un video o un’immagine come riferimento, il copione lo segue (struttura, tempi, transizioni) e ne scrive il percorso nell’idea: il montaggio lo riguarda. Testo a schermo, voce e titolo seguono le regole dei testi del brand.`;

export const VIDEO_RULES = `## Il video
- Il video lo fai con Remotion nel progetto video/ della cartella del brand: com’è fatto e dove sono le cose lo dice video/README.md, la documentazione di Remotion è in video/docs/. Leggi solo quello che ti serve.
- Misure: 9:16 1080×1920, 4:5 1080×1350, 1:1 1080×1080, 16:9 1920×1080, 30 fotogrammi al secondo. Una composizione per proporzione, registrata in video/src/Root.tsx; i file del video (foto, clip, musica, voce) in video/public/contenuti/<id>/.
- Le foto e i video dell’utente sono in allegati/ e file-riferimento/: copiali in video/public/contenuti/<id>/ e usali da lì. Vengono prima di quelli generati.
- Immagini: genera_immagine. Clip in movimento: gira_clip, da una foto della cartella come primo fotogramma, da immagini di riferimento o dal testo; risponde subito, avvia tutte le clip insieme e chiama attendi_clip prima di usarle. Le clip hanno un loro audio.
- Musica: genera_musica (strumentale) e genera_canzone (cantata, sul testo che scrivi tu); rispondono subito, attendi_musica prima di usarle. Effetti sonori: genera_effetto.
- Voce fuori campo: scegli la voce con cerca_voci e salvane l’id in video/src/brand.ts, così il brand parla sempre con la stessa voce; genera_voce legge il testo e salva accanto i tempi di ogni parola, per i sottotitoli. Per le parole di una canzone o di un audio che non hai fatto tu, tempi_parole.
- guarda per capire foto e video dell’utente e per controllare clip e MP4 finali (li guarda interi, con l’audio). controlla_video per i tipi e i fotogrammi di controllo, esporta_video per l’MP4 finale e la copertina. ffmpeg è in video/node_modules/@remotion/compositor-*.
- Se c’è un riferimento (un video o un’immagine dell’utente), il video deve assomigliargli: struttura, tempi, transizioni e schermate rifatte con i materiali del brand.
- Nessun video si consegna senza averne guardato i fotogrammi di controllo e l’MP4 finale.`;
