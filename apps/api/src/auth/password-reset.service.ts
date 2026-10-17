import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { FormReader, rateLimited, type FormInput } from '../forms/form-input.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword } from './password.js';
import { ResetLinkNotifier } from './reset-link-notifier.js';
import { hashSessionToken, newSessionToken } from './session-token.js';

// BACKLOG #27 (issue #36): POST /auth/forgot-password and POST /auth/reset-password.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // one hour
export const FORGOT_LIMIT_PER_CLIENT_PER_HOUR = 5;
export const FORGOT_LIMIT_PER_EMAIL_PER_HOUR = 3;
export const RESET_LIMIT_PER_15_MIN = 10;
const HOUR_MS = 60 * 60 * 1000;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

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
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
    @Inject(ResetLinkNotifier) private readonly notifier: ResetLinkNotifier,
  ) {}

  // Always resolves the same way whether or not the account exists, so the endpoint cannot be used
  // to find out who has an account. The per-e-mail limit counts every request, not just real accounts,
  // for the same reason.
  async requestReset(input: FormInput, clientKey: string): Promise<void> {
    const form = new FormReader(input);
    const email = form.email('email').toLowerCase();
    form.assertValid('Reset request is invalid');

    if (
      !this.limiter.allow(`forgot:${clientKey}`, FORGOT_LIMIT_PER_CLIENT_PER_HOUR, HOUR_MS) ||
      !this.limiter.allow(`forgot-email:${email}`, FORGOT_LIMIT_PER_EMAIL_PER_HOUR, HOUR_MS)
    ) {
      throw rateLimited();
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

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

  async resetPassword(input: FormInput, clientKey: string): Promise<void> {
    if (!this.limiter.allow(`reset:${clientKey}`, RESET_LIMIT_PER_15_MIN, QUARTER_HOUR_MS)) {
      throw rateLimited();
    }

    const form = new FormReader(input);
    const token = form.required('token', 200);
    const password = this.readPassword(input.password, form);
    form.assertValid('Reset data is invalid');

    // Only the hash is stored, so a leaked database cannot be used to reset anyone's password.
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    if (!row || row.usedAt !== null || row.expiresAt.getTime() <= Date.now()) {
      throw resetTokenInvalid();
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
    const base = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/${locale.toLowerCase()}/sifre-sifirla/yeni?token=${encodeURIComponent(token)}`;
  }

  private readPassword(raw: unknown, form: FormReader): string {
    if (raw === undefined || raw === null || raw === '') {
      form.errors.password = 'REQUIRED';
      return '';
    }
    if (typeof raw !== 'string') {
      form.errors.password = 'INVALID_FORMAT';
      return '';
    }
    if (raw.length < PASSWORD_MIN) form.errors.password = 'TOO_SHORT';
    else if (raw.length > PASSWORD_MAX) form.errors.password = 'TOO_LONG';
    return raw;
  }
}