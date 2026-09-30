export interface ExamplePost {
  handle: string;
  initials: string;
  color: string;
  sector: string;
  format: string;
  ratio: string;
  s1: string;
  s2: string;
  ph: string;
  text: string;
  tone: string;
}

export const posts: ExamplePost[] = [
  { handle: 'usmarina', initials: 'USM', color: '#1F3A8A', sector: 'Club sportivo', format: 'POST', ratio: '4/5', s1: '#E6EAF3', s2: '#DDE3EF', ph: 'foto · esultanza', text: 'Novanta minuti di corsa, un gol all’ultimo respiro e tutto il Comunale in piedi. Sabato si replica. #ForzaMarina', tone: 'Tono: diretto, orgoglioso' },
  { handle: 'pasticceria.aurora', initials: 'PA', color: '#B0644A', sector: 'Pasticceria', format: 'POST', ratio: '1/1', s1: '#F6E6D8', s2: '#F0DCCB', ph: 'foto · torta in vetrina', text: 'Pere, cioccolato fondente e un filo di cannella. La facciamo come la faceva nonna Aurora, finché dura.', tone: 'Tono: caldo, familiare' },
  { handle: 'formagym', initials: 'FG', color: '#2F7A5B', sector: 'Palestra', format: 'CAROSELLO 1/5', ratio: '1/1', s1: '#E3EFE8', s2: '#D8E8DF', ph: 'slide · “Alle 7 la città dorme”', text: 'Nuovo corso alle 7 del mattino. 45 minuti, tutto il corpo, zero attese. Scorri →', tone: 'Tono: energico, asciutto' },
  { handle: 'osteriadelporto', initials: 'OP', color: '#8A5A5E', sector: 'Ristorante', format: 'REEL', ratio: '3/4', s1: '#EFE4E4', s2: '#E7DADA', ph: 'video · pescato del giorno', text: 'Il pescato di oggi l’ha scelto Franco alle sei. Stasera lo trovate crudo, con olio nostro e limone.', tone: 'Tono: schietto, di casa' },
  { handle: 'studioriva', initials: 'SR', color: '#0B1324', sector: 'Agenzia', format: 'POST', ratio: '16/10', s1: '#ECECEE', s2: '#E3E4E8', ph: 'grafica · case study', text: 'Dieci clienti, dieci voci diverse. Come teniamo separato il tono di ognuno senza impazzire.', tone: 'Tono: professionale, chiaro' },
  { handle: 'libreria.nove', initials: 'L9', color: '#C96F10', sector: 'Libreria', format: 'CAROSELLO 1/3', ratio: '4/5', s1: '#F7EAD8', s2: '#F2E0C8', ph: 'foto · pila di libri', text: 'Tre libri per chi ha finito le vacanze ma non la voglia di partire. Il terzo è il nostro preferito.', tone: 'Tono: curioso, gentile' },
  { handle: 'usmarina', initials: 'USM', color: '#1F3A8A', sector: 'Club sportivo', format: 'STORY', ratio: '3/4', s1: '#E6EAF3', s2: '#DDE3EF', ph: 'story · formazione', text: 'Ecco gli undici di oggi. Voi chi mettereste in campo al posto del 10?', tone: 'Tono: diretto, coinvolgente' },
  { handle: 'pasticceria.aurora', initials: 'PA', color: '#B0644A', sector: 'Pasticceria', format: 'POST', ratio: '4/5', s1: '#F6E6D8', s2: '#F0DCCB', ph: 'foto · laboratorio all’alba', text: 'Alle quattro qui è già tutto acceso. Il profumo arriva prima di noi.', tone: 'Tono: caldo, familiare' },
  { handle: 'formagym', initials: 'FG', color: '#2F7A5B', sector: 'Palestra', format: 'POST', ratio: '1/1', s1: '#E3EFE8', s2: '#D8E8DF', ph: 'foto · sala pesi', text: 'Non ti serve motivazione. Ti serve un orario. Il nostro è alle 7.', tone: 'Tono: energico, asciutto' },
];

/** Masonry a 3 colonne: ogni post va nella colonna più bassa, stimata da formato e lunghezza del testo. */
export function postColumns(list: ExamplePost[], count = 3): ExamplePost[][] {
  const cols: ExamplePost[][] = Array.from({ length: count }, () => []);
  const heights = new Array(count).fill(0);
  for (const p of list) {
    const [w, h] = p.ratio.split('/').map(Number);
    const i = heights.indexOf(Math.min(...heights));
    cols[i].push(p);
    heights[i] += (h / w) * 300 + 110 + p.text.length * 0.6;
  }
  return cols;
}

export const views = [
  { id: 'cal', label: 'Piano contenuti', title: 'Piano della settimana', action: '+ Nuovo contenuto', side: 'Contenuti' },
  { id: 'idee', label: 'Idee salvate', title: 'Idee', action: 'Chiedi 5 idee', side: 'Idee' },
  { id: 'kit', label: 'Brand kit', title: 'Brand kit · US Marina', action: 'Modifica', side: 'Brand kit' },
] as const;

export const sideItems = ['Assistente', 'Idee', 'Contenuti', 'Brand kit'];

export const days = ['Lun 6', 'Mar 7', 'Mer 8', 'Gio 9', 'Ven 10'];

export type CellKind = 'post' | 'car' | 'story' | 'empty';

export const calendar: [string, [CellKind, string][]][] = [
  ['Instagram', [['post', 'Post partita'], ['empty', '—'], ['car', 'Countdown derby'], ['post', 'Capitano'], ['post', 'Pre-gara']]],
  ['Stories', [['story', 'Risultato'], ['story', 'Allenamento'], ['empty', '—'], ['story', 'Sondaggio'], ['story', 'Formazione']]],
  ['Facebook', [['post', 'Post partita'], ['empty', '—'], ['car', 'Maglia nuova'], ['empty', '—'], ['post', 'Biglietti']]],
];

export const ideas = [
  { t: 'Dietro le quinte dello spogliatoio', m: 'salvata ieri dalla chat' },
  { t: 'Countdown al derby in 3 post', m: 'salvata 2 giorni fa' },
  { t: 'Intervista lampo al capitano', m: 'salvata la settimana scorsa' },
  { t: 'Il gol della settimana, votato dai tifosi', m: 'salvata la settimana scorsa' },
  { t: 'Settore giovanile: una giornata con gli Under 12', m: 'suggerita dall’assistente' },
];

export const day = [
  { h: '09:00', t: 'Carichi la foto della partita e chiedi un post. In un minuto hai la bozza nel tuo tono.' },
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

export const sectors = ['Club sportivo', 'Food e ristorazione', 'Palestra e benessere', 'Negozio', 'Agenzia', 'Altro'];
export const brandCounts = ['1', '2–5', '6–20', 'Più di 20'];

export const footerLinks = ['Piattaforma', 'Per club sportivi', 'Per attività locali', 'Per agenzie'];
