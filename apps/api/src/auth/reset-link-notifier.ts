import { Injectable, Logger } from '@nestjs/common';

// The one place that delivers a password reset link. v1 has no mail provider (BACKLOG #27), so the
// link goes to the server log. When real e-mail is wired in (BACKLOG #49) only this class changes.
@Injectable()
export class ResetLinkNotifier {
  private readonly logger = new Logger('PasswordReset');

  async send(email: string, link: string): Promise<void> {
    // The link is a credential: in production it is never written to the log.
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('A reset link was requested but no mail provider is configured');
      return;
    }
    this.logger.log(`Reset link for ${email}: ${link}`);
  }
}
