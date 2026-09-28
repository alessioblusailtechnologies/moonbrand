import type { Routes } from '@angular/router';

import { authGuard, guestGuard, hasBrandsGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  { path: 'register', canActivate: [guestGuard], loadComponent: () => import('./features/auth/register').then((m) => m.Register) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        // Le idee sono la prima sezione; l'onboarding è una modale sopra, con l'app visibile sotto.
        path: '',
        loadComponent: () => import('./features/ideas/ideas-page').then((m) => m.IdeasPage),
        children: [
          { path: '', canActivate: [hasBrandsGuard], children: [] },
          { path: 'onboarding', loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding) },
        ],
      },
      {
        path: 'contenuti',
        canActivate: [hasBrandsGuard],
        loadComponent: () => import('./features/contents/contents-page').then((m) => m.ContentsPage),
      },
      {
        path: 'contenuti/:contentId',
        canActivate: [hasBrandsGuard],
        loadComponent: () => import('./features/contents/content-page').then((m) => m.ContentPage),
      },
      {
        path: 'impostazioni',
        canActivate: [hasBrandsGuard],
        loadComponent: () => import('./features/profile/profile-page').then((m) => m.ProfilePage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
