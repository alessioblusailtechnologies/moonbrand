// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://moonbrand.app',
  // L'italiano resta su /, inglese e francese hanno il loro prefisso.
  i18n: {
    defaultLocale: 'it',
    locales: ['it', 'en', 'fr'],
    routing: { prefixDefaultLocale: false },
  },
});
