// I prezzi dei servizi che non dicono quanto è costata una chiamata, in dollari: con questi ogni generazione ha il suo
// costo in ai_usage. Listini verificati il 3 ottobre 2026; quando cambiano si aggiornano qui.

// Gemini, per milione di token (ai.google.dev/gemini-api/docs/pricing). 3.8 Flash ha il prezzo di lancio fino al
// 31 dicembre 2026, poi raddoppia.
const GEMINI_PER_MILLION: Record<string, { input: number; output: number }> = {
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'gemini-3.5-flash': { input: 1.5, output: 9 },
  'gemini-3.1-flash-image': { input: 0.5, output: 60 },
};

// Un'immagine di Gemini a 2K, a prezzo fisso: i token in uscita che riporta comprendono anche il ragionamento.
export const GEMINI_IMAGE_2K = 0.101;

export function geminiCost(model: string, inputTokens = 0, outputTokens = 0): number | undefined {
  const price = GEMINI_PER_MILLION[model];
  return price && (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

// ElevenLabs a consumo (elevenlabs.io/pricing/api). L'allineamento delle parole non è in listino: si conta come la trascrizione.
export const ELEVENLABS = {
  voicePerThousandCharacters: 0.08,
  musicPerMinute: 0.15,
  effectPerMinute: 0.12,
  isolationPerMinute: 0.12,
  transcriptionPerHour: 0.22,
};
