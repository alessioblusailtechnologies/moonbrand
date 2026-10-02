import { defineMessages } from '../define';

// I testi che l'API salva per chi usa l'app, nella lingua del suo account (per esempio i titoli delle conversazioni).
export const server = defineMessages({
  it: {
    conversationFromSlot: 'Uscita di {day} alle {time} su {channels}',
    conversationPhotos: 'Foto allegate',
  },
  en: {
    conversationFromSlot: 'Post on {day} at {time} on {channels}',
    conversationPhotos: 'Attached photos',
  },
  fr: {
    conversationFromSlot: 'Publication du {day} à {time} sur {channels}',
    conversationPhotos: 'Photos jointes',
  },
});
