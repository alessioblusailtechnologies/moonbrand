import { defineMessages } from '../define';

// I testi che l'API salva per chi usa l'app, nella lingua del suo account (per esempio i titoli delle conversazioni).
export const server = defineMessages({
  it: {
    conversationFromSlot: 'Uscita di {day} alle {time} su {channels}',
    conversationPhotos: 'Foto allegate',
    // Al posto dell'errore vero di un lavoro AI, che resta nel DB, nel log del worker e nell'admin.
    jobFailed: 'Qualcosa non ha funzionato da parte nostra. Riprova tra poco.',
  },
  en: {
    conversationFromSlot: 'Post on {day} at {time} on {channels}',
    conversationPhotos: 'Attached photos',
    jobFailed: 'Something went wrong on our side. Please try again shortly.',
  },
  fr: {
    conversationFromSlot: 'Publication du {day} à {time} sur {channels}',
    conversationPhotos: 'Photos jointes',
    jobFailed: 'Un problème est survenu de notre côté. Réessayez dans un instant.',
  },
});
