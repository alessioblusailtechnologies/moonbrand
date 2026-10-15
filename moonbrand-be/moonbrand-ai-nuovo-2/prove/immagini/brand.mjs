// I due brand della prova: brief scritto a mano da CLAUDE.md, come lo scriverebbe il job «post» del motore nuovo.
const BRANDS = '../../../../moonbrand-brands';

export const brands = {
  'messina-slide2': {
    dir: `${BRANDS}/8beed05d-d53b-4b99-b865-5815e45268e3`,
    logo: 'esempi/logo.png',
    refs: ['file-riferimento/afe6d0b4-d949-4613-b681-3e34a2f5a0ef.jpg', 'esempi/4c8ba7b5-9a1e-4f40-9322-e66539824eb9/instagram-1.jpg'],
    // Prova 14/10: la seconda slide di un carosello, Pro contro Nano Banana 2.1, con la prima slide come immagine 3.
    brief: `Instagram carousel, slide 2 of 5, 4:5.
For Giovanni Messina Hair&Beauty, hair salon in Earl's Court, London: why hand-painted balayage grows out softly, no hard regrowth line.
Image 1 is the brand logo: use it as it is. Image 2 is the style to follow. Image 3 is slide 1 of this carousel: same system, same typography and palette, a new composition for this slide.
Texts, exact: title "NO HARD LINE", small line "We paint the blonde where the light would fall, so it blends as it grows", signature "02". No other text.
Brand colours: #323232, #E6DDC5, #85753D, #FFFFFF.`,
  },
  messina: {
    dir: `${BRANDS}/7e8e922d-943a-44e9-ab6b-d5d6c9936571`,
    logo: 'esempi/logo.png',
    refs: ['file-riferimento/dc5e04d6-4af7-473d-8e62-57b8ab291f81.jpg'],
    // Prova del 14/10: prompt corto e aperto, come in Gemini Playground, con l'immagine allegata.
    brief: `Instagram post, 4:5, for Giovanni Messina Hair & Beauty, a hair salon in Earl's Court, London, about hand-painted balayage.
Image 1 is the brand logo: use it as it is. Image 2 is the style reference: follow it.
Brand colours: #323232, #85753D, #B09C53, #E6DDC5. Text in English.`,
  },
  oconnors: {
    dir: `${BRANDS}/b557e88b-1a5a-407b-b1a4-92bb7f4f0f1c`,
    logo: 'logo.png',
    refs: ['riferimenti-da-seguire/instagram-1.png', 'template/anteprima/copertina.jpg'],
    brief: `You are the graphic designer of O'Connors Bakery, an Irish craft family bakery baking fresh breads and cream cakes since 1961, with bakery cafés in Clare, Limerick and Galway.
Design one Instagram post, portrait 4:5, 1080x1350, ready to publish.

Subject: celebration cakes for First Communions, now taking orders.
Text on the image, exactly this and nothing else:
- Headline: "Communion cakes, made by hand"
- Small line: "Order in store or at oconnorsbakery.com"
- Bottom strip, small caps: "@OCONNORSBAKERY · CLARE · LIMERICK · GALWAY"

Brand palette: dark navy blue #0F2D69, optical white #FFFFFF, cream #F8F7F4, antique gold #B39257, kraft #A89474.
Typography: an elegant calligraphic italic script (like Playfair Display Italic) for one accent word, paired with a geometric extra-bold all-caps sans (like Montserrat ExtraBold); body in Montserrat.
Photography: real artisanal bakery, warm natural light, subject in focus with a softly blurred background. Here: a cream communion cake decorated with real white flowers and a small Celtic cross on a wooden counter.
Recurring graphic signs of the brand: a light tilted paper note with a kraft tape strip, a hand-drawn empty gold five-point star, photos framed with a thin gold outline.

Image 1 is the brand logo: place it as it is, small, on a light area, without redrawing it.
Images 2 and 3 show the brand's current design language: match that language (colours, typography, signs, mood) but make a new composition, not a copy.
All text in English, spelled exactly as given. No other text, no watermark.`,
  },
  sunraise: {
    dir: `${BRANDS}/e659e3ba-416c-40f5-af9b-4549110c99c7`,
    logo: 'logo.png',
    refs: ['riferimenti-da-seguire/instagram-1.png', 'template/anteprima/copertina.jpg'],
    brief: `Sei il grafico di SunrAIse, agenzia italiana di comunicazione e marketing con intelligenza artificiale che aiuta le piccole imprese ad automatizzare i processi.
Disegna un post Instagram, verticale 4:5, 1080x1350, pronto da pubblicare.

Tema: i preventivi che oggi si scrivono a mano in mezz'ora, con un'automazione partono in due minuti.
Testo sull'immagine, esattamente questo e nient'altro:
- Titolo: "Un preventivo in 2 minuti, non in 30"
- Riga piccola: "Automazioni su misura per le PMI. Analisi gratuita su sunraise.it"
- Etichetta a pillola: "Automazioni"

Palette del brand: bianco ghiaccio #F4F6F8, blu notte #0A1128, blu elettrico #0062FF (solo per il box che evidenzia una parola chiave), arancione #FF6A00 (etichette a pillola e accenti), bianco #FFFFFF.
Carattere: sans-serif geometrico moderno tipo Plus Jakarta Sans o Inter; titolo grande in grassetto scuro con la parola chiave in bianco dentro un box blu; etichette e URL in minuscolo.
Fotografia: situazioni di lavoro reale e noioso (preventivi, fogli di calcolo su laptop, pile di documenti, scrivanie disordinate), in bianco e nero nitido con luce naturale.
Segni grafici ricorrenti del brand: pillole in filetto, cerchio con la freccia in basso a destra, riquadri inclinati dietro due parole del titolo, asterisco a otto bracci, numero 01 enorme in alto a destra, foto con angoli arrotondati.

L'immagine 1 è il logo del brand: mettilo com'è, piccolo, senza ridisegnarlo.
Le immagini 2 e 3 mostrano il linguaggio grafico attuale del brand: rispettalo (colori, tipografia, segni, tono) ma fai una composizione nuova, non una copia.
Tutto il testo in italiano, scritto esattamente come indicato. Nessun altro testo, nessuna filigrana.`,
  },
};
