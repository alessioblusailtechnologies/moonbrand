import { Pipe, inject, type PipeTransform } from '@angular/core';

import type { MessageKey, MessageParams } from '@moonbrand/shared/i18n/translate';

import { I18nService } from './i18n.service';

// {{ 'shell.newChat' | t }}: non è pura perché il testo cambia con la lingua anche se la chiave resta la stessa.
// La lingua è un segnale letto dentro il template, quindi anche i componenti OnPush si aggiornano quando cambia.
@Pipe({ name: 't', pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
