// I prezzi dei servizi che la chat usa con i suoi tool (jobs/chat), in dollari: nessuno dice nella risposta quanto è
// costata una chiamata. I modelli di testo di Gemini li prezza il listino di Pi, che si aggiorna con Pi: qui resta solo
// quello che Pi non ha (i token delle immagini generate, ElevenLabs, i prezzi misurati di Atlas).

// Il listino di Pi per milione di token, registrato dall'estensione (pi/moonbrand.ts) quando Pi la carica.
export type TextPrice = { input: number; output: number; cacheRead?: number };
let textPrice: (model: string) => TextPrice | undefined = () => undefined;
export function useTextPrices(lookup: (model: string) => TextPrice | undefined) {
  textPrice = lookup;
}

// Le immagini di Gemini, per milione di token (ai.google.dev/gemini-api/docs/pricing): Pi le ha solo come testo, senza
// il prezzo dei token delle immagini generate, che costano molto di più. Verificati il 17 ottobre 2026.
const GEMINI_IMAGE: Record<string, TextPrice & { image: number }> = {
  'gemini-3-pro-image': { input: 2, output: 12, image: 120 },
  'gemini-3.1-flash-image': { input: 0.5, output: 3, image: 60 },
  'gemini-3.1-flash-lite-image': { input: 0.25, output: 1.5, image: 30 },
  'gemini-nano-banana-2.1': { input: 1.5, output: 7.5, image: 30 },
};

// Il modello immagine si riconosce dal nome più lungo che combacia: gemini-3-pro-image-preview è gemini-3-pro-image.
function imagePrice(model: string) {
  const name = Object.keys(GEMINI_IMAGE)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return name ? GEMINI_IMAGE[name] : undefined;
}

// Il ragionamento si paga come il testo in uscita; i token letti dalla cache al prezzo della cache, se Pi lo dà.
export function geminiCost(model: string, tokens: { input: number; output: number; image: number; cached?: number }): number | undefined {
  const cached = tokens.cached ?? 0;
  const image = imagePrice(model);
  if (image) return (tokens.input * image.input + tokens.output * image.output + tokens.image * image.image) / 1_000_000;
  const price = textPrice(model);
  if (!price) return undefined;
  return ((tokens.input - cached) * price.input + cached * (price.cacheRead ?? price.input) + tokens.output * price.output) / 1_000_000;
}

// ElevenLabs a consumo (elevenlabs.io/pricing/api). L'allineamento delle parole non è in listino: si conta come la trascrizione.
export const ELEVENLABS = {
  voicePerThousandCharacters: 0.08,
  effectPerMinute: 0.12,
  transcriptionPerHour: 0.22,
};

// Atlas: il prezzo base di ogni modello viene dal suo catalogo (jobs/chat/atlas.ts), al secondo per i video e a pezzo
// per il resto.

// I prezzi al secondo misurati dal saldo di Atlas, che vincono sul catalogo per la stima detta prima di partire: per molti
// modelli il catalogo dà solo il prezzo «a partire da». A lavoro finito si conta il prezzo che Atlas restituisce. Si riconoscono dall'inizio del nome, perché il catalogo ha un modello per modo (image-to-video,
// text-to-video...). Grok 1.5 misurato il 2 ottobre 2026 (il 1080p è approssimato); Kling 3.0 Pro, sempre in 1080p con l'audio, il 9
// ottobre. Kling 4.0 e Omni 1.1 Flash dalla fatturazione di Atlas del 27 ottobre (il 1080p ricavato per differenza). Senza
// risoluzione nella richiesta si conta la più cara. Gemini Omni Flash segue il catalogo, verificato.
const ATLAS_MEASURED: Record<string, Record<string, number>> = {
  'xai/grok-imagine-video-v1.5/': { '720p': 0.145, '1080p': 0.25 },
  'kwaivgi/kling-v3.0-pro/': { '1080p': 0.143 },
  'kwaivgi/kling-v4.0/': { '720p': 0.143, '1080p': 0.215 },
  'google/gemini-omni-1.1-flash/': { '720p': 0.1, '1080p': 0.145 },
};

export function atlasMeasured(model: string, resolution?: string): number | undefined {
  const prefix = Object.keys(ATLAS_MEASURED).find((key) => model.startsWith(key));
  if (!prefix) return undefined;
  const prices = ATLAS_MEASURED[prefix]!;
  return (resolution && prices[resolution.toLowerCase()]) || Math.max(...Object.values(prices));
}

// Il listino in crediti che la chat usa per le stime: 1 credito è 1 centesimo di dollaro di costo vero. Un'immagine
// di Gemini 3 Pro a 2K sono 1120 token; le clip sono Gemini Omni 1.1 Flash e, con le persone, Kling 4.0 su Atlas, al
// prezzo misurato del 1080p di default (ATLAS_MEASURED).
const credits = (usd: number) => Math.round(usd * 100);

export const LISTINO =
  `un'immagine di Gemini 3 Pro ${credits((1120 * GEMINI_IMAGE['gemini-3-pro-image']!.image) / 1_000_000)}, ` +
  `una clip circa 15 al secondo, 22 con le persone, una musica o una canzone di Suno 13 (con 2 versioni), ` +
  `la voce ${credits(ELEVENLABS.voicePerThousandCharacters)} ogni 1000 caratteri`;
