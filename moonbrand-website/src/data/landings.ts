// Le pagine per tipo di cliente e per funzionalità: quali post di esempio mostrano e in che gruppo stanno.
// I testi sono in copy.landings di ogni lingua, gli indirizzi in PAGES.
import type { Category } from '../i18n';
import type { PostId } from './home';

export const AUDIENCES = ['businesses', 'agencies'] as const;
export const FEATURES = ['assistant', 'plan', 'video', 'publishing', 'brandKit'] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Feature = (typeof FEATURES)[number];
export type Landing = Audience | Feature;

/**
 * I post di esempio di ogni pagina, scelti tra quelli della home. Per le categorie, finché non ci sono post fatti
 * apposta (da un brand di prova nello studio), quelli della home che fanno quel mestiere.
 */
export const LANDING_POSTS: Record<Landing | Category, PostId[]> = {
  businesses: ['aurora-torta', 'osteria-reel', 'libreria-slide'],
  agencies: ['riva-case', 'forma-slide', 'aurora-laboratorio'],
  assistant: ['solco-post', 'aurora-torta', 'forma-slide'],
  plan: ['libreria-slide', 'solco-story', 'aurora-laboratorio'],
  video: ['osteria-reel', 'forma-tiktok', 'solco-story'],
  publishing: ['aurora-torta', 'riva-case', 'forma-tiktok'],
  brandKit: ['solco-post', 'forma-slide', 'aurora-laboratorio'],
  restaurants: ['osteria-reel'],
  bakeries: ['aurora-torta', 'aurora-laboratorio'],
  gyms: ['forma-slide', 'forma-tiktok'],
  shops: ['libreria-slide'],
};

/** Le altre pagine dello stesso gruppo, per i link in fondo. */
export function siblings(page: Landing): Landing[] {
  const group: readonly Landing[] = (AUDIENCES as readonly Landing[]).includes(page) ? AUDIENCES : FEATURES;
  return group.filter((other) => other !== page);
}
