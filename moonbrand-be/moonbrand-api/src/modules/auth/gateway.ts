import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Config } from '../../config';
import { ApiError } from '../../errors';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthGateway {
  createUser(email: string, password: string): Promise<{ id: string } | null>;
  signIn(email: string, password: string): Promise<(Tokens & { userId: string }) | null>;
  refresh(refreshToken: string): Promise<Tokens | null>;
  signOut(accessToken: string): Promise<void>;
  // La nuova password: il token monouso del link (vale un'ora), che poi diventa una sessione per cambiarla.
  recoveryToken(email: string): Promise<string | null>;
  verifyRecovery(tokenHash: string): Promise<(Tokens & { userId: string }) | null>;
  setPassword(accessToken: string, password: string): Promise<void>;
  signOutOthers(accessToken: string): Promise<void>;
  // L'accesso con Google, passando da Supabase (PKCE): l'indirizzo dove mandare il browser, poi il codice che torna.
  googleUrl(redirectTo: string, codeChallenge: string): string;
  exchangeCode(code: string, codeVerifier: string): Promise<(Tokens & { userId: string; profile: OAuthProfile }) | null>;
}

export interface OAuthProfile {
  email: string;
  name: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } };
}

export function supabaseAuthGateway(config: Pick<Config, 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'>): AuthGateway {
  let client: SupabaseClient | undefined;
  const admin = () =>
    (client ??= createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })).auth.admin;

  const session = (data: TokenResponse) => ({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    userId: data.user.id,
  });

  const requestToken = async (grant: 'password' | 'refresh_token' | 'pkce', body: Record<string, string>) => {
    const response = await fetch(new URL(`/auth/v1/token?grant_type=${grant}`, config.SUPABASE_URL), {
      method: 'POST',
      headers: { apikey: config.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (response.status === 429) throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Troppi tentativi: riprova tra qualche minuto.');
    if (response.status >= 500) throw new Error(`Supabase Auth risponde ${response.status}`);
    if (!response.ok) return null;
    const data = (await response.json()) as TokenResponse;
    return { ...session(data), profile: { email: data.user.email ?? '', name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? '' } };
  };

  const logout = async (accessToken: string, scope: 'local' | 'others') => {
    await fetch(new URL(`/auth/v1/logout?scope=${scope}`, config.SUPABASE_URL), {
      method: 'POST',
      headers: { apikey: config.SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}` },
    }).catch(() => undefined);
  };

  return {
    async createUser(email, password) {
      const { data, error } = await admin().createUser({ email, password, email_confirm: true });
      if (!error) return { id: data.user.id };
      if (error.code === 'email_exists' || error.code === 'user_already_exists') return null;
      if (error.code === 'weak_password') throw ApiError.invalid('La password è troppo debole: allungala o aggiungi numeri e simboli.');
      throw error;
    },
    signIn: (email, password) => requestToken('password', { email, password }),
    async refresh(refreshToken) {
      const result = await requestToken('refresh_token', { refresh_token: refreshToken });
      return result && { accessToken: result.accessToken, refreshToken: result.refreshToken, expiresIn: result.expiresIn };
    },
    signOut: (accessToken) => logout(accessToken, 'local'),
    // generateLink non manda niente: il link lo costruiamo noi, verso lo studio, e l'email parte con Resend.
    async recoveryToken(email) {
      const { data, error } = await admin().generateLink({ type: 'recovery', email });
      if (!error) return data.properties.hashed_token;
      if (error.status === 404 || error.code === 'user_not_found') return null;
      throw error;
    },
    async verifyRecovery(tokenHash) {
      const response = await fetch(new URL('/auth/v1/verify', config.SUPABASE_URL), {
        method: 'POST',
        headers: { apikey: config.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'recovery', token_hash: tokenHash }),
      });
      if (response.status === 429) throw new ApiError(429, 'TOO_MANY_REQUESTS', 'Troppi tentativi: riprova tra qualche minuto.');
      if (response.status >= 500) throw new Error(`Supabase Auth risponde ${response.status}`);
      if (!response.ok) return null;
      return session((await response.json()) as TokenResponse);
    },
    async setPassword(accessToken, password) {
      const response = await fetch(new URL('/auth/v1/user', config.SUPABASE_URL), {
        method: 'PUT',
        headers: { apikey: config.SUPABASE_ANON_KEY, authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (response.ok) return;
      const body = (await response.json().catch(() => ({}))) as { error_code?: string; code?: string };
      const code = body.error_code ?? body.code;
      if (code === 'same_password') throw ApiError.invalid('È la password di prima: scegline una nuova.');
      if (code === 'weak_password') throw ApiError.invalid('La password è troppo debole: allungala o aggiungi numeri e simboli.');
      throw new Error(`Supabase Auth risponde ${response.status} al cambio password`);
    },
    signOutOthers: (accessToken) => logout(accessToken, 'others'),
    googleUrl(redirectTo, codeChallenge) {
      const url = new URL('/auth/v1/authorize', config.SUPABASE_URL);
      url.searchParams.set('provider', 'google');
      url.searchParams.set('redirect_to', redirectTo);
      url.searchParams.set('code_challenge', codeChallenge);
      url.searchParams.set('code_challenge_method', 's256');
      return url.toString();
    },
    exchangeCode: (code, codeVerifier) => requestToken('pkce', { auth_code: code, code_verifier: codeVerifier }),
  };
}
