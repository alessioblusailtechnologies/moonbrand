import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { CreditsService } from '../credits/credits.service';

// Un lavoro rifiutato perché il brand non ha un piano attivo o ha finito i crediti (402): si rileggono i crediti, così
// compare subito il banner per attivare il piano o ricaricare. L'errore prosegue verso chi ha fatto la richiesta.
export const billingInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 402) void injector.get(CreditsService).refresh();
      return throwError(() => error);
    }),
  );
};
