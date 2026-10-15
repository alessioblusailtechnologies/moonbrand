# moonbrand-ai-nuovo-2

Esperimento del 15/10/2026: la stessa ossatura di moonbrand-ai-nuovo (parte applicativa copiata da moonbrand-ai, niente
skill, template, Remotion, ElevenLabs, Atlas), ma le grafiche tornano a farle Claude in HTML e CSS, con un prompt ridotto
all'osso: sette righe su come si disegna, nessuna regola di impaginazione, nessun controllo sul DOM. Claude scrive la
pagina, `renderizza` la esporta in PNG con il Chrome di Puppeteer, Claude guarda il PNG e corregge. I video non ci sono
ancora.

In collaudo sostituisce del tutto il worker degli altri motori: si spegne quello, si accende questo, sullo stesso DB e
sullo stesso storage (stesso .env).

## Cosa fa

| Lavoro | Script | Come |
| --- | --- | --- |
| website | jobs/website.ts | com'era: legge il sito con Claude |
| visual, visual-edit | jobs/visual.ts, visual-edit.ts | gli esempi dell'onboarding: un post vero per canale in HTML |
| ideas | jobs/ideas.ts | com'era, con le regole nel prompt invece che nella skill |
| content, content-edit | jobs/content.ts, content-edit.ts | testi per canale e immagini in HTML; i video falliscono |
| style | jobs/style.ts | com'era: Gemini legge lo stile dai riferimenti (il testo non si usa) |
| welcome | jobs/welcome.ts | com'era |
| chat | jobs/chat.ts | guida corta, tool moonbrand + renderizza + foto + guarda |
| video-setup | jobs/non-disponibile.ts | finisce subito bene |
| content-video | jobs/non-disponibile.ts | fallisce: i video non ci sono ancora |

Il CLAUDE.md del brand lo scrive `lib/brief.ts`: chi è, logo, colori, dove sono i riferimenti, le ultime impaginazioni,
il piano. Niente font né guida di stile. Le regole di scrittura e di disegno stanno in `lib/content.ts` (CONTENT_RULES) e
valgono per i job e per la chat.

## Il tool renderizza

`tools/renderizza.ts`: file HTML → PNG alle misure del formato (4:5 1080×1350, 1:1, 9:16, 16:9, 1.91:1, 2:3), con il
Chrome che Puppeteer scarica da solo (`~/.cache/puppeteer`); aspetta font e immagini, poi scatta. Più uscite in una
chiamata girano insieme. Il browser resta aperto per tutto il job e si chiude alla fine (`close`). Il PNG lo guarda Claude
con Read; `guarda` (Gemini) resta per i riferimenti, le foto e i video dell'utente.

## Il tool foto

`tools/foto.ts`: le foto che servono dentro una grafica (un piatto, una ciocca, un locale) le fa un modello di immagini e
Claude le mette nell'HTML con `<img>`; niente testo né logo nella foto. Di base `gemini-nano-banana-2.1` (a token, pochi
centesimi), con `qualita: pro` Nano Banana Pro a 0,134 $; GEMINI_PHOTO_MODEL e GEMINI_PHOTO_PRO_MODEL per cambiarli.

## Lanciare

```
npm install
npm run worker
```

Uno script a mano, con l'input vero di un job preso dal DB:

```
node --env-file=.env prove/input-dal-db.mjs content <brandId> > prove/content.json
ENABLE_CLAUDEAI_MCP_SERVERS=false node --env-file=.env --import tsx src/jobs/content.ts C:/.../moonbrand-brands/<brandId> "$(cat prove/content.json)"
```
