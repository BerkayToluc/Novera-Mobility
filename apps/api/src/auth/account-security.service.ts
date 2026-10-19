import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { FormReader, rateLimited, validationFailed, type FormInput } from '../forms/form-input.js';
import { RateLimiter } from '../forms/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { passwordNotSet } from './auth.errors.js';
import { describeDevice } from './device.js';
import { hashPassword, verifyPassword } from './password.js';
import type { UserRow } from './user-view.js';

// BACKLOG Y71: password change and open sessions for the signed-in account (SPEC §2.9, Ayarlar > Güvenlik).
export const CHANGE_PASSWORD_LIMIT_PER_15_MIN = 5;
const QUARTER_HOUR_MS = 15 * 60 * 1000;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

export interface SessionView {
  id: string;
  current: boolean;
  device: string | null;
  createdAt: string;
  expiresAt: string;
}

function sessionNotFound(): HttpException {
  return new HttpException({ code: 'NOT_FOUND', message: 'Session not found' }, HttpStatus.NOT_FOUND);
}

@Injectable()
export class AccountSecurityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RateLimiter) private readonly limiter: RateLimiter,
  ) {}

  // POST /me/password. A wrong current password is a 422 on that field (not 401: the person is still
  // signed in). On success every OTHER session ends, so a stolen cookie stops working; this one stays.
  async changePassword(user: UserRow, currentTokenHash: string | null, input: FormInput): Promise<void> {
    if (!this.limiter.allow(`change-password:${user.id}`, CHANGE_PASSWORD_LIMIT_PER_15_MIN, QUARTER_HOUR_MS)) {
      throw rateLimited();
    }

    if (user.passwordHash === null) throw passwordNotSet();

    const form = new FormReader(input);
    const current = input.currentPassword;
    const next = input.newPassword;
    if (current === undefined || current === null || current === '') form.errors.currentPassword = 'REQUIRED';
    else if (typeof current !== 'string') form.errors.currentPassword = 'INVALID_FORMAT';
    else if (current.length > PASSWORD_MAX) form.errors.currentPassword = 'TOO_LONG';

    if (next === undefined || next === null || next === '') form.errors.newPassword = 'REQUIRED';
    else if (typeof next !== 'string') form.errors.newPassword = 'INVALID_FORMAT';
    else if (next.length < PASSWORD_MIN) form.errors.newPassword = 'TOO_SHORT';
    else if (next.length > PASSWORD_MAX) form.errors.newPassword = 'TOO_LONG';
    form.assertValid('Password change data is invalid');

    const currentPassword = current as string;
    const newPassword = next as string;
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw validationFailed({ currentPassword: 'INCORRECT' }, 'The current password is wrong');
    }
    if (newPassword === currentPassword) {
      throw validationFailed({ newPassword: 'SAME_AS_CURRENT' }, 'The new password must differ from the current one');
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      this.prisma.session.deleteMany({
        where: { userId: user.id, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
      }),
      // A reset link asked for earlier must not work after the password was changed.
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    ]);
  }

  // GET /me/sessions: the open sessions of the account, newest first; the one asking is marked `current`.
  async listSessions(userId: string, currentTokenHash: string | null, now: Date = new Date()): Promise<SessionView[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tokenHash: true, userAgent: true, createdAt: true, expiresAt: true },
    });
    return rows.map((row) => ({
      id: row.id,
      current: currentTokenHash !== null && row.tokenHash === currentTokenHash,
      device: describeDevice(row.userAgent),
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    }));
  }

  // DELETE /me/sessions: "close the other sessions". The current one stays open.
  async revokeOthers(userId: string, currentTokenHash: string | null): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId, ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}) },
    });
  }

  // DELETE /me/sessions/{id}: closes one session of this account (someone else's or unknown: 404).
  // Returns true when it was the session asking, so the caller can clear the cookie too.
  async revokeSession(userId: string, sessionId: string, currentTokenHash: string | null): Promise<boolean> {
    const row = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, tokenHash: true },
    });
    if (!row) throw sessionNotFound();
    await this.prisma.session.deleteMany({ where: { id: row.id, userId } });
    return currentTokenHash !== null && row.tokenHash === currentTokenHash;
  }
}
