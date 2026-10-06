import type { FastifyBaseLogger } from 'fastify';

import type { Config } from '../../config';

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail, log: FastifyBaseLogger): Promise<void>;
}

const RESEND_URL = 'https://api.resend.com/emails';

// Le email con Resend. Senza chiave (in sviluppo) non parte niente: il testo, con il link, va nel log.
export function resendMailer(config: Pick<Config, 'RESEND_API_KEY' | 'EMAIL_FROM'>): Mailer {
  const key = config.RESEND_API_KEY;
  if (!key) {
    return {
      async send(mail, log) {
        log.info({ to: mail.to, subject: mail.subject }, `email non mandata (manca RESEND_API_KEY):\n${mail.text}`);
      },
    };
  }
  return {
    async send(mail) {
      const response = await fetch(RESEND_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: config.EMAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      });
      if (!response.ok) throw new Error(`Resend risponde ${response.status}: ${await response.text().catch(() => '')}`);
    },
  };
}
