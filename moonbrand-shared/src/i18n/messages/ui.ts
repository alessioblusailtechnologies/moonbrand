import { defineMessages } from '../define';

// I componenti comuni dello studio (conferme, anteprime, passaggi, avvisi).
export const ui = defineMessages({
  it: {
    lightbox: {
      label: 'Immagine ingrandita',
      previous: 'Immagine precedente',
      next: 'Immagine successiva',
    },
    steps: {
      thinking: 'Ci penso',
      count: '{n, plural, one {# passaggio} other {# passaggi}}',
    },
    pendingMedia: {
      video: 'Preparo il video',
      images: 'Preparo {n} immagini',
      card: 'Preparo la card',
      status: '{n, plural, one {Sto preparando una card} other {Sto preparando # card}}',
    },
    brandAvatar: {
      logoOf: 'Logo di {name}',
    },
  },
  en: {
    lightbox: {
      label: 'Enlarged image',
      previous: 'Previous image',
      next: 'Next image',
    },
    steps: {
      thinking: 'Thinking',
      count: '{n, plural, one {# step} other {# steps}}',
    },
    pendingMedia: {
      video: 'Preparing the video',
      images: 'Preparing {n} images',
      card: 'Preparing the card',
      status: '{n, plural, one {Preparing one card} other {Preparing # cards}}',
    },
    brandAvatar: {
      logoOf: '{name} logo',
    },
  },
  fr: {
    lightbox: {
      label: 'Image agrandie',
      previous: 'Image précédente',
      next: 'Image suivante',
    },
    steps: {
      thinking: 'J’y réfléchis',
      count: '{n, plural, one {# étape} other {# étapes}}',
    },
    pendingMedia: {
      video: 'Je prépare la vidéo',
      images: 'Je prépare {n} images',
      card: 'Je prépare le visuel',
      status: '{n, plural, one {Je prépare un visuel} other {Je prépare # visuels}}',
    },
    brandAvatar: {
      logoOf: 'Logo de {name}',
    },
  },
});
