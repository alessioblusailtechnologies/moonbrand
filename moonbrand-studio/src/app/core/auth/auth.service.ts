import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { Account, Me, ResetPasswordRequest, Session, SignInRequest, SignUpRequest } from '@moonbrand/shared/api/contract';
import type { Locale } from '@moonbrand/shared/i18n/locales';

type Status = 'unknown' | 'signed-in' | 'signed-out';

const REFRESH_MARGIN_SECONDS = 60;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private accessToken: string | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshing: Promise<string | null> | null = null;

  readonly status = signal<Status>('unknown');
  readonly account = signal<Account | null>(null);
  readonly activeBrandId = signal<string | null>(null);
  readonly signedIn = computed(() => this.status() === 'signed-in');

  token(): string | null {
    return this.accessToken;
  }

  async restore(): Promise<void> {
    const token = await this.refresh();
    if (!token) return;
    try {
      await this.loadMe();
      this.status.set('signed-in');
    } catch {
      this.clear();
    }
  }

  async signIn(request: SignInRequest): Promise<void> {
    await this.start(await firstValueFrom(this.http.post<Session>('/v1/auth/sign-in', request, { withCredentials: true })));
  }

  async signUp(request: SignUpRequest): Promise<void> {
    await this.start(await firstValueFrom(this.http.post<Session>('/v1/auth/sign-up', request, { withCredentials: true })));
  }

  // L'accesso con Google: la pagina va su /v1/auth/google e torna su /accesso-google con il codice da scambiare.
  startGoogle(): void {
    window.location.assign('/v1/auth/google');
  }

  async signInWithGoogle(code: string, locale: Locale): Promise<void> {
    await this.start(await firstValueFrom(this.http.post<Session>('/v1/auth/google/callback', { code, locale }, { withCredentials: true })));
  }

  // Chi ha perso la password: il link arriva per email e porta a /nuova-password, dove si entra con quella nuova.
  async forgotPassword(email: string): Promise<void> {
    await firstValueFrom(this.http.post('/v1/auth/password/forgot', { email }));
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    await this.start(await firstValueFrom(this.http.post<Session>('/v1/auth/password/reset', request, { withCredentials: true })));
  }

  // Il link dell'email di benvenuto; se è aperto nello studio dove si è già dentro, toglie subito il promemoria.
  async confirmEmail(token: string): Promise<void> {
    await firstValueFrom(this.http.post('/v1/auth/email/confirm', { token }));
    const account = this.account();
    if (account) this.account.set({ ...account, emailConfirmed: true });
  }

  async resendConfirmation(): Promise<void> {
    await firstValueFrom(this.http.post('/v1/auth/email/resend', null));
  }

  async signOut(): Promise<void> {
    await firstValueFrom(this.http.post('/v1/auth/sign-out', null, { withCredentials: true })).catch(() => undefined);
    this.clear();
  }

  refresh(): Promise<string | null> {
    this.refreshing ??= firstValueFrom(
      this.http.post<{ accessToken: string; expiresIn: number }>('/v1/auth/refresh', null, { withCredentials: true }),
    )
      .then(({ accessToken, expiresIn }) => {
        this.setToken(accessToken, expiresIn);
        return accessToken;
      })
      .catch(() => {
        this.clear();
        return null;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  clear(): void {
    clearTimeout(this.refreshTimer);
    this.accessToken = null;
    this.account.set(null);
    this.activeBrandId.set(null);
    this.status.set('signed-out');
  }

  private async start(session: Session): Promise<void> {
    this.setToken(session.accessToken, session.expiresIn);
    this.account.set(session.account);
    await this.loadMe();
    this.status.set('signed-in');
  }

  private async loadMe(): Promise<void> {
    const me = await firstValueFrom(this.http.get<Me>('/v1/me'));
    this.account.set(me.account);
    this.activeBrandId.set(me.activeBrandId);
  }

  private setToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    clearTimeout(this.refreshTimer);
    const delay = Math.max(10, expiresIn - REFRESH_MARGIN_SECONDS) * 1000;
    this.refreshTimer = setTimeout(() => void this.refresh(), delay);
  }
}
