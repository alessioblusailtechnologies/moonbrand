export type Channel = 'instagram' | 'carousel' | 'reel' | 'story' | 'tiktok' | 'facebook' | 'linkedin';

export interface ExamplePost {
  channel: Channel;
  handle: string;
  /** Nome esteso, usato da Facebook e LinkedIn. */
  name: string;
  initials: string;
  color: string;
  /** Riga sotto il nome: luogo su Instagram, follower su LinkedIn. */
  sub?: string;
  /** Proporzione del media, come in aspect-ratio. */
  ratio: string;
  /** Segnaposto finché non c'è la foto: righe diagonali e didascalia. */
  s1: string;
  s2: string;
  ph: string;
  /** Percorso in public/, es. /images/posts/solco-buds.jpg */
  image?: string;
  text: string;
  tone: string;
  likes: string;
  comments: string;
  shares?: string;
  time: string;
  slides?: number;
  audio?: string;
  poll?: [string, string];
}

export const channelLabel: Record<Channel, string> = {
  instagram: 'Instagram · Post',
  carousel: 'Instagram · Carosello',
  reel: 'Instagram · Reel',
  story: 'Instagram · Story',
  tiktok: 'TikTok',
  facebook: 'Facebook · Post',
  linkedin: 'LinkedIn · Post',
};

const solco = { handle: 'solco.tech', name: 'Solco', initials: 'SO', color: '#111111', s1: '#EDEDEB', s2: '#E4E4E1' };
const aurora = { handle: 'pasticceria.aurora', name: 'Pasticceria Aurora', initials: 'PA', color: '#B0644A', s1: '#F6E6D8', s2: '#F0DCCB' };
const forma = { handle: 'formagym', name: 'Forma Gym', initials: 'FG', color: '#2F7A5B', s1: '#E3EFE8', s2: '#D8E8DF' };

export const posts: ExamplePost[] = [
  { ...solco, channel: 'instagram', ratio: '4/5', ph: 'foto · Buds (2)', image: '/images/posts/solco-buds.jpg', text: 'Trasparenti per scelta. Dentro c’è tutto quello che serve, niente di più. Buds (2), dal 14 ottobre.', tone: 'Tono: essenziale, preciso', likes: '4.812', comments: '126', time: '2 ore fa' },
  { ...aurora, channel: 'facebook', ratio: '4/5', ph: 'foto · torta in vetrina', image: '/images/posts/aurora-torta.jpg', text: 'Pere, cioccolato fondente e un filo di cannella. La facciamo come la faceva nonna Aurora, finché dura.', tone: 'Tono: caldo, familiare', likes: '248', comments: '32', shares: '5', time: '3 h' },
  { ...forma, channel: 'carousel', sub: 'Forma Gym · Centro', ratio: '1/1', slides: 5, ph: 'slide · “Alle 7 la città dorme”', image: '/images/posts/forma-slide.jpg', text: 'Nuovo corso alle 7 del mattino. 45 minuti, tutto il corpo, zero attese. Scorri →', tone: 'Tono: energico, asciutto', likes: '392', comments: '21', time: '5 ore fa' },
  { channel: 'reel', handle: 'osteriadelporto', name: 'Osteria del Porto', initials: 'OP', color: '#8A5A5E', ratio: '9/16', s1: '#EFE4E4', s2: '#E7DADA', ph: 'video · pescato del giorno', image: '/images/posts/osteria-pescato.jpg', text: 'Il pescato di oggi l’ha scelto Franco alle sei. Stasera lo trovate crudo, con olio nostro e limone.', tone: 'Tono: schietto, di casa', likes: '3.910', comments: '87', shares: '214', time: '1 g', audio: 'osteriadelporto · Audio originale' },
  { channel: 'linkedin', handle: 'studioriva', name: 'Studio Riva', initials: 'SR', color: '#0B1324', sub: '1.240 follower', ratio: '1.91/1', s1: '#ECECEE', s2: '#E3E4E8', ph: 'grafica · case study', image: '/images/posts/riva-case.jpg', text: 'Dieci clienti, dieci voci diverse. Come teniamo separato il tono di ognuno senza impazzire.', tone: 'Tono: professionale, chiaro', likes: '86', comments: '12', shares: '4', time: '2 g' },
  { channel: 'carousel', handle: 'libreria.nove', name: 'Libreria Nove', initials: 'L9', color: '#C96F10', sub: 'Via Nove, 9', ratio: '4/5', slides: 3, s1: '#F7EAD8', s2: '#F2E0C8', ph: 'foto · pila di libri', image: '/images/posts/libreria-libri.jpg', text: 'Tre libri per chi ha finito le vacanze ma non la voglia di partire. Il terzo è il nostro preferito.', tone: 'Tono: curioso, gentile', likes: '517', comments: '36', time: '1 giorno fa' },
  { ...solco, channel: 'story', ratio: '9/16', ph: 'story · due colori', image: '/images/posts/solco-colori.jpg', text: 'Due colori, una sola scelta. Voi quale prendete?', poll: ['Bianco', 'Nero'], tone: 'Tono: essenziale, curioso', likes: '', comments: '', time: '2 h' },
  { ...aurora, channel: 'instagram', sub: 'Pasticceria Aurora', ratio: '4/5', ph: 'foto · laboratorio all’alba', image: '/images/posts/aurora-laboratorio.jpg', text: 'Alle quattro qui è già tutto acceso. Il profumo arriva prima di noi.', tone: 'Tono: caldo, familiare', likes: '806', comments: '19', time: '1 giorno fa' },
  { ...forma, channel: 'tiktok', ratio: '9/16', ph: 'video · sala pesi', image: '/images/posts/forma-stacco.jpg', text: 'Non ti serve motivazione. Ti serve un orario. Il nostro è alle 7. #palestra #allenamento', tone: 'Tono: energico, asciutto', likes: '12,4K', comments: '318', shares: '1.020', time: '3 g', audio: 'suono originale · formagym' },
];

