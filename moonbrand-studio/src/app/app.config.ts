import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler, withRouterConfig, type NavigationError } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

// Dopo un aggiornamento dello studio, una scheda aperta da prima cerca i pezzi della versione vecchia, che non ci sono
// più (il server risponde con index.html): si ricarica la pagina dove si stava andando, con la versione nuova.
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|ChunkLoadError|MIME type/i;

function reloadOnStaleChunk(error: NavigationError): void {
  if (STALE_CHUNK.test(String((error.error as Error | undefined)?.message ?? error.error))) window.location.assign(error.url);
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // Una navigazione che non riesce non fa fallire chi l'ha chiesta (per esempio la registrazione appena riuscita).
    provideRouter(
      routes,
      withComponentInputBinding(),
      withNavigationErrorHandler(reloadOnStaleChunk),
      withRouterConfig({ resolveNavigationPromiseOnError: true }),
    ),
    provideAppInitializer(() => inject(AuthService).restore()),
  ],
};
