import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { parseInput, validationFailed } from '../common/zod-validation.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { passwordNotSet } from './auth.errors.js';
import { changePasswordSchema, deleteAccountSchema } from './auth.schemas.js';
import { describeDevice } from './device.js';
import { hashPassword, verifyPassword } from './password.js';
import type { UserRow } from './user-view.js';

// BACKLOG Y71: password change and open sessions for the signed-in account (SPEC §2.9, Ayarlar > Güvenlik).

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
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // POST /me/password. A wrong current password is a 422 on that field (not 401: the person is still
  // signed in). On success every OTHER session ends, so a stolen cookie stops working; this one stays.
  async changePassword(user: UserRow, currentTokenHash: string | null, input: unknown): Promise<void> {
    if (user.passwordHash === null) throw passwordNotSet();

    const { currentPassword, newPassword } = parseInput(changePasswordSchema, input, 'Password change data is invalid');
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

  // DELETE /me asks the person to confirm (QUALITY G-14): a stolen session cookie alone must not be enough to delete
  // an account. With a password, the current password; without one (opened with Google), the e-mail address typed in.
  async confirmDeletion(user: UserRow, input: unknown): Promise<void> {
    const { currentPassword, confirmEmail } = parseInput(
      deleteAccountSchema,
      input,
      'Account deletion data is invalid',
    );
    if (user.passwordHash !== null) {
      if (currentPassword === null)
        throw validationFailed({ currentPassword: 'REQUIRED' }, 'The current password is required');
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw validationFailed({ currentPassword: 'INVALID_PASSWORD' }, 'The password is wrong');
      }
      return;
    }
    if (confirmEmail === null) throw validationFailed({ confirmEmail: 'REQUIRED' }, 'The e-mail address is required');
    if (confirmEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw validationFailed({ confirmEmail: 'EMAIL_MISMATCH' }, 'The e-mail address does not match the account');
    }
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
