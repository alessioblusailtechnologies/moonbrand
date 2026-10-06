import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { BrandsService } from '../brands/brands.service';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.signedIn() || inject(Router).createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return !auth.signedIn() || inject(Router).createUrlTree(['/']);
};

// Lo studio si apre solo con l'email confermata: prima c'è la schermata che chiede di aprire il link.
export const confirmedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.account()?.emailConfirmed !== false || inject(Router).createUrlTree(['/verifica-email']);
};

export const unconfirmedGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.signedIn()) return inject(Router).createUrlTree(['/login']);
  return auth.account()?.emailConfirmed === false || inject(Router).createUrlTree(['/']);
};

// inject() solo prima dell'await: dopo non c'è più il contesto, e il Router chiesto lì fa fallire la navigazione
// (pagina bianca per chi non ha ancora brand).
export const hasBrandsGuard: CanActivateFn = async () => {
  const brands = inject(BrandsService);
  const router = inject(Router);
  await brands.ensureLoaded();
  return brands.brands().length > 0 || router.createUrlTree(['/onboarding']);
};
