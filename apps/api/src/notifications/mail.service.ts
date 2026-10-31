import { Injectable, Logger } from '@nestjs/common';
import { mailFrom, resendApiKey } from '../config/env.js';
import { RESEND_URL } from '../auth/reset-link-notifier.js';
import type { Mail } from './email-templates.js';

const SEND_TIMEOUT_MS = 8000;
type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// The one sender of the e-mails that are not a password link (V2-44): the same Resend service and the same two settings as
// `ResetLinkNotifier` (RESEND_API_KEY, MAIL_FROM), written the same way. `send` never throws and never logs an address: a failed or
// disabled delivery is a line in the log and the caller carries on, so no flow of the site depends on the mail provider being up.
// Without the settings nothing is sent (development, tests, a site that has not set them yet).
@Injectable()
export class MailService {
  private readonly logger = new Logger('Mail');

  // Replaceable in tests.
  fetcher: Fetcher = (url, init) => fetch(url, init);

  // Whether a delivery can be tried at all; the callers use it to skip the work of building an e-mail nobody can send.
  get enabled(): boolean {
    return Boolean(resendApiKey() && mailFrom());
  }

  // `kind` is a word for the log ("booking-confirmed"), never a part of the message.
  async send(to: string, mail: Mail, kind: string): Promise<boolean> {
    const apiKey = resendApiKey();
    const from = mailFrom();
    if (!apiKey || !from) {
      this.logger.debug(`${kind}: no mail provider is configured (RESEND_API_KEY, MAIL_FROM); nothing sent`);
      return false;
    }
    try {
      const response = await this.fetcher(RESEND_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject: mail.subject, text: mail.text, html: mail.html }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      // Only the status: the answer can repeat the address.
      if (!response.ok) {
        this.logger.error(`${kind}: the mail provider answered ${response.status}; no e-mail was sent`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(`${kind}: the e-mail could not be sent: ${error instanceof Error ? error.name : 'unknown error'}`);
      return false;
    }
  }
}
