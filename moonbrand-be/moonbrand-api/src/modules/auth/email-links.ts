import { createHmac, timingSafeEqual } from 'node:crypto';

const CONFIRM_DAYS = 7;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface EmailLinks {
  confirm(accountId: string, email: string): string;
  // L'account del token di conferma, se la firma torna e non è scaduto; l'email si controlla poi con quella dell'account.
  confirmedAccount(token: string, email: (accountId: string) => Promise<string | null>): Promise<string | null>;
  reset(tokenHash: string): string;
}

// I link delle email, verso le pagine dello studio. La conferma è firmata da noi (si può aprire più volte, non
// cambia niente); la nuova password usa il token monouso di Supabase.
export function emailLinks(studioUrl: string, secret: string): EmailLinks {
  const sign = (accountId: string, email: string, expires: string) =>
    createHmac('sha256', secret).update(`confirm:${accountId}:${email}:${expires}`).digest('base64url');
  const page = (path: string, token: string) => {
    const url = new URL(path, studioUrl);
    url.searchParams.set('token', token);
    return url.toString();
  };

  return {
    confirm(accountId, email) {
      const expires = String(Math.floor(Date.now() / 1000) + CONFIRM_DAYS * 24 * 60 * 60);
      return page('/conferma-email', `${accountId}.${expires}.${sign(accountId, email, expires)}`);
    },
    async confirmedAccount(token, email) {
      const [accountId, expires, signature] = token.split('.');
      if (!accountId || !UUID.test(accountId) || !expires || !signature || Number(expires) * 1000 < Date.now()) return null;
      const address = await email(accountId);
      if (!address) return null;
      const expected = Buffer.from(sign(accountId, address, expires));
      const given = Buffer.from(signature);
      return expected.length === given.length && timingSafeEqual(expected, given) ? accountId : null;
    },
    reset: (tokenHash) => page('/nuova-password', tokenHash),
  };
}
