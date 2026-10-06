// @ts-check
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://moonbrand.app',
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
    // La sitemap lega ogni pagina alle sue versioni nelle altre lingue; la 404 resta fuori.
    sitemap({
      filter: (page) => !/\/404\/?$/.test(page),
      i18n: { defaultLocale: 'it', locales: { it: 'it', en: 'en', fr: 'fr' } },
    }),
  ],
});
