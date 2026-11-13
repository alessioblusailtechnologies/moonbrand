// Le voci del brand per la voce fuori campo, fatte con ElevenLabs: clonate da un audio dell'utente o scelte dalla
// libreria pubblica. La chat usa la predefinita quando non le si chiede un'altra voce.

// Quante voci può avere un brand, clonate e della libreria insieme.
export const BRAND_VOICES_MAX = 3;

// Quanto parlato serve per clonare una voce, in secondi: sotto non somiglia; oltre il massimo ElevenLabs non migliora.
export const VOICE_SAMPLE_MIN_SECONDS = 20;
export const VOICE_SAMPLE_MAX_SECONDS = 300;

export type BrandVoiceKind = 'clone' | 'library';

export interface BrandVoice {
  id: string;
  kind: BrandVoiceKind;
  name: string;
  // L'id della voce in ElevenLabs, quello che usa il tool della voce.
  voiceId: string;
  // L'ascolto: il campione caricato per una voce clonata, quello di ElevenLabs per una della libreria.
  previewUrl: string | null;
  language: string | null;
  description: string | null;
  isDefault: boolean;
  createdAt: string;
}

// Una voce della libreria pubblica di ElevenLabs, da cercare e aggiungere al brand.
export interface LibraryVoice {
  voiceId: string;
  name: string;
  language: string | null;
  gender: string | null;
  accent: string | null;
  description: string | null;
  previewUrl: string | null;
}
