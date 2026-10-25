import { Injectable, Logger } from '@nestjs/common';
import { isProduction } from '../config/runtime.js';

// The one place that delivers a password reset link (BACKLOG #27, #49).
//
// With RESEND_API_KEY and MAIL_FROM set it sends a real e-mail through Resend (https://resend.com).
// Without them: outside production the link goes to the server log, so development works with no mail
// provider; in production nothing is logged (the link is a credential) and only a warning is written.
//
// `send` never throws. A failed delivery is logged and the caller carries on, so the reset endpoint answers
// the same way whether or not the account exists and whether or not the mail provider is up.
export const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 8000;

type Locale = 'TR' | 'EN';
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

const TEXT = {
  TR: {
    subject: 'Novera Mobility: şifreni sıfırla',
    intro: 'Şifreni sıfırlamak için aşağıdaki bağlantıyı aç. Bağlantı 1 saat geçerli ve yalnızca bir kez kullanılır.',
    action: 'Şifreyi sıfırla',
    outro: 'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmez.',
  },
  EN: {
    subject: 'Novera Mobility: reset your password',
    intro: 'Open the link below to reset your password. It is valid for 1 hour and can be used once.',
    action: 'Reset password',
    outro: 'If you did not ask for this, ignore this e-mail; your password stays as it is.',
  },
} as const;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function resetEmail(link: string, locale: Locale): { subject: string; text: string; html: string } {
  const t = TEXT[locale];
  return {
    subject: t.subject,
    text: `${t.intro}\n\n${link}\n\n${t.outro}`,
    html:
      `<p>${escapeHtml(t.intro)}</p>` +
      `<p><a href="${escapeHtml(link)}">${escapeHtml(t.action)}</a></p>` +
      `<p style="color:#666">${escapeHtml(t.outro)}</p>`,
  };
}

@Injectable()
export class ResetLinkNotifier {
  private readonly logger = new Logger('PasswordReset');

  // Replaceable in tests.
  fetcher: Fetcher = (url, init) => fetch(url, init);

  async send(email: string, link: string, locale: Locale = 'TR'): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.MAIL_FROM?.trim();

    if (apiKey && from) {
      await this.deliver(apiKey, from, email, link, locale);
      return;
    }
    // The link is a credential: it is written to the log only when the API is explicitly in development.
    if (isProduction()) {
      this.logger.warn('A reset link was requested but no mail provider is configured (RESEND_API_KEY, MAIL_FROM)');
      return;
    }
    this.logger.log(`Reset link for ${email}: ${link}`);
  }

  private async deliver(apiKey: string, from: string, email: string, link: string, locale: Locale): Promise<void> {
    try {
      const response = await this.fetcher(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], ...resetEmail(link, locale) }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      // Only the status is logged: the answer can repeat the address, and the request holds the link.
      if (!response.ok) this.logger.error(`The mail provider answered ${response.status}; no reset e-mail was sent`);
    } catch (error) {
      this.logger.error(`The reset e-mail could not be sent: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}