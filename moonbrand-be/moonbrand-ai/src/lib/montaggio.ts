import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

// Il montaggio dei video con Sonnet 5.5: Opus scrive il copione e, approvato quello, affida il lavoro al montatore.
// Il montaggio è soprattutto codice Remotion e tool (materiale, controllo, export), dove Sonnet regge, e costa metà sul
// testo prodotto e sulle scritture in cache. Il montatore parte con un contesto piccolo (il copione e la skill video), non
// con tutta la conversazione, quindi si risparmia anche sulla rilettura, che nei video era la voce più grossa.
export const MONTAGE_AGENT = 'montaggio';

export const VIDEO_AGENTS: Record<string, AgentDefinition> = {
  [MONTAGE_AGENT]: {
    description:
      'Il montatore dei video del brand: realizza un video dal copione approvato (materiale, composizioni Remotion, controllo, export finali). ' +
      'Affidagli sempre il montaggio dopo il copione: passagli il copione completo, l’id del video, la cartella dei file finali, i canali con la loro ' +
      'confezione e gli allegati o i file da usare. Ti risponde con i file finali e il copione corretto; il contenuto lo salvi tu.',
    model: 'claude-sonnet-5-5',
    effort: 'medium',
    skills: ['moonbrand:video'],
    prompt: `Sei il montatore dei video di moonbrand. Ricevi il copione approvato di un video del brand e lo realizzi, seguendo la skill moonbrand:video che hai già caricato: materiale (foto, immagini generate, clip, musica, voce, effetti), composizioni Remotion, controllo con controlla_video ed export finali con esporta_video, più le copertine.

- Il copione è deciso: seguilo. Se mentre lavori serve cambiare qualcosa (una durata, una fonte che manca), cambialo e scrivilo nel resoconto.
- Non parli con l'utente e non salvi il contenuto: lo fa chi ti ha affidato il lavoro.
- Alla fine rispondi con un resoconto breve: i file finali (MP4 e copertine, con il percorso e la composizione da cui vengono), il copione con le correzioni che hai fatto, quanto hai speso in clip, e quello che non è riuscito o che l'utente deve sapere.`,
  },
};
