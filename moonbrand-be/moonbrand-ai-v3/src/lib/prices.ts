// I prezzi dei servizi che la chat usa con i suoi tool (jobs/chat), in dollari: nessuno dei tre dice nella
// risposta quanto è costata una chiamata. Gemini ed ElevenLabs da listino, verificati il 17 ottobre 2026; Atlas dal suo
// catalogo, letto all'ora.

// Gemini, per milione di token (ai.google.dev/gemini-api/docs/pricing). image: i token delle immagini generate, che
// costano più del testo; il ragionamento si paga come il testo in uscita. Le 3.6 e 3.8 Flash hanno il prezzo di lancio
// fino al 31 dicembre 2026, poi raddoppiano.
interface GeminiPrice {
  input: number;
  output: number;
  image?: number;
}

const GEMINI_PER_MILLION: Record<string, GeminiPrice> = {
  'gemini-3-pro-image': { input: 2, output: 12, image: 120 },
  'gemini-3.1-flash-image': { input: 0.5, output: 3, image: 60 },
  'gemini-3.1-flash-lite-image': { input: 0.25, output: 1.5, image: 30 },
  'gemini-nano-banana-2.1': { input: 1.5, output: 7.5, image: 30 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.1-pro': { input: 2, output: 12 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3-flash': { input: 0.5, output: 3 },
};

// Il modello si riconosce dal nome più lungo che combacia: gemini-3-pro-image-preview è gemini-3-pro-image.
function geminiPrice(model: string): GeminiPrice | undefined {
  const name = Object.keys(GEMINI_PER_MILLION)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];
  return name ? GEMINI_PER_MILLION[name] : undefined;
}

export function geminiCost(model: string, tokens: { input: number; output: number; image: number }): number | undefined {
  const price = geminiPrice(model);
  if (!price) return undefined;
  return (tokens.input * price.input + tokens.output * price.output + tokens.image * (price.image ?? price.output)) / 1_000_000;
}

// ElevenLabs a consumo (elevenlabs.io/pricing/api). L'allineamento delle parole non è in listino: si conta come la trascrizione.
export const ELEVENLABS = {
  voicePerThousandCharacters: 0.08,
  effectPerMinute: 0.12,
  transcriptionPerHour: 0.22,
};

// Atlas: il prezzo base di ogni modello viene dal suo catalogo (jobs/chat/atlas.ts), al secondo per i video e a pezzo
// per il resto.

// I prezzi al secondo misurati dal saldo di Atlas, che vincono sul catalogo: per alcuni modelli il catalogo dà solo il
// prezzo «a partire da». Si riconoscono dall'inizio del nome, perché il catalogo ha un modello per modo (image-to-video,
// text-to-video...). Grok 1.5 misurato il 2 ottobre 2026 (il 1080p è approssimato); Kling 3.0 Pro, sempre in 1080p con l'audio, il 9
// ottobre. Senza risoluzione nella richiesta si conta la più cara. Gemini Omni Flash segue il catalogo, verificato.
const ATLAS_MEASURED: Record<string, Record<string, number>> = {
  'xai/grok-imagine-video-v1.5/': { '720p': 0.145, '1080p': 0.25 },
  'kwaivgi/kling-v3.0-pro/': { '1080p': 0.143 },
};

export function atlasMeasured(model: string, resolution?: string): number | undefined {
  const prefix = Object.keys(ATLAS_MEASURED).find((key) => model.startsWith(key));
  if (!prefix) return undefined;
  const prices = ATLAS_MEASURED[prefix]!;
  return (resolution && prices[resolution.toLowerCase()]) || Math.max(...Object.values(prices));
}

// Il listino in crediti che la chat usa per le stime: 1 credito è 1 centesimo di dollaro di costo vero. Un'immagine
// di Gemini 3 Pro a 2K sono 1120 token; le clip sono Gemini Omni 1.1 Flash e, con le persone, Kling 4.0 su Atlas, al
// prezzo base del catalogo (0,039 e 0,11 $ al secondo il 27/10): il 1080p di default può costare di più.
const credits = (usd: number) => Math.round(usd * 100);

export const LISTINO =
  `un'immagine di Gemini 3 Pro ${credits((1120 * GEMINI_PER_MILLION['gemini-3-pro-image']!.image!) / 1_000_000)}, ` +
  `una clip almeno 4 al secondo, 11 con le persone, una musica o una canzone di Suno 13 (con 2 versioni), ` +
  `la voce ${credits(ELEVENLABS.voicePerThousandCharacters)} ogni 1000 caratteri`;
