# I template di moonbrand

Impaginazioni pronte per i post, per tipo di attività. Il brand ne sceglie uno nell'onboarding o nelle
Impostazioni (`visual.template`), in alternativa alle immagini di riferimento. Il motore copia il template scelto in
`template/` nella cartella del brand prima di ogni lavoro, con i colori del brand (`src/lib/templates.ts`), e lo descrive
nel CLAUDE.md del brand: chi fa un contenuto parte da un layout e lo riempie.

Il catalogo (id, categoria, nome, layout) è in `moonbrand-shared/src/domain/templates.ts`, le descrizioni nello studio
in `moonbrand-shared/src/i18n/messages/catalog.ts` (`templates`).

Ogni template ricostruisce un template professionale di `moonbrand-examples/` (Etsy, Creative Market), scelto dall'utente
(11/10/2026: i nostri disegnati da zero sembravano fatti da un'AI). Si rifanno fedeli impaginazione, gerarchia, proporzioni
e segni grafici dell'originale; testi, foto e logo sono nostri, i font sono gli stessi se sono su Google Fonts, se no i più
simili. L'origine è scritta in TEMPLATE.md.

## La cartella

```
<id>/
  TEMPLATE.md          il carattere del template e i layout, letto dall'agente (finisce nel CLAUDE.md del brand)
  layout/<nome>.html   un file per layout, i nomi del catalogo
  esempio/*.jpg        le foto d'esempio per le anteprime: foto vere di Unsplash o Pexels, con le fonti in esempio/FONTI.txt
  anteprima/<nome>.jpg i layout resi (npm run template-anteprime), copiati anche nello studio
```

## I layout

- HTML e CSS in un file solo, 1080×1350 (4:5), `body` senza margini e a misura piena: `renderizza` li esporta come i contenuti.
- I colori dal brand con quattro variabili, in un blocco `:root` che il motore sostituisce con la palette del brand
  (principale, secondario, accento, sfondo):
  ```css
  :root { --principale: #1F2A44; --secondario: #8A6F5A; --accento: #D9A441; --sfondo: #F4EFE8; }
  ```
  Il blocco contiene solo queste quattro variabili; le altre variabili vanno in un altro blocco. Un colore del template che non serve si può lasciare inutilizzato. Si possono usare anche
  bianco e nero puri, e trasparenze dei quattro colori con `color-mix()`. Il layout deve reggere con palette diverse:
  il testo su `--sfondo` in `--principale`, mai l'accento per testi lunghi.
- I font da Google Fonts con `<link>`, le stesse dell'originale o le più simili.
- Le foto con `<img>` da `../esempio/<nome>.jpg`, `object-fit: cover`, con `width` e `height` espliciti (un `<img>` in posizione assoluta non si allarga con `left`+`right` o `top`+`bottom`). Il logo, dove c'è, è il nome del brand in testo
  con la classe `logo` (l'agente lo sostituisce con il file del logo se il brand lo ha).
- Testi d'esempio in italiano, credibili per la categoria, con la lunghezza che avrà un testo vero.
- Ogni elemento che l'agente cambia ha un commento HTML che dice cosa ci va (`<!-- titolo: 3-7 parole -->`).
- Quello che fa l'originale si tiene, anche se `skills/contenuti/mestiere.md` lo elenca tra i segni dell'AI (una parola
  evidenziata, un'etichetta, una pillola): è la mano di un grafico vero, e TEMPLATE.md lo scrive tra i segni del template.
  Non si aggiunge niente che l'originale non ha.
- `npm run template-anteprime` stampa i controlli di `renderizza`: i «da correggere» (testi tagliati, sovrapposti, font
  mancanti) si correggono sempre; i «da valutare» restano solo se sono nell'originale.

## TEMPLATE.md

In italiano, al massimo 2.500 caratteri, per l'agente che lo usa:
- **Carattere**: in due o tre frasi, che grafico è e per chi.
- **Tipografia**: famiglie, pesi, misure dei titoli e dei testi, maiuscolo o no.
- **Griglia**: margini, colonne, dove stanno titolo, foto, testo e firma.
- **Origine**: il template di `moonbrand-examples/` da cui viene (cartella e link).
- **Grafica ricorrente**: i segni del template (filetti, fasce, evidenziazioni, tagli della foto) e dove stanno: chi lo usa li tiene.
- **Layout**: una riga per file: quando usarlo, cosa ci va, quanto testo.
- **Da non fare**: cosa rompe il template.

## Comandi

```
npm run template-foto -- <id> <nome.jpg> <formato> "<descrizione>"   # solo se non si trova una foto vera adatta (Gemini)
npm run template-anteprime -- <id>                                   # rende i layout e li copia nello studio
```

Le foto d'esempio stanno in git: al massimo 1600 px di lato, JPEG.
