import type { AiEngine } from '@moonbrand/shared/api/contract';

import type { Config } from '../../config';
import type { Queryable } from '../../db/pool';

// Il motore AI è dell'account (presenza.accounts.ai_engine): v1 (moonbrand-ai) o v2 (moonbrand-ai-v2). Con v2
// l'onboarding non ha template, font ed esempi, e il brand nuovo non mette in coda il progetto video, che quel motore non
// fa: lo studio lo sa dall'account. AI_ENGINE dice solo con quale motore nascono gli account nuovi.
let forNewAccounts: AiEngine = 'v1';

export function setAiEngine(settings: Pick<Config, 'AI_ENGINE'>): void {
  forNewAccounts = settings.AI_ENGINE;
}

export const newAccountEngine = (): AiEngine => forNewAccounts;

export async function accountEngine(db: Queryable, accountId: string): Promise<AiEngine> {
  const { rows } = await db.query<{ ai_engine: AiEngine }>('select ai_engine from presenza.accounts where id = $1', [accountId]);
  return rows[0]?.ai_engine ?? 'v1';
}
