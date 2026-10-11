# I template di moonbrand

Impaginazioni pronte per i post, disegnate da noi per tipo di attività. Il brand ne sceglie uno nell'onboarding o nelle
Impostazioni (`visual.template`), in alternativa alle immagini di riferimento. Il motore copia il template scelto in
`template/` nella cartella del brand prima di ogni lavoro, con i colori del brand (`src/lib/templates.ts`), e lo descrive
nel CLAUDE.md del brand: chi fa un contenuto parte da un layout e lo riempie.

Il catalogo (id, categoria, nome, layout) è in `moonbrand-shared/src/domain/templates.ts`, le descrizioni nello studio
in `moonbrand-shared/src/i18n/messages/catalog.ts` (`templates`).

I template sono nostri: le gallerie in `moonbrand-examples/` (Etsy, Creative Market) sono solo ispirazione per capire
quali post servono a una categoria. Non si copiano grafiche, testi, foto o font a pagamento di quei template.

## La cartella

```
<id>/
  TEMPLATE.md          il carattere del template e i layout, letto dall'agente (finisce nel CLAUDE.md del brand)
  layout/<nome>.html   un file per layout, i nomi del catalogo
  esempio/*.jpg        le foto d'esempio per le anteprime (npm run template-foto)
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
- I font da Google Fonts con `<link>`, al massimo due famiglie per template. Non quelli di ripiego dell'AI (vedi
  `skills/contenuti/mestiere.md`): Inter, Space Grotesk, Fraunces, Instrument Serif, Geist, DM Sans, Manrope, Plus Jakarta Sans.
- Le foto con `<img>` da `../esempio/<nome>.jpg`, `object-fit: cover`, con `width` e `height` espliciti (un `<img>` in posizione assoluta non si allarga con `left`+`right` o `top`+`bottom`). Il logo, dove c'è, è il nome del brand in testo
  con la classe `logo` (l'agente lo sostituisce con il file del logo se il brand lo ha).
- Testi d'esempio in italiano, credibili per la categoria, con la lunghezza che avrà un testo vero.
- Ogni elemento che l'agente cambia ha un commento HTML che dice cosa ci va (`<!-- titolo: 3-7 parole -->`).
- Le regole di `skills/contenuti/mestiere.md` valgono anche qui: niente pillole, card arrotondate con ombra, sfumature,
  parola evidenziata nel titolo, etichette piccole in maiuscolo spaziato, numeri d'ordine 01/02, tutto centrato.
  `npm run template-anteprime` stampa i controlli di `renderizza`: un template li passa tutti.

## TEMPLATE.md

In italiano, al massimo 2.500 caratteri, per l'agente che lo usa:
- **Carattere**: in due o tre frasi, che grafico è e per chi.
- **Tipografia**: famiglie, pesi, misure dei titoli e dei testi, maiuscolo o no.
- **Griglia**: margini, colonne, dove stanno titolo, foto, testo e firma.
- **Grafica ricorrente**: i pochi segni del template (filetti, fasce di colore, tagli della foto) e dove stanno.
- **Layout**: una riga per file: quando usarlo, cosa ci va, quanto testo.
- **Da non fare**: cosa rompe il template.

## Comandi

```
npm run template-foto -- <id> <nome.jpg> <formato> "<descrizione>"   # una foto d'esempio con Gemini (poi ridotta a 1600 px: stanno in git)
npm run template-anteprime -- <id>                                   # rende i layout e li copia nello studio
```
