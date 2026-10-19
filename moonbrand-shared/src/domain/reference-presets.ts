import type { BrandCategory, MediaFile } from './brand';

// Stili pronti da scegliere come immagini di riferimento, in alternativa a quelle caricate: ognuno è una griglia di post
// fatti da noi (studio, public/riferimenti/<id>.jpg). Scelto, diventa un riferimento come gli altri, nella cartella del brand
// con il nome stile-<id>.

export interface ReferencePreset {
  id: string;
  category: BrandCategory;
  // Il nome dello stile, uguale in ogni lingua.
  name: string;
}

export const REFERENCE_PRESETS: ReferencePreset[] = [
  { id: 'salone-greige', category: 'bellezza', name: 'Greige' },
  { id: 'salone-blush', category: 'bellezza', name: 'Blush' },
  { id: 'salone-full-frame', category: 'bellezza', name: 'Full frame' },
  { id: 'salone-diario', category: 'bellezza', name: 'Diario' },
];

export const PRESET_ID = /^[a-z0-9-]+$/;

export function presetsFor(category: BrandCategory | null | undefined): ReferencePreset[] {
  return category ? REFERENCE_PRESETS.filter((preset) => preset.category === category) : [];
}

export function presetImage(preset: ReferencePreset): string {
  return `riferimenti/${preset.id}.jpg`;
}

// Lo stile da cui viene un riferimento, dal nome del file; null se l'ha caricato l'utente.
export function presetOf(file: MediaFile): string | null {
  return /(?:^|\/)stile-([a-z0-9-]+)\.[a-z]+$/.exec(file.path ?? '')?.[1] ?? null;
}
