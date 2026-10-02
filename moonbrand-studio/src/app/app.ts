import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { I18nService } from './core/i18n/i18n.service';
import { Confirm } from './ui/confirm';
import { Lightbox } from './ui/lightbox';
import { Toasts } from './ui/toast';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, Confirm, Lightbox, Toasts],
  template: `
    <router-outlet />
    <mb-lightbox />
    <mb-confirm />
    <mb-toasts />
  `,
})
export class App {
  // Creato subito: tiene la lingua della pagina (html lang) allineata a quella dell'interfaccia.
  protected readonly i18n = inject(I18nService);
}
