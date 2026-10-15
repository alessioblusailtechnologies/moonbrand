# moonbrand-ai-nuovo

Esperimento del 14/10/2026: il motore AI di moonbrand rifatto da zero sul generativo, tenendo solo la parte applicativa di
moonbrand-ai. Il post lo disegna un modello di immagini (Nano Banana Pro), non l'HTML: Claude scrive il brief da grafico,
il motore impagina testi, foto, grafica e logo insieme, il motore di visione controlla. Niente skill, template, Remotion,
ElevenLabs, Atlas. I video non ci sono ancora.

In collaudo sostituisce del tutto il worker di moonbrand-ai: si spegne quello, si accende questo, sullo stesso DB e sullo
stesso storage (stesso .env).

## Cosa fa

| Lavoro | Script | Come |
| --- | --- | --- |
| website | jobs/website.ts | com'era: legge il sito con Claude |
| visual, visual-edit | jobs/visual.ts, visual-edit.ts | gli esempi dell'onboarding: un post vero per canale con disegna |
| ideas | jobs/ideas.ts | com'era, con le regole nel prompt invece che nella skill |
| content, content-edit | jobs/content.ts, content-edit.ts | testi per canale e immagini con disegna; i video falliscono |
| style | jobs/style.ts | com'era: Gemini legge lo stile dai riferimenti |
| welcome | jobs/welcome.ts | com'era |
| chat | jobs/chat.ts | guida corta, tool moonbrand + disegna + guarda |
| video-setup | jobs/non-disponibile.ts | finisce subito bene |
| content-video | jobs/non-disponibile.ts | fallisce: i video non ci sono ancora |

Il CLAUDE.md del brand lo scrive `lib/brief.ts`: chi è, logo, colori, font, lo stile letto dai riferimenti, le ultime
impaginazioni, il piano. Le regole di scrittura e di disegno stanno in `lib/content.ts` (CONTENT_RULES) e valgono per i job
e per la chat.

## Il tool disegna

`tools/disegna.ts`: brief + riferimenti (logo per primo, poi uno o due riferimenti di stile, poi una slide già fatta) →
PNG a 2K nella proporzione del canale, con `gemini-3-pro-image` (GEMINI_DESIGN_MODEL per cambiarlo). Costo fisso per
immagine in `lib/prices.ts`. La prova che ha deciso questa strada è in `prove/immagini` (apri `index.html`).

## Lanciare

```
npm install
npm run worker
```

Uno script a mano, con l'input vero di un job preso dal DB:

```
node --env-file=.env prove/input-dal-db.mjs content <brandId> > prove/content.json
node --env-file=.env --import tsx src/jobs/content.ts ../../moonbrand-brands/<brandId> "$(cat prove/content.json)"
```
