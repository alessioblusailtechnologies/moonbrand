import { defineMessages } from '../define';

// L'annuncio delle novità (LATEST_NEWS in api/contract.ts), nella modale dello studio: per un rilascio nuovo si
// riscrivono questi testi e si cambia il codice.
export const news = defineMessages({
  it: {
    label: 'Novità',
    title: 'Cosa c’è di nuovo',
    music: {
      title: 'Musica su misura',
      body: 'Per i tuoi video l’assistente compone basi strumentali e canzoni pensate apposta, sempre in due versioni tra cui scegliere.',
    },
    edits: {
      title: 'Ritocchi più rapidi',
      body: 'Chiedere una modifica a un video è più veloce e consuma meno crediti di prima.',
    },
    ok: 'Ho capito',
    close: 'Chiudi',
  },
  en: {
    label: 'What’s new',
    title: 'What’s new',
    music: {
      title: 'Music made to measure',
      body: 'For your videos the assistant composes instrumental tracks and songs written for them, always in two versions to choose from.',
    },
    edits: {
      title: 'Faster edits',
      body: 'Asking for a change to a video is quicker and uses fewer credits than before.',
    },
    ok: 'Got it',
    close: 'Close',
  },
  fr: {
    label: 'Nouveautés',
    title: 'Quoi de neuf',
    music: {
      title: 'Une musique sur mesure',
      body: 'Pour vos vidéos, l’assistant compose des musiques instrumentales et des chansons pensées pour elles, toujours en deux versions au choix.',
    },
    edits: {
      title: 'Des retouches plus rapides',
      body: 'Demander une modification sur une vidéo est plus rapide et consomme moins de crédits qu’avant.',
    },
    ok: 'J’ai compris',
    close: 'Fermer',
  },
});
