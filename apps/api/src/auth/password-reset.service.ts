import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { webBaseUrl } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_PASSWORD_MIN } from './admin-rules.js';
import { forgotPasswordSchema, resetPasswordSchema } from './auth.schemas.js';
import { hashPassword } from './password.js';
import { ResetLinkNotifier } from './reset-link-notifier.js';
import { hashSessionToken, newSessionToken } from './session-token.js';

// BACKLOG #27 (issue #36): POST /auth/forgot-password and POST /auth/reset-password.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // one hour
// The link of a corporate invitation (V2-33) is valid for seven days.
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function resetTokenInvalid(): HttpException {
  return new HttpException(
    { code: 'RESET_TOKEN_INVALID', message: 'The reset link is invalid, used or expired' },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
}

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ResetLinkNotifier) private readonly notifier: ResetLinkNotifier,
  ) {}

  // Always resolves the same way whether or not the account exists, so the endpoint cannot be used
  // to find out who has an account. The per-e-mail limit counts every request, not just real accounts,
  // for the same reason.
  async requestReset(input: unknown): Promise<void> {
    const { email } = parseInput(forgotPasswordSchema, input, 'Reset request is invalid');

    const user = await this.prisma.user.findUnique({ where: { email } });
    // A closed account (V2-34) gets no link, and the answer is the same as for an address that has no account.

    if (!user || user.disabledAt) return;

    const token = newSessionToken();
    // One live link per account: asking again invalidates the previous one.
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
      this.prisma.passwordResetToken.create({
        data: {
          tokenHash: hashSessionToken(token),
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
          userId: user.id,
        },
      }),
    ]);

    // Not awaited: sending can take seconds, and waiting would make the answer slower for real accounts than
    // for unknown e-mails. The notifier never throws; the catch is only a safety net.
    void this.notifier.send(email, this.linkFor(user.locale, token), user.locale).catch(() => undefined);
  }

  async resetPassword(input: unknown): Promise<void> {
    const { token, password } = parseInput(resetPasswordSchema, input, 'Reset data is invalid');

    // Only the hash is stored, so a leaked database cannot be used to reset anyone's password.
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    if (!row || row.usedAt !== null || row.expiresAt.getTime() <= Date.now()) {
      throw resetTokenInvalid();
    }

    // An administrator's password needs 12 characters (V2-23). Checked before the link is claimed, so a short one does
    // not use the link up.
    const owner = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { role: true, disabledAt: true } });
    if (owner?.disabledAt) throw resetTokenInvalid();
    if (owner?.role === 'ADMIN' && password.length < ADMIN_PASSWORD_MIN) {
      throw validationFailed({ password: 'TOO_SHORT' }, `An administrator's password needs ${ADMIN_PASSWORD_MIN} characters`);
    }

    const passwordHash = await hashPassword(password);

    // Claim the token first: of two simultaneous requests with the same link exactly one gets count 1.
    const claimed = await this.prisma.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) throw resetTokenInvalid();

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
      // Whoever knew the old password (or stole a session) is signed out everywhere.
      this.prisma.session.deleteMany({ where: { userId: row.userId } }),
      this.prisma.passwordResetToken.deleteMany({ where: { userId: row.userId, usedAt: null } }),
    ]);
  }

  private linkFor(locale: 'TR' | 'EN', token: string): string {
    const base = webBaseUrl();
    return `${base}/${locale.toLowerCase()}/sifre-sifirla/yeni?token=${encodeURIComponent(token)}`;
  }
}
