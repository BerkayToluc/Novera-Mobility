import { Injectable, Logger } from '@nestjs/common';
import { mailFrom, resendApiKey } from '../config/env.js';
import { isProduction } from '../config/runtime.js';

// The one place that delivers a password link (BACKLOG #27, #49): a reset link, and since V2-33 the invitation of a person to a
// corporate account, which is the same kind of link with another text and a longer life.
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

// The invitation of a person to their company's corporate account (V2-33, ADMIN.md §3.3): who opened it and for which company, the
// link, and how long it lives. It is sent only by an administrator's action, never on a stranger's request.
const INVITE_TEXT = {
  TR: {
    subject: 'Novera Mobility: kurumsal hesabın hazır',
    intro: (name: string, company: string) =>
      `Merhaba ${name}, ${company} için Novera Mobility kurumsal hesabın açıldı. Şifreni belirlemek için aşağıdaki bağlantıyı aç. Bağlantı 7 gün geçerli ve yalnızca bir kez kullanılır.`,
    action: 'Şifremi belirle',
    outro: 'Bu daveti beklemiyorsan bu e-postayı yok sayabilirsin; şifre belirlenmeden hesap kullanılamaz. Süre dolarsa Novera ekibinden yeni bir davet isteyebilirsin.',
  },
  EN: {
    subject: 'Novera Mobility: your corporate account is ready',
    intro: (name: string, company: string) =>
      `Hello ${name}, a Novera Mobility corporate account was opened for you at ${company}. Open the link below to set your password. It is valid for 7 days and can be used once.`,
    action: 'Set my password',
    outro: 'If you were not expecting this invitation you can ignore this e-mail; the account cannot be used until a password is set. If the link runs out, ask the Novera team for a new invitation.',
  },
} as const;

export type Invite = { company: string; name: string };

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function resetEmail(link: string, locale: Locale, invite?: Invite): { subject: string; text: string; html: string } {
  if (invite) {
    const i = INVITE_TEXT[locale];
    const intro = i.intro(invite.name, invite.company);
    return {
      subject: i.subject,
      text: `${intro}\n\n${link}\n\n${i.outro}`,
      html:
        `<p>${escapeHtml(intro)}</p>` +
        `<p><a href="${escapeHtml(link)}">${escapeHtml(i.action)}</a></p>` +
        `<p style="color:#666">${escapeHtml(i.outro)}</p>`,
    };
  }
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

  // With `invite` the e-mail is the invitation of a corporate account (V2-33); without it, a reset link.
  async send(email: string, link: string, locale: Locale = 'TR', invite?: Invite): Promise<void> {
    const apiKey = resendApiKey();
    const from = mailFrom();

    if (apiKey && from) {
      await this.deliver(apiKey, from, email, link, locale, invite);
      return;
    }
    // The link is a credential: it is written to the log only when the API is explicitly in development.
    if (isProduction()) {
      this.logger.warn(`${invite ? 'An invitation' : 'A reset link'} was due but no mail provider is configured (RESEND_API_KEY, MAIL_FROM)`);
      return;
    }
    this.logger.log(`${invite ? 'Invitation link' : 'Reset link'} for ${email}: ${link}`);
  }

  private async deliver(apiKey: string, from: string, email: string, link: string, locale: Locale, invite?: Invite): Promise<void> {
    try {
      const response = await this.fetcher(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], ...resetEmail(link, locale, invite) }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      // Only the status is logged: the answer can repeat the address, and the request holds the link.
      if (!response.ok) this.logger.error(`The mail provider answered ${response.status}; no ${invite ? 'invitation' : 'reset'} e-mail was sent`);
    } catch (error) {
      this.logger.error(`The ${invite ? 'invitation' : 'reset'} e-mail could not be sent: ${error instanceof Error ? error.name : 'unknown error'}`);
    }
  }
}
