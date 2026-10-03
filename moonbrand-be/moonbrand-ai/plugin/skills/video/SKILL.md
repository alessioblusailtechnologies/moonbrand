---
name: video
description: Come si fa un video per il brand della cartella (Reels, TikTok, Shorts, video per il feed) con Remotion - copione, stile, animazione, clip, musica, voce e sottotitoli, controllo dei fotogrammi ed esportazione. Da usare ogni volta che si crea o si ritocca un video.
---

# Fare un video

Il brand è descritto in CLAUDE.md. I video si fanno con Remotion nel progetto video del brand, in video/: com'è fatto lo spiega video/README.md. Per scrivere codice Remotion segui la skill moonbrand:remotion-best-practices. In moonbrand però non si apre lo studio di Remotion: il video lo guarda Gemini con il tool guarda, e alla fine si esporta sempre.

## Il copione

Un video nasce in due tempi: prima il copione, che l'utente legge e corregge, poi il video. Non generare immagini, clip o audio finché il copione non è approvato, a meno che il lavoro non dica di andare dritto.

Il copione è l'idea in breve (tono, ritmo, musica, voce) e la lista delle inquadrature, in ordine. Ogni inquadratura ha:
- **durata** in secondi;
- **cosa si vede**: soggetto, tipo di inquadratura (dettaglio, primo piano, mezza figura, totale) e movimento di macchina;
- **da dove viene**: clip generata, foto generata, foto o clip dell'utente, solo grafica e testo;
- **testo a schermo**, se c'è;
- **voce fuori campo**, se c'è.

Scegli la fonte pensando a cosa sembrerà vero: persone, luoghi e lavori del brand rendono meglio con foto e clip dell'utente. Quando le proponi, chi legge il copione sa cosa preparare.

Le clip generate hanno un tetto: **al massimo 3 $ di clip per tutta la conversazione, cioè circa 20 secondi in tutto** (si pagano circa 0,13 $ al secondo; quanto si è già speso te lo dicono le regole della chat e gira_clip); punta a stare sui 2,5 $, così resta margine per rifarne una. Se per l'idea o per le richieste dell'utente servono più clip, dillo già nel copione: quali, quanto costano e a quanto arriva la spesa, e lascia decidere all'utente. Mettile solo nelle inquadrature dove il movimento vero conta (una persona che fa qualcosa, il cibo che fuma, un gesto); il resto del video lo fanno foto, immagini generate animate nella composizione, grafica e testo. Nel copione scrivi quanti secondi di clip generate prevedi in tutto.

- I primi 1 o 2 secondi devono fermare lo scorrimento: una frase, un numero o un'immagine che fa venire voglia di restare.
- Un'inquadratura porta una sola idea. Il ritmo lo decide l'idea: tagli veloci per un elenco, più respiro per un racconto.
- Molti guardano senza audio: il testo a schermo deve bastare a capire il video. Frasi brevi, grandi, a contrasto, e ferme abbastanza da leggerle con calma.
- La durata è quella che serve all'idea, senza allungare.
- La chiusura lascia il brand riconoscibile, di solito con il logo o un'azione; su TikTok senza schermata finale (vedi la confezione per canale nella skill moonbrand:contenuti).

Testo a schermo e voce seguono le stesse regole dei testi del brand (skill moonbrand:contenuti): voce del brand, niente fatti, numeri o nomi inventati, segnaposto tra parentesi quadre per quello che non sai.

Il copione è uno per tutti i canali: scene e clip sono le stesse, mentre testo a schermo, grafica, ritmo e chiusura seguono la confezione di ogni canale. Quando i canali del contenuto hanno confezioni diverse, nel copione scrivi il testo a schermo della confezione principale e di' all'utente in una frase come cambia sugli altri.

Quando fai il video, segui il copione approvato: se mentre lo fai serve cambiare qualcosa (una durata, una fonte che manca), cambialo e dillo.

## Formati

