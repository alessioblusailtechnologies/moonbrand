// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import { iubendaId } from './src/data/iubenda';
import { LANGS, pagePath } from './src/i18n';

// Fuori dalla sitemap: la 404 e i documenti legali finché su iubenda non sono generati (sono noindex).
const site = 'https://moonbrand.app';
const excluded = LANGS.flatMap((lang) =>
  (/** @type {const} */ (['privacy', 'terms'])).filter((page) => !iubendaId(page, lang)).map((page) => site + pagePath(lang, page)),
);

export default defineConfig({
  site,
  // I file escono come sono scritti: 404.astro diventa 404.html (Cloudflare cerca quella più vicina al percorso),
  // le pagine vanno in una cartella con index.astro, così l'indirizzo finisce con / come in pagePath.
  build: { format: 'preserve' },
  trailingSlash: 'always',
  // L'italiano resta su /, inglese e francese hanno il loro prefisso.
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en', 'fr'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    // Le versioni nelle altre lingue le dice l'hreflang di ogni pagina (gli indirizzi cambiano con la lingua,
    // la sitemap non saprebbe abbinarli); qui solo l'elenco.
    sitemap({ filter: (page) => !/\/404\/?$/.test(page) && !excluded.includes(page) }),
  ],
});