/** Spazio occupato dall'interfaccia del canale attorno al media, a 330px di larghezza. */
const chrome: Record<Channel, number> = { instagram: 190, carousel: 200, reel: 0, story: 0, tiktok: 0, facebook: 200, linkedin: 230 };

/** Masonry a 3 colonne: ogni post va nella colonna più bassa, stimata da media, interfaccia e testo. */
export function postColumns(list: ExamplePost[], count = 3): ExamplePost[][] {
  const cols: ExamplePost[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const p of list) {
    const [w, h] = p.ratio.split('/').map(Number);
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(p);
    const text = chrome[p.channel] ? p.text.length * 0.55 : 0;
    heights[i] += (h / w) * 330 + chrome[p.channel] + text + 40;
  }
  return cols;
}

export const views = [
  { id: 'cal', label: 'Piano contenuti', title: 'Piano della settimana', action: '+ Nuovo contenuto', side: 'Contenuti' },
  { id: 'idee', label: 'Idee salvate', title: 'Idee', action: 'Chiedi 5 idee', side: 'Idee' },
  { id: 'kit', label: 'Brand kit', title: 'Brand kit · Solco', action: 'Modifica', side: 'Brand kit' },
] as const;

export const sideItems = ['Assistente', 'Idee', 'Contenuti', 'Brand kit'];

export const days = ['Lun 6', 'Mar 7', 'Mer 8', 'Gio 9', 'Ven 10'];

export type CellKind = 'post' | 'car' | 'story' | 'empty';

export const calendar: [string, [CellKind, string][]][] = [
  ['Instagram', [['post', 'Teaser Buds (2)'], ['empty', '—'], ['car', 'Dentro le Buds'], ['post', 'Due colori'], ['post', 'Lancio']]],
  ['Stories', [['story', 'Sondaggio'], ['story', 'Dietro le quinte'], ['empty', '—'], ['story', 'Countdown'], ['story', 'Q&A']]],
  ['LinkedIn', [['post', 'Il team design'], ['empty', '—'], ['car', 'Come nasce'], ['empty', '—'], ['post', 'Lancio']]],
];

export const ideas = [
  { t: 'Unboxing in dieci secondi', m: 'salvata ieri dalla chat' },
  { t: 'Countdown al lancio in 3 post', m: 'salvata 2 giorni fa' },
  { t: 'Dentro le Buds: i componenti uno per uno', m: 'salvata la settimana scorsa' },
  { t: 'Il suono spiegato senza tecnicismi', m: 'salvata la settimana scorsa' },
  { t: 'Una giornata nel laboratorio di design', m: 'suggerita dall’assistente' },
];

export const day = [
  { h: '09:00', t: 'Carichi la foto del prodotto e chiedi un post. In un minuto hai la bozza nel tuo tono.' },
  { h: '09:05', t: 'Chiedi 5 idee per la settimana, ne salvi tre. Il piano è fatto prima del caffè.' },
];

export const inside = [
  { k: 'Tone of voice', v: 'salvato' },
  { k: 'Colori, logo, font', v: 'applicati' },
  { k: 'Storico dei post', v: 'sempre letto' },
  { k: 'Idee', v: 'organizzate' },
  { k: 'Contenuti', v: 'per stato' },
  { k: 'Pubblicazione', v: 'decidi tu' },
];

export const sectors = ['Tech e startup', 'Food e ristorazione', 'Palestra e benessere', 'Negozio', 'Agenzia', 'Altro'];
export const brandCounts = ['1', '2–5', '6–20', 'Più di 20'];

export const footerLinks = ['Piattaforma', 'Per brand tech', 'Per attività locali', 'Per agenzie'];
