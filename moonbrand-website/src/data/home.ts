// La struttura della home, uguale in ogni lingua: canali, colori, proporzioni, numeri, immagini.
// I testi sono in src/i18n/<lingua>.ts; qui si uniscono con getPosts e simili.
import { getCopy, imagePath, type Lang } from '../i18n';

export type Channel = 'instagram' | 'carousel' | 'reel' | 'story' | 'tiktok' | 'facebook' | 'linkedin';

export type PostId =
  | 'solco-post'
  | 'aurora-torta'
  | 'forma-slide'
  | 'osteria-reel'
  | 'riva-case'
  | 'libreria-slide'
  | 'solco-story'
  | 'aurora-laboratorio'
  | 'forma-tiktok';

interface PostBase {
  id: PostId;
  channel: Channel;
  handle: string;
  /** Nome esteso, usato da Facebook, LinkedIn e TikTok. */
  name: string;
  initials: string;
  color: string;
  /** Proporzione del media, come in aspect-ratio. */
  ratio: string;
  /** Segnaposto se manca l'immagine: righe diagonali nei due colori. */
  s1: string;
  s2: string;
  /** L'immagine in public/images; localized se ha del testo dentro e quindi c'è una versione per lingua. */
  image: string;
  localized: boolean;
  likes?: number;
  comments?: number;
  shares?: number;
  followers?: number;
  slides?: number;
}

export interface ExamplePost extends PostBase {
  imageUrl: string;
  sub?: string;
  ph: string;
  text: string;
  tone: string;
  time: string;
  poll?: string[];
}

const solco = { handle: 'solco.tech', name: 'Solco', initials: 'SO', color: '#111111', s1: '#EDEDEB', s2: '#E4E4E1' };
const aurora = { handle: 'pasticceria.aurora', name: 'Pasticceria Aurora', initials: 'PA', color: '#B0644A', s1: '#F6E6D8', s2: '#F0DCCB' };
const forma = { handle: 'formagym', name: 'Forma Gym', initials: 'FG', color: '#2F7A5B', s1: '#E3EFE8', s2: '#D8E8DF' };

const POSTS: PostBase[] = [
  { ...solco, id: 'solco-post', channel: 'instagram', ratio: '4/5', image: 'posts/solco-buds.jpg', localized: true, likes: 4812, comments: 126 },
  { ...aurora, id: 'aurora-torta', channel: 'facebook', ratio: '4/5', image: 'posts/aurora-torta.jpg', localized: false, likes: 248, comments: 32, shares: 5 },
  { ...forma, id: 'forma-slide', channel: 'carousel', ratio: '1/1', slides: 5, image: 'posts/forma-slide.jpg', localized: true, likes: 392, comments: 21 },
  {
    id: 'osteria-reel',
    channel: 'reel',
    handle: 'osteriadelporto',
    name: 'Osteria del Porto',
    initials: 'OP',
    color: '#8A5A5E',
    ratio: '9/16',
    s1: '#EFE4E4',
    s2: '#E7DADA',
    image: 'posts/osteria-pescato.jpg',
    localized: true,
    likes: 3910,
    comments: 87,
    shares: 214,
  },
  {
    id: 'riva-case',
    channel: 'linkedin',
    handle: 'studioriva',
    name: 'Studio Riva',
    initials: 'SR',
    color: '#0B1324',
    ratio: '1.91/1',
    s1: '#ECECEE',
    s2: '#E3E4E8',
    image: 'posts/riva-case.jpg',
    localized: true,
    likes: 86,
    comments: 12,
    shares: 4,
    followers: 1240,
  },
  {
    id: 'libreria-slide',
    channel: 'carousel',
    handle: 'libreria.nove',
    name: 'Libreria Nove',
    initials: 'L9',
    color: '#C96F10',
    ratio: '4/5',
    slides: 3,
    s1: '#F7EAD8',
    s2: '#F2E0C8',
    image: 'posts/libreria-libri.jpg',
    localized: true,
    likes: 517,
    comments: 36,
  },
  { ...solco, id: 'solco-story', channel: 'story', ratio: '9/16', image: 'posts/solco-colori.jpg', localized: true },
  { ...aurora, id: 'aurora-laboratorio', channel: 'instagram', ratio: '4/5', image: 'posts/aurora-laboratorio.jpg', localized: false, likes: 806, comments: 19 },
  { ...forma, id: 'forma-tiktok', channel: 'tiktok', ratio: '9/16', image: 'posts/forma-stacco.jpg', localized: true, likes: 12400, comments: 318, shares: 1020 },
];

export function getPosts(lang: Lang): ExamplePost[] {
  const copy = getCopy(lang).posts;
  return POSTS.map((post) => ({ ...post, ...copy[post.id], imageUrl: imagePath(lang, post.image, post.localized) }));
}

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

// Moonbrand Studio nella sezione Piattaforma: la struttura delle tre schermate, i testi sono in copy.studio.
export const studioViews = [
  { id: 'chat', nav: 'assistant' },
  { id: 'ideas', nav: 'ideas' },
  { id: 'contents', nav: 'contents' },
] as const;

export const studioNav = [
  { id: 'assistant', icon: 'message-circle' },
  { id: 'ideas', icon: 'lightbulb' },
  { id: 'contents', icon: 'file-text' },
  { id: 'plan', icon: 'calendar' },
] as const;

export const studioChatImage = 'studio/solco-buds.jpg';

/** Il colore del tema di ogni idea, nell'ordine di copy.studio.ideas.items. */
export const studioIdeaColors = ['#E5322D', '#111111', '#98A2B3', '#2F9E6A'];

type ContentFormat = 'post' | 'carousel' | 'video' | 'article';
type ContentStatus = 'approved' | 'draft' | 'preparing';

/** Le card della griglia Contenuti, nell'ordine di copy.studio.contents.items. */
export const studioContents: { cover: string | null; localized: boolean; aspect: string; format: ContentFormat; status: ContentStatus }[] = [
  { cover: 'studio/solco-buds.jpg', localized: true, aspect: '4 / 5', format: 'post', status: 'approved' },
  { cover: 'studio/solco-suono.jpg', localized: true, aspect: '1 / 1', format: 'carousel', status: 'draft' },
  { cover: 'studio/solco-colori.jpg', localized: true, aspect: '9 / 16', format: 'video', status: 'approved' },
  { cover: 'studio/solco-dentro.jpg', localized: true, aspect: '4 / 5', format: 'carousel', status: 'draft' },
  { cover: 'studio/solco-team.jpg', localized: false, aspect: '1 / 1', format: 'article', status: 'approved' },
  { cover: 'studio/solco-countdown.jpg', localized: true, aspect: '4 / 5', format: 'post', status: 'draft' },
  { cover: null, localized: false, aspect: '4 / 5', format: 'video', status: 'preparing' },
];
