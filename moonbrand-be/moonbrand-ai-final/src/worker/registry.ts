import path from 'node:path';

import type pg from 'pg';

import type { ChatJobInput, ContentEditJobInput, ContentJobInput, ContentVideoJobInput, IdeasJobInput, WebsiteJobRequest, WelcomeJobInput } from '@moonbrand/shared/api/contract';

import { BRANDS_DIR } from '../config/env';
import { saveContent, saveProposal } from '../service/content';
import type { CreditEstimates } from '../service/estimate';
import { saveIdeas } from '../service/ideas';
import { withLogo } from '../service/website';
import { saveWelcome } from '../service/welcome';
import type { Job } from '../repository/jobs';

// Ogni tipo di lavoro è uno script in src/jobs, lanciato dal worker come processo a parte: qui come lanciarlo e, quando il
// risultato va salvato oltre che nel job, come salvarlo.
export interface JobKind {
  launch: (input: unknown, job: Job) => { script: string; args: string[]; env?: Record<string, string> };
  // Completa il risultato prima di salvarlo (per esempio scarica il logo che Claude ha indicato).
  finish?: (result: unknown) => Promise<unknown>;
  // credits: il consumo stimato per formato, misurato dal worker.
  save?: (job: Job, result: unknown, credits: CreditEstimates) => Promise<void>;
  // Il job non ha uno schema: il risultato è la risposta finale di Claude.
  reply?: boolean;
  // false se il job non usa la cartella del brand, che allora non si scarica dallo storage.
  folder?: false;
  // Il job dice il consumo stimato (la chat) o lo scrive nella proposta (content): il worker lo misura prima di lanciarlo.
  credits?: boolean;
}

const brandDirOf = (brandId: string) => path.join(BRANDS_DIR, brandId);

export function createRegistry(pool: pg.Pool): Record<string, JobKind> {
  return {
    // Legge il sito del brand: nome, settore, temi, colori, logo.
    website: { launch: (input) => ({ script: 'src/jobs/website.ts', args: [(input as WebsiteJobRequest).site] }), finish: withLogo, folder: false },
    // Le idee di contenuto, salvate nella sezione Idee.
    ideas: {
      launch: (input) => {
        const { brandId, ...rest } = input as IdeasJobInput;
        return { script: 'src/jobs/ideas.ts', args: [brandDirOf(brandId), JSON.stringify(rest)] };
      },
      save: async (job, result) => {
        const saved = await saveIdeas(pool, job.account_id, job.input as IdeasJobInput, result);
        console.log(`[${job.id}] ${saved} idee salvate`);
      },
    },
    // La proposta di un contenuto (per un video il copione), con il consumo stimato: l'utente la legge e conferma.
    content: {
      launch: (input) => {
        const { brandId, ...rest } = input as ContentJobInput;
        return { script: 'src/jobs/content.ts', args: [brandDirOf(brandId), JSON.stringify(rest)] };
      },
      save: (job, result, credits) => {
        const input = job.input as ContentJobInput;
        return saveProposal(pool, input, result, credits[input.format].typical);
      },
      credits: true,
    },
    // Un ritocco: della proposta (scriptOnly) o del contenuto fatto, nella sessione che l'ha scritto.
    'content-edit': {
      launch: (input) => {
        const { brandId, ...rest } = input as ContentEditJobInput;
        return { script: 'src/jobs/content-edit.ts', args: [brandDirOf(brandId), JSON.stringify(rest)] };
      },
      save: (job, result, credits) => {
        const input = job.input as ContentEditJobInput;
        return input.scriptOnly ? saveProposal(pool, input, result, credits[input.format].typical) : saveContent(pool, BRANDS_DIR, input, result);
      },
      credits: true,
    },
    // Il contenuto dalla proposta confermata: post, carosello, articolo o video (il montaggio).
    'content-video': {
      launch: (input) => {
        const { brandId, ...rest } = input as ContentVideoJobInput;
        return { script: 'src/jobs/content-video.ts', args: [brandDirOf(brandId), JSON.stringify(rest)] };
      },
      save: (job, result) => saveContent(pool, BRANDS_DIR, job.input as ContentVideoJobInput, result),
    },
    // Il progetto Remotion del brand nuovo, pronto prima del primo messaggio in chat.
    'video-setup': { launch: (input) => ({ script: 'src/jobs/video-setup.ts', args: [brandDirOf((input as { brandId: string }).brandId)] }) },
    // La guida di stile letta dai riferimenti non c'è più: Claude guarda le immagini. Il job finisce subito bene, vuoto.
    style: { launch: () => ({ script: 'src/jobs/non-disponibile.ts', args: ['style'] }), folder: false },
    // Gli esempi dell'onboarding non ci sono più.
    visual: { launch: () => ({ script: 'src/jobs/non-disponibile.ts', args: ['visual'] }), folder: false },
    'visual-edit': { launch: () => ({ script: 'src/jobs/non-disponibile.ts', args: ['visual-edit'] }), folder: false },
    // I saluti e gli spunti della chat per un brand: nel prompt c'è già tutto, quindi niente cartella.
    welcome: {
      launch: (input) => {
        const { brandId: _brand, ...rest } = input as WelcomeJobInput;
        return { script: 'src/jobs/welcome.ts', args: [JSON.stringify(rest)] };
      },
      save: (job, result) => saveWelcome(pool, job.id, job.input as WelcomeJobInput, result),
      folder: false,
    },
    // Un turno della chat: il token arriva allo script per variabile d'ambiente, i tool di moonbrand lo usano per l'API.
    chat: {
      launch: (input, job) => {
        const { brandId, ...rest } = input as ChatJobInput;
        return { script: 'src/jobs/chat.ts', args: [brandDirOf(brandId), JSON.stringify(rest)], env: { MOONBRAND_AGENT_TOKEN: job.agent_token ?? '' } };
      },
      reply: true,
      credits: true,
    },
  };
}
