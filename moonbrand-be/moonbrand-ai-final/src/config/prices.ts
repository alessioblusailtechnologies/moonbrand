// I prezzi dei servizi che non dicono quanto è costata una chiamata, in dollari: con questi ogni generazione ha il suo
// costo in ai_usage, e da lì i crediti (1 credito = 1 centesimo). Listini verificati il 3 ottobre 2026.

// Gemini, per milione di token (ai.google.dev/gemini-api/docs/pricing). 3.8 Flash ha il prezzo di lancio fino al
// 31 dicembre 2026, poi raddoppia. Nano Banana 2.1: circa 3,4 centesimi a immagine 1K, listino da verificare.
const GEMINI_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3-pro-image': { input: 2, output: 120 },
  'gemini-nano-banana-2.1': { input: 0.5, output: 30 },
};

// Un'immagine di Nano Banana Pro (gemini-3-pro-image) a 2K, a prezzo fisso.
export const GEMINI_PRO_IMAGE_2K = 0.134;

export function geminiCost(model: string, inputTokens = 0, outputTokens = 0): number | undefined {
  const price = GEMINI_PER_MILLION[model];
  return price && (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// ElevenLabs a consumo (elevenlabs.io/pricing/api).
// L'allineamento delle parole non è in listino: si conta come la trascrizione.
export const ELEVENLABS = {
  voicePerThousandCharacters: 0.08,
  musicPerMinute: 0.15,
  effectPerMinute: 0.12,
  isolationPerMinute: 0.12,
  transcriptionPerHour: 0.22,
};