| Proporzione | Misure | Dove |
| --- | --- | --- |
| 9:16 | 1080×1920 | Reels di Instagram e Facebook, TikTok, YouTube Shorts |
| 4:5 | 1080×1350 | feed di Instagram, Facebook e LinkedIn |
| 1:1 | 1080×1080 | feed di tutti i canali |
| 16:9 | 1920×1080 | X, LinkedIn, YouTube |

- 30 fotogrammi al secondo.
- In 9:16 i social coprono i bordi con i loro pulsanti e le didascalie: tieni testi e logo lontani da circa 250 px in alto, 400 px in basso e 150 px a destra.
- Fai una composizione per ogni proporzione e per ogni confezione (skill moonbrand:contenuti, «La confezione per canale»): per esempio una per il Reel di Instagram e una per TikTok, anche se sono tutte e due 9:16. Tieni le scene in componenti condivisi e cambia sopra testi, grafica e chiusura. Ripensa l'impaginazione, non ritagliare quella di un'altra.
- Ogni composizione ha il suo MP4 e la sua copertina; quelli fatti apposta per un canale si salvano con channel.

## Stile

- Lo stile del brand si prende come per le immagini: riferimenti-da-seguire e file-riferimento danno palette, font, tono delle foto e dettagli grafici, da seguire senza ricalcare l'impaginazione. Di solito sono già descritti in CLAUDE.md, sotto «Lo stile».
- video/src/brand.ts raccoglie colori, font e misure del brand per i video: se non c'è, crealo al primo video. I font si caricano con @remotion/google-fonts, oppure con @remotion/fonts dai file in video/public/brand.
- video/src/kit contiene i pezzi riusabili del brand, tra cui TestoTikTok per il testo a schermo come lo scrive l'app. Usali, migliorali e aggiungi quelli che un video crea e che serviranno ancora, così i video del brand si riconoscono tra loro.
- Guarda come sono fatti gli altri video in video/src/contenuti e fai qualcosa di diverso: ogni video deve essere riconoscibile come del brand e diverso dagli altri. Per capirlo bastano i nomi e l'inizio delle composizioni, non i file interi.
- Il movimento ha un senso: fa entrare le cose nell'ordine in cui vanno lette, mette in risalto il punto importante, dà ritmo. Niente animazioni messe tanto per muovere.

## Immagini e clip

