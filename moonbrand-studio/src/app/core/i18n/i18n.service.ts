import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Me, UpdateMeRequest } from '@moonbrand/shared/api/contract';
import { DEFAULT_LOCALE, INTL_LOCALES, matchLocale, type Locale } from '@moonbrand/shared/i18n/locales';
import { translate, type MessageKey, type MessageParams } from '@moonbrand/shared/i18n/translate';

import { AuthService } from '../auth/auth.service';
import { setCurrentLocale } from './current-locale';

const LOCALE_KEY = 'mb.locale';

// La lingua dell'interfaccia. Con l'account aperto è quella dell'account; prima dell'accesso quella scelta l'ultima volta
// su questo browser, o quella del browser se è tra le nostre. Cambia senza ricaricare: chi la legge (la pipe t, intl) è un segnale.
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly chosen = signal<Locale>(readLocale());

  readonly locale = computed(() => this.auth.account()?.locale ?? this.chosen());
  // Per Intl: date, orari e numeri nel formato della lingua.
  readonly intl = computed(() => INTL_LOCALES[this.locale()]);

  constructor() {
    effect(() => {
      document.documentElement.lang = this.locale();
      setCurrentLocale(this.locale());
    });
    // La lingua dell'account resta su questo browser: dopo l'uscita la pagina di accesso è ancora nella stessa lingua.
    effect(() => {
      const locale = this.auth.account()?.locale;
      if (!locale) return;
      this.chosen.set(locale);
      storeLocale(locale);
    });
  }

  t(key: MessageKey, params?: MessageParams): string {
    return translate(this.locale(), key, params);
  }

  // Si vede subito; con l'account aperto si salva anche sull'account, e se il salvataggio non riesce si torna indietro.
  async use(locale: Locale): Promise<void> {
    const account = this.auth.account();
    this.chosen.set(locale);
    storeLocale(locale);
    if (!account || account.locale === locale) return;
    this.auth.account.set({ ...account, locale });
    try {
      const request: UpdateMeRequest = { locale };
      const me = await firstValueFrom(this.http.patch<Me>('/v1/me', request));
      this.auth.account.set(me.account);
    } catch (error) {
      this.auth.account.set(account);
      throw error;
    }
  }
}

function readLocale(): Locale {
  try {
    const stored = matchLocale(localStorage.getItem(LOCALE_KEY));
    if (stored) return stored;
  } catch {
    // Senza storage si guarda solo il browser.
  }
  return navigator.languages.map(matchLocale).find((locale) => locale !== null) ?? DEFAULT_LOCALE;
}

function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Senza storage la scelta vale finché la pagina resta aperta.
  }
}
