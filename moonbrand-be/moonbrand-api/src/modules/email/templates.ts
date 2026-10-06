import type { Locale } from '@moonbrand/shared/i18n/locales';
import { translate } from '@moonbrand/shared/i18n/translate';

import type { Mail } from './mailer';

type Content = Omit<Mail, 'to'>;

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);

// Una colonna, i colori dello studio (blu notte e arancio), stili in linea: quello che i client di posta leggono tutti.
function layout(locale: Locale, parts: { subject: string; title: string; paragraphs: string[]; button: string; url: string; after?: string }): Content {
  const paragraph = (text: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475467">${escape(text)}</p>`;
  const footer = translate(locale, 'email.footer');
  const hint = translate(locale, 'email.linkHint');
  const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(parts.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1efea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1efea;padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="background:#0b1324;border-radius:16px 16px 0 0;padding:24px 32px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#ffffff">Moonbrand</td></tr>
<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:32px">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0b1324">${escape(parts.title)}</h1>
${parts.paragraphs.map(paragraph).join('\n')}
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:12px;background:#f29a2e">
<a href="${escape(parts.url)}" style="display:inline-block;padding:14px 24px;font-size:15px;font-weight:600;color:#0b1324;text-decoration:none">${escape(parts.button)}</a>
</td></tr></table>
${parts.after ? paragraph(parts.after) : ''}
<p style="margin:0;font-size:12px;line-height:1.5;color:#98a2b3">${escape(hint)}<br><a href="${escape(parts.url)}" style="color:#98a2b3;word-break:break-all">${escape(parts.url)}</a></p>
</td></tr>
<tr><td style="padding:20px 32px;font-size:12px;line-height:1.5;color:#98a2b3;text-align:center">${escape(footer)}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  const text = [parts.title, '', ...parts.paragraphs.flatMap((line) => [line, '']), `${parts.button}: ${parts.url}`, '', ...(parts.after ? [parts.after, ''] : []), footer].join('\n');
  return { subject: parts.subject, html, text };
}

// Il benvenuto, con dentro il link di conferma: un'email sola alla registrazione.
export function welcomeEmail(locale: Locale, name: string, url: string): Content {
  return layout(locale, {
    subject: translate(locale, 'email.welcome.subject'),
    title: translate(locale, 'email.welcome.title', { name }),
    paragraphs: [translate(locale, 'email.welcome.body'), translate(locale, 'email.welcome.confirm')],
    button: translate(locale, 'email.welcome.button'),
    url,
  });
}

export function confirmEmail(locale: Locale, name: string, url: string): Content {
  return layout(locale, {
    subject: translate(locale, 'email.confirm.subject'),
    title: translate(locale, 'email.confirm.title'),
    paragraphs: [translate(locale, 'email.confirm.body', { name })],
    button: translate(locale, 'email.confirm.button'),
    url,
  });
}

// Un social del brand ha chiuso l'accesso (avviso dal webhook di Zernio): i post lì aspettano che si ricolleghi.
export function channelLostEmail(locale: Locale, name: string, channel: string, brand: string, url: string): Content {
  return layout(locale, {
    subject: translate(locale, 'email.channelLost.subject', { channel, brand }),
    title: translate(locale, 'email.channelLost.title', { channel }),
    paragraphs: [translate(locale, 'email.channelLost.body', { name, channel, brand }), translate(locale, 'email.channelLost.why', { channel })],
    button: translate(locale, 'email.channelLost.button', { channel }),
    url,
  });
}

export function resetEmail(locale: Locale, name: string, url: string): Content {
  return layout(locale, {
    subject: translate(locale, 'email.reset.subject'),
    title: translate(locale, 'email.reset.title'),
    paragraphs: [translate(locale, 'email.reset.body', { name })],
    button: translate(locale, 'email.reset.button'),
    url,
    after: translate(locale, 'email.reset.ignore'),
  });
}
