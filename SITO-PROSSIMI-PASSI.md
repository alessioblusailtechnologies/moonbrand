# Sito: prossimi passi

Stato al 7 ottobre 2026. Online su `moonbrand.app`: sitemap e Search Console, anteprima social, 404 per lingua,
pagine Contatti, Prezzi, Privacy e Termini (testi da iubenda), form collegato allo studio, pagine per attività,
agenzie, funzionalità e social, pagine indice nel menù, tutto in italiano, inglese e francese (60 indirizzi nella
sitemap).
Le pagine nuove si aggiungono così: una voce in `PAGES` (`moonbrand-website/src/i18n/index.ts`), un file
`src/pages/<indirizzo>/index.astro` per lingua e il guscio `PageShell`. Il sito si rilascia con `npm run deploy`
in `moonbrand-website`, lo studio con `bash deploy.sh` dalla root.

## Fatto il 6-7 ottobre (rilasciato il 7)

- **Form "Inizia con Moonbrand"**: apre `studio.moonbrand.app/register` con nome, email, brand e lingua nell'indirizzo.
  Lo studio riempie la registrazione, parte nella lingua del sito e mette il nome del brand nel primo onboarding.
  Il consenso rimanda alla pagina Privacy; niente "prova gratuita" e niente consenso al marketing obbligatorio.
  Ancora da provare il giro completo con una registrazione vera.
- **Pagine per tipo di cliente**: solo "Per attività" e "Per agenzie" (brand tech tolto). "Per attività" è generica,
  per qualsiasi tipo di attività: le pagine per categoria (ristoranti, pasticcerie, palestre, negozi) sono state
  online solo il 7 ottobre e poi tolte; i loro indirizzi portano a "Per attività" (`public/_redirects`).
- **Pagine per funzionalità**: assistente AI, piano editoriale, video, pubblicazione, brand kit, nelle tre lingue,
  collegate dal footer (e "Scopri l'assistente" nella home). Tutte con la stessa forma (`Landing.astro`):
  problema, come lo risolve Moonbrand, tre post di esempio, prezzo di partenza, invito a iniziare.
  Testi in `copy.landings`, post di esempio in `src/data/landings.ts`. Usano l'immagine di anteprima generale.

## Rilasciato il 7 ottobre (seconda parte)

- **Menù senza ancore**: Funzionalità, Social, Per chi, Prezzi portano a pagine vere; "Inizia ora" apre la
  registrazione nello studio. La voce resta segnata anche sulle pagine che stanno dentro (Instagram → Social).
- **Pagine indice**: `/funzionalita/`, `/social/`, `/per-chi/` (e le versioni in inglese e francese), con un
  riquadro per ogni pagina del gruppo (`Hub.astro`, testi in `copy.hubs`).
- **Social**: Instagram, TikTok, Facebook, LinkedIn sotto `/social/` (`/fr/reseaux-sociaux/instagram/`), con i
  formati che Moonbrand prepara per quel canale. Testi in `copy.platforms`, indirizzi in `PLATFORMS`.
  X e Pinterest più avanti.
- **Menù sul telefono**: sotto i 760 px la barra ha logo, "Inizia ora" e il pulsante del menù; il pannello
  ha le quattro voci, le lingue e "Accedi". Si chiude con Esc o toccando un link.
- **Footer a colonne**: Funzionalità, Social, Per chi, Moonbrand (prezzi, contatti, accesso).
- Nella home le ancore restano solo dentro la pagina ("Guarda come funziona"); "Scopri le funzionalità" porta a
  `/funzionalita/`. 72 pagine in tutto.

## Rilasciato il 7 ottobre (terza parte)

- **Immagini e video con l'AI**: pagina funzionalità nuova (`/immagini-video-ai/`, `/en/ai-images-videos/`,
  `/fr/images-videos-ia/`) su quello che l'AI genera: foto e illustrazioni, clip video, musica anche cantata,
  effetti sonori, voce fuori campo. Seconda nell'elenco delle funzionalità, nel footer e nella pagina indice.
- Assistente, video e pagina indice Funzionalità ora dicono che immagini, clip, musica e voce possono essere
  generate dall'AI.

## Prossimi passi

- Home e Prezzi: dire anche lì che immagini, clip, musica e voce possono essere generate dall'AI
  ("In tutti i piani" oggi dice solo "Idee, post, caroselli e video").
- Esempi veri per i social: un brand di prova nello studio, 4-6 contenuti preparati dall'assistente, immagini in
  `public/images/` e un post in `data/home.ts`. Oggi TikTok, Facebook e LinkedIn hanno un post solo.
- Pagine per categoria di attività: messe da parte il 7 ottobre. Se si riprendono, meglio su due livelli
  (una quindicina di macro-categorie, poi i singoli mestieri a ondate) e con testi propri per ogni pagina.
- Guide e blog per le ricerche più specifiche (per esempio "piano editoriale social per ristoranti"),
  con le content collection di Astro.
- Un'immagine di anteprima propria per le pagine per cliente, social e funzionalità, se serve.

## Da fare a parte

- Search Console: chiedere l'indicizzazione di "Per attività", delle pagine per
  funzionalità, delle pagine indice (funzionalità, social, per chi), dei quattro social e di
  "Immagini e video con l'AI".
- Provare il form della home con un'email di prova: registrazione con nome ed email già scritti, brand
  nell'onboarding.
- Search Console: fra 2-3 giorni controllare che la sitemap sia "Riuscito" e che le pagine risultino indicizzate.
- Cloudflare Web Analytics: attivarlo da Analytics & Logs → Web Analytics → Add a site.
- iubenda: aggiungere la clausola "Applicazione mobile" ai Termini quando l'app è negli store.
- Pagine Privacy e Termini: il titolo appare due volte (il nostro e quello di iubenda); decidere se adattare lo stile.