- Le chiamate che non dipendono l’una dall’altra (immagini, voci, effetti, controlli con guarda, la musica) falle nello stesso messaggio: girano insieme.
- Foto e clip dell'utente sono in allegati/ o in file-riferimento/: copiale in video/public/contenuti/<id>/ e usale da lì. Quando ci sono, vengono prima di quelle generate.
- I post di altri scaricati con scarica_social, in allegati/riferimenti/, sono solo riferimenti: guardali per idea, ritmo, inquadrature e montaggio, ma non mettere i loro video, foto o audio nel video del brand.
- Le immagini nuove le generi con genera_immagine, salvandole direttamente in video/public/contenuti/<id>/.
- Le clip in movimento le generi con gira_clip (Gemini Omni Flash, 720p, da 3 a 10 s, in 9:16 o 16:9), e usale dove il movimento vero serve davvero:
  - di solito parti da una foto della cartella (una fatta con genera_immagine o una dell'utente) passata come foto: diventa il primo fotogramma, e la clip resta fedele a persone, luce e ambiente;
  - per tenere uguali persone, prodotti o luoghi in una scena nuova usa i riferimenti (fino a 10 immagini, descritte nel prompt);
  - il prompt in inglese dice l'azione, il movimento di macchina e cosa non deve cambiare (scritte, oggetti, volti);
  - chiedi la durata che userai nel montaggio: si paga al secondo. gira_clip dice a quanto è la spesa della conversazione e oltre il tetto rifiuta: allora finisci il video con foto e grafica, oppure chiedi all'utente se vuole spendere per altre clip, dicendo quanto costano e a quanto arriva la spesa; solo dopo il suo sì gira con oltre_tetto. Senza chat (i lavori lanciati dallo studio) il tetto non si supera. Rifare una clip venuta male costa come una nuova: prima di rifarla, valuta se basta tagliarla o accorciarla;
  - per i video in 4:5 o 1:1 gira in 9:16 e ritaglia nella composizione;
  - salvala direttamente in video/public/contenuti/<id>/;
  - gira_clip risponde subito: avvia tutte le clip insieme nello stesso messaggio, intanto scrivi la composizione, e prima di usarle o di guardarle chiama attendi_clip. Non chiudere il lavoro con una clip ancora in corso.
- Le clip le fai con gira_clip; le immagini restano con genera_immagine, musica, voce ed effetti con ElevenLabs.
- Le clip hanno un audio loro: toglilo o abbassalo se c'è già musica o voce.
- Nella composizione clip e video si mettono con `Video` di `@remotion/media`, mai con `OffthreadVideo`: il render è più veloce di circa un terzo. Se un video del brand usa ancora `OffthreadVideo`, non copiarlo.
- Per controllare una clip, o per capire una clip o un video dell’utente, passali interi al tool guarda: li guarda con l’audio e ti dice cosa succede e quando. Un fotogramma estrailo solo quando ti serve come immagine (per esempio una copertina): ffmpeg è in video/node_modules/@remotion/compositor-* ed è ridotto, senza filtri, quindi un fotogramma alla volta (`ffmpeg -ss <secondo> -i clip.mp4 -frames:v 1 f.jpg`).

## Audio

Non puoi ascoltare niente di quello che generi: descrivi tutto con precisione e controlla i tempi sui file.

Musica e canzoni si fanno in sottofondo: genera_musica e genera_canzone rispondono subito e il brano arriva in pochi secondi o qualche decina. Avviale appena sai cosa serve, prima di scrivere la composizione, e intanto vai avanti; chiama attendi_musica prima di usare il brano o di renderizzare. Chiedi solo i brani che userai, della durata che ti serve: si pagano al minuto.

- **Musica**: genera_musica (ElevenLabs) compone un brano strumentale della durata che chiedi: quella del video, più un paio di secondi. Descrivi in inglese genere, atmosfera, strumenti, tempo, andamento e come finisce, in accordo con la voce del brand. Nel video chiudila con una dissolvenza negli ultimi secondi e abbassala sotto la voce.
- **Canzone o jingle**: quando il video chiede una parte cantata, genera_canzone (ElevenLabs) la compone sul testo che scrivi tu, della durata che chiedi. Il testo è quello di una canzone vera, come un pezzo di tendenza del momento, non il copy messo in musica: niente frasi della caption, claim, offerte, prezzi o elenchi di prodotti. Racconta in immagini e sensazioni il mondo del brand (il momento, il posto, chi ci va, come ci si sente), con il suo tono; il ritornello è breve, orecchiabile e si ripete, le righe sono corte e cantabili, e il nome del brand compare al massimo nel ritornello, solo se suona naturale. È nella lingua dei post, con le sezioni [Verse], [Chorus], [Bridge] e [Outro]; la durata si divide tra le sezioni in base alle righe, e una sezione senza righe (come [Intro]) resta strumentale; lo stile si descrive in inglese, con la voce che serve. Il testo a schermo resta quello del copione e la canzone non lo ripete; un verso del ritornello può comparire a schermo in più, non al posto del messaggio. Se l'utente chiede un'altra canzone, scrivi anche parole nuove, non solo un altro stile.
- **Voce fuori campo**: scegli la voce con cerca_voci partendo dalla voce del brand, poi salvane l'id in video/src/brand.ts. Se c'è già, usa quella: il brand parla sempre con la stessa voce. Il testo lo leggi con genera_voce, nella lingua dei post. Scrivilo come si pronuncia e segui la voce del brand come per i testi.
- **Sottotitoli**: genera_voce salva accanto all'audio un .json con i tempi di ogni parola nel formato di @remotion/captions. Usalo per i sottotitoli (vedi le captions in moonbrand:remotion-best-practices) e per mettere a tempo scene e testi sulla voce. Con la voce, i sottotitoli ci vogliono sempre.
- **Parole di una canzone o di un audio che non hai fatto con genera_voce**: i tempi li trova tempi_parole, che separa la voce dalla musica e allinea il testo a quello che si sente, parola per parola. Passagli il testo esatto quando lo conosci; il modello a volte ripete o salta qualche parola, quindi se non sei sicuro lascialo vuoto e il tool trascrive (e ti dice cosa ha sentito). Con da e a lavora solo sul pezzo del brano che usi. Non stimare i tempi a orecchio e non trascrivere per conto tuo con altri programmi: le parole che si accendono fuori tempo si notano subito.
- **Effetti**: genera_effetto per transizioni, colpi e ambienti, descritti in inglese. Pochi e al servizio del ritmo.

## Pochi passaggi

Ogni passaggio, cioè ogni chiamata a un tool, rilegge tutta la conversazione: a costare è il numero dei passaggi, più di quanto fa ciascuno.

- I comandi che servono uno dopo l'altro vanno in un solo Bash; i tool che non dipendono l'uno dall'altro nello stesso messaggio.
- Per correggere un file cambia con Edit le righe che servono; riscrivilo per intero solo se cambia quasi tutto.
- Leggi solo quello che ti serve (le righe giuste, con grep o con un intervallo), non file interi che conosci già: quello che leggi resta nella conversazione fino alla fine.
- Scrivi la composizione con i tempi presi dai file (durate di clip, voce e musica, tempi delle parole), così il primo controllo trova poco da correggere.

## Controllo

Non puoi guardare il video mentre scorre: lo guarda per te Gemini e ti risponde a parole. Fagli sempre una lista precisa di cosa controllare.

- Mentre lavori, controlla con controlla_video: in una sola chiamata controlla i tipi, esporta a metà risoluzione i fotogrammi che chiedi di tutte le composizioni e li fa guardare a Gemini. Chiedi il primo e l'ultimo fotogramma e, per ogni scena, quello in cui il testo è tutto visibile (al massimo 20 in tutto), con la lista: testo leggibile e intero, niente tagli o sovrapposizioni, margini rispettati, colori del brand, nessun fotogramma vuoto per errore. Se i tipi o l'export non vanno ti dice solo l'errore: correggi e richiamalo. Non esportare fotogrammi di controllo con npx remotion e non lanciare pnpm check a parte.
- Correggi in un giro solo tutto quello che segnala, poi ricontrolla solo i fotogrammi delle scene che hai toccato.
- Apri tu un fotogramma (sono in video/out/controllo) solo quando devi correggere un'impaginazione e la descrizione non basta: ogni immagine che apri resta nella conversazione fino alla fine.
- Poi esporta i video finali in MP4 con esporta_video, che li renderizza su Remotion Lambda in pochi secondi: tutte le composizioni in una sola chiamata, e ogni nuovo export dopo una correzione allo stesso modo. Passali interi a guarda: oltre ai controlli di sopra, che testi e scene restino a schermo abbastanza da leggerli, che musica, voce ed effetti partano a tempo con le scene, che i sottotitoli seguano la voce, che i volumi siano giusti e che il finale si chiuda bene. Correggi quello che segnala, riesporta e ricontrolla.
- Esporta anche una copertina in JPEG o PNG, scegliendo il fotogramma che meglio rappresenta il video. Video finale e copertina a risoluzione piena, senza `--scale`.
- Le copertine esportale qui con `npx remotion still`: sono veloci. Lanciale insieme in un solo comando (ognuna con `&` in fondo, poi `wait`), nello stesso messaggio di esporta_video.
- Se esporta_video non c'è o non riesce, esporta i video finali qui con `npx remotion render`, tutti insieme nello stesso modo: il render in locale occupa la CPU e richiede tempo.

## Dove vanno i file

<id> è l'id del contenuto; in chat, finché il video non è salvato, un nome breve e unico.

- La composizione in video/src/contenuti/<id>/, registrata in video/src/Root.tsx.
- Musica, immagini e clip in video/public/contenuti/<id>/.
- Il video finale e la copertina nella cartella indicata dal lavoro; i fotogrammi di controllo li mette controlla_video in video/out/controllo.
