import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { PasswordResetFake } from './password-reset.testing.js';
import {
  PasswordResetService,
  RESET_TOKEN_TTL_MS,
} from './password-reset.service.js';
import type { ResetLinkNotifier } from './reset-link-notifier.js';
import { hashSessionToken } from './session-token.js';

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('Expected an HttpException but none was thrown');
}
type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

const OLD_PASSWORD = 'old-password-1';
const NEW_PASSWORD = 'new-password-2';

describe('PasswordResetService', () => {
  let db: PasswordResetFake;
  let service: PasswordResetService;
  let sent: Array<{ email: string; link: string }>;

  async function addUser(email = 'ayse@example.com', id = 'u1', locale: 'TR' | 'EN' = 'TR') {
    db.users.push({ id, email, passwordHash: await hashPassword(OLD_PASSWORD), locale });
    db.sessions.push({ id: `s-${id}`, userId: id, tokenHash: `h-${id}`, expiresAt: new Date(Date.now() + 1e9) });
  }

  // Asks for a link and returns the plain token that went to the notifier.
  async function requestToken(email = 'ayse@example.com'): Promise<string> {
    await service.requestReset({ email });
    const link = sent[sent.length - 1]!.link;
    return new URL(link).searchParams.get('token')!;
  }

  beforeEach(() => {
    db = new PasswordResetFake();
    sent = [];
    const notifier = { send: async (email: string, link: string) => void sent.push({ email, link }) };
    service = new PasswordResetService(
      db as unknown as PrismaService,
      notifier as unknown as ResetLinkNotifier,
    );
  });

  describe('requestReset', () => {
    it('stores only the hash of the token and sends the link', async () => {
      await addUser();
      const token = await requestToken();
      expect(token.length).toBeGreaterThan(30);
      expect(db.resetTokens).toHaveLength(1);
      expect(db.resetTokens[0]?.tokenHash).toBe(hashSessionToken(token));
      expect(db.resetTokens[0]?.tokenHash).not.toBe(token);
      expect(db.resetTokens[0]?.userId).toBe('u1');
      const ttl = db.resetTokens[0]!.expiresAt.getTime() - Date.now();
      expect(ttl).toBeGreaterThan(RESET_TOKEN_TTL_MS - 5000);
      expect(ttl).toBeLessThanOrEqual(RESET_TOKEN_TTL_MS);
      expect(sent[0]?.email).toBe('ayse@example.com');
    });

    it('builds the link in the account language and finds the account whatever the letter case', async () => {
      await addUser('ayse@example.com', 'u1', 'EN');
      await service.requestReset({ email: 'AYSE@Example.com' });
      expect(sent[0]?.link).toMatch(/^http:\/\/localhost:3000\/en\/sifre-sifirla\/yeni\?token=/);
    });

    it('does nothing visible for an e-mail without an account', async () => {
      await expect(service.requestReset({ email: 'nobody@example.com' })).resolves.toBeUndefined();
      expect(db.resetTokens).toHaveLength(0);
      expect(sent).toHaveLength(0);
    });

    it('a new request invalidates the previous link', async () => {
      await addUser();
      const first = await requestToken();
      const second = await requestToken();
      expect(db.resetTokens).toHaveLength(1);
      expect((await catchHttp(service.resetPassword({ token: first, password: NEW_PASSWORD }))).getStatus()).toBe(422);
      await expect(service.resetPassword({ token: second, password: NEW_PASSWORD })).resolves.toBeUndefined();
    });

    it('rejects a malformed e-mail with 422', async () => {
      const error = await catchHttp(service.requestReset({ email: 'not-an-email' }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ email: 'INVALID_EMAIL' });
    });

  });

  describe('resetPassword', () => {
    it('changes the password, uses the token up and signs the account out everywhere', async () => {
      await addUser();
      await addUser('bora@example.com', 'u2');
      const token = await requestToken();
      await service.resetPassword({ token, password: NEW_PASSWORD });

      const user = db.users.find((u) => u.id === 'u1')!;
      expect(await verifyPassword(NEW_PASSWORD, user.passwordHash)).toBe(true);
      expect(await verifyPassword(OLD_PASSWORD, user.passwordHash)).toBe(false);
      expect(db.sessions.filter((s) => s.userId === 'u1')).toHaveLength(0);
      expect(db.sessions.filter((s) => s.userId === 'u2')).toHaveLength(1);
      const other = db.users.find((u) => u.id === 'u2')!;
      expect(await verifyPassword(OLD_PASSWORD, other.passwordHash)).toBe(true);
    });

    it('a link works once', async () => {
      await addUser();
      const token = await requestToken();
      await service.resetPassword({ token, password: NEW_PASSWORD });
      const error = await catchHttp(service.resetPassword({ token, password: 'third-password-3' }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).code).toBe('RESET_TOKEN_INVALID');
      const user = db.users[0]!;
      expect(await verifyPassword(NEW_PASSWORD, user.passwordHash)).toBe(true);
    });

    it('two simultaneous uses of one link: exactly one wins', async () => {
      await addUser();
      const token = await requestToken();
      const results = await Promise.allSettled([
        service.resetPassword({ token, password: 'first-password-1' }),
        service.resetPassword({ token, password: 'second-password-2' }),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('an expired link is refused', async () => {
      await addUser();
      const token = await requestToken();
      db.resetTokens[0]!.expiresAt = new Date(Date.now() - 1000);
      const error = await catchHttp(service.resetPassword({ token, password: NEW_PASSWORD }));
      expect(bodyOf(error).code).toBe('RESET_TOKEN_INVALID');
      expect(await verifyPassword(OLD_PASSWORD, db.users[0]!.passwordHash)).toBe(true);
    });

    it('an unknown token is refused with the same answer as a used one', async () => {
      const error = await catchHttp(service.resetPassword({ token: 'made-up-token', password: NEW_PASSWORD }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).code).toBe('RESET_TOKEN_INVALID');
    });

    it('a weak password is a 422 and does NOT use the token up', async () => {
      await addUser();
      const token = await requestToken();
      const error = await catchHttp(service.resetPassword({ token, password: 'short' }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error)).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { password: 'TOO_SHORT' } });
      await expect(service.resetPassword({ token, password: NEW_PASSWORD })).resolves.toBeUndefined();
    });

    it('names a missing token and a missing password', async () => {
      const error = await catchHttp(service.resetPassword({}));
      expect(bodyOf(error).fieldErrors).toEqual({ token: 'REQUIRED', password: 'REQUIRED' });
    });

  });
});
