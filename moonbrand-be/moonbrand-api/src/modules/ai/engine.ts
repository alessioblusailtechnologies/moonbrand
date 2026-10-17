import type { Config } from '../../config';

// Il motore che prende i job (AI_ENGINE). Con v2 (moonbrand-ai-v2) l'onboarding non ha template, font ed esempi, e il
// brand nuovo non mette in coda il progetto video, che quel motore non fa: lo studio lo sa dall'account.
let v2 = false;

export function setAiEngine(settings: Pick<Config, 'AI_ENGINE'>): void {
  v2 = settings.AI_ENGINE === 'v2';
}

export const isEngineV2 = (): boolean => v2;
