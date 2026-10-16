# Il progetto video del brand

Il progetto Remotion di questo brand: i video sono pagine React che cambiano fotogramma per fotogramma. È nato da un
progetto di partenza uguale per tutti ed è del brand: cambialo, allargalo, aggiungi librerie (`pnpm add <libreria>` in
questa cartella).

## La cartella

- `src/Root.tsx`: registra le composizioni, una per video e per proporzione.
- `src/kit/`: pezzi riusabili (entrate, parole una alla volta, testo come lo scrive TikTok). Aggiungine quando un video
  ne crea uno che servirà ancora.
- `src/contenuti/<id>/`: la composizione di ogni video.
- `public/brand/`: logo e file del brand usati nei video.
- `public/contenuti/<id>/`: musica, effetti, clip e immagini di ogni video, da usare con `staticFile('contenuti/<id>/…')`.
- `docs/`: la documentazione di Remotion. Parti da `docs/markup/REFERENCE.md` (componenti, animazioni, media, transizioni),
  poi `docs/captions`, `docs/multimedia` (durata e misure dei file), `docs/render`.

## Come si lavora

- 30 fotogrammi al secondo. 9:16 1080×1920, 4:5 1080×1350, 1:1 1080×1080, 16:9 1920×1080.
- Clip e video nella composizione con `Video` di `@remotion/media`, non `OffthreadVideo`: il render è più veloce.
- I fotogrammi di controllo e i tipi: il tool `controlla_video`. L'MP4 finale e la copertina: il tool `esporta_video`.
  Se servono a mano: `npx remotion still <composizione> <file.png> --frame=<n>` e `npx remotion render <composizione> <file.mp4>`
  da questa cartella, con percorsi assoluti per i file fuori da qui.
- ffmpeg è in `node_modules/@remotion/compositor-*` (ridotto, senza filtri): va bene per un fotogramma o per misurare un
  file.
