import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler, withRouterConfig, type NavigationError } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

// Dopo un aggiornamento dello studio, una scheda aperta da prima cerca i pezzi della versione vecchia, che non ci sono
// più (il server risponde con index.html): si ricarica la pagina dove si stava andando, con la versione nuova.
const STALE_CHUNK = /dynamically imported module|Importing a module script failed|ChunkLoadError|MIME type/i;

// Una volta sola ogni minuto: se anche dopo il ricaricamento il pezzo manca, si resta sulla pagina invece di ricaricare
// all'infinito.
const RELOADED_KEY = 'mb.stale-reload';
const RELOAD_GAP_MS = 60_000;

function reloadOnStaleChunk(error: NavigationError): void {
  if (!STALE_CHUNK.test(String((error.error as Error | undefined)?.message ?? error.error))) return;
  try {
    const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
    if (Date.now() - last < RELOAD_GAP_MS) return;
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.assign(error.url);
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
