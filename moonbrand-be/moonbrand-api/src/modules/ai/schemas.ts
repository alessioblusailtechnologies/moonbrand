import { z } from 'zod';

import type { WebsiteJobRequest } from '@moonbrand/shared/api/contract';

export const websiteJobSchema = z.object({
  site: z.string().trim().min(3, 'Scrivi l’indirizzo del sito.').max(300),
}) satisfies z.ZodType<WebsiteJobRequest>;

export const jobParamsSchema = z.object({ id: z.uuid('Lavoro non trovato.') });
