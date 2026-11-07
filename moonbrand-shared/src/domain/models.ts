// Quale modello e quanto ragionamento usano la chat e gli strumenti del motore: li sceglie l'admin dallo studio (sezione
// Modelli) e stanno nel DB (presenza.settings, chiave models). Il worker li legge a ogni lavoro e li passa alla chat, quindi
// valgono dal turno dopo senza riavviare niente. Qui i predefiniti, gli stessi che il motore aveva nel codice.

export const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

// Gli strumenti con un modello loro. Ragionano solo quelli su Gemini (testi, vista, ricerca): il modello delle immagini,
// la voce di ElevenLabs e Suno non hanno un livello.
export const MODEL_TOOLS = ['testi', 'immagini', 'vista', 'ricerca', 'voce', 'musica'] as const;
export type ModelTool = (typeof MODEL_TOOLS)[number];
export const THINKING_TOOLS: readonly ModelTool[] = ['testi', 'vista', 'ricerca'];

export interface ModelChoice {
  model: string;
  // Senza, il ragionamento predefinito del modello.
  thinking?: ThinkingLevel;
}

export interface ModelSettings {
  // La chat, nel formato di Pi: fornitore/modello.
  chat: { model: string; thinking: ThinkingLevel };
  tools: Record<ModelTool, ModelChoice>;
}

// Quello che arriva dal DB o dall'ambiente può essere incompleto: ogni pezzo che manca prende il predefinito.
export interface ModelSettingsPatch {
  chat?: Partial<ModelSettings['chat']>;
  tools?: Partial<Record<ModelTool, Partial<ModelChoice>>>;
}

export const DEFAULT_MODEL_SETTINGS: ModelSettings = {
  chat: { model: 'anthropic/claude-opus-5-5', thinking: 'high' },
  tools: {
    testi: { model: 'gemini-4-argon' },
    immagini: { model: 'gemini-3-pro-image' },
    vista: { model: 'gemini-3.8-flash' },
    ricerca: { model: 'gemini-3.8-flash' },
    voce: { model: 'eleven_v3' },
    musica: { model: 'suno/chirp-v6' },
  },
};

// La base con sopra quello che è salvato, chiave per chiave: una chiave nuova nel codice prende il suo predefinito, e il
// ragionamento resta solo agli strumenti che ragionano.
export function mergeModelSettings(stored: ModelSettingsPatch | null | undefined, base: ModelSettings = DEFAULT_MODEL_SETTINGS): ModelSettings {
  const tools = {} as Record<ModelTool, ModelChoice>;
  for (const tool of MODEL_TOOLS) {
    const own = stored?.tools?.[tool];
    const thinking = THINKING_TOOLS.includes(tool) ? (own?.thinking ?? base.tools[tool].thinking) : undefined;
    tools[tool] = { model: own?.model || base.tools[tool].model, ...(thinking && { thinking }) };
  }
  return { chat: { model: stored?.chat?.model || base.chat.model, thinking: stored?.chat?.thinking || base.chat.thinking }, tools };
}

// Il catalogo dei modelli tra cui scegliere, per la chat e per ogni strumento. Lo scrive il worker del motore (lib/catalog.ts)
// in presenza.settings (chiave models.catalog), all'avvio e poi ogni ora, dalle fonti a runtime: la lista di Pi per la chat
// (i fornitori con una chiave), Google con le modalità di OpenRouter per i tool su Gemini, Atlas per immagini e musica,
// ElevenLabs per la voce. Nessun elenco nostro: se una fonte non risponde resta l'ultimo catalogo scritto.
export interface CatalogModel {
  id: string;
  // Il nome che gli dà il fornitore, quando dice qualcosa in più dell'id.
  label?: string;
  // false: non ragiona, quindi il livello non si sceglie; assente: non si sa.
  thinking?: boolean;
  // Da dove viene, per i gruppi della tendina: il fornitore di Pi, Gemini, Atlas o ElevenLabs.
  source: string;
}

export interface ModelCatalog {
  chat: CatalogModel[];
  tools: Record<ModelTool, CatalogModel[]>;
}
