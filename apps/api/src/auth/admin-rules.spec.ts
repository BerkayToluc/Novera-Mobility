import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ADMIN_IDLE_MINUTES, ADMIN_PASSWORD_MIN, ADMIN_SESSION_HOURS } from './admin-rules.js';
import { AccountSecurityService } from './account-security.service.js';
import { AuthService } from './auth.service.js';
import { GoogleAuthService } from './google-auth.service.js';
import { GoogleTokenVerifier, type GoogleProfile } from './google-verifier.js';
import { hashPassword } from './password.js';
import { PasswordResetFake } from './password-reset.testing.js';
import { PasswordResetService } from './password-reset.service.js';
import type { ResetLinkNotifier } from './reset-link-notifier.js';
import { hashSessionToken } from './session-token.js';
import type { UserRow } from './user-view.js';

// What is stricter for an administrator (V2-23, ADMIN.md §2): the session, Google, and the password.
async function failure(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected an HttpException');
}
const bodyOf = (error: HttpException) => error.getResponse() as { code: string; fieldErrors?: Record<string, string> };

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const PASSWORD = 'a-long-enough-password-1';

describe('an administrator account', () => {
  let db: PasswordResetFake;
  let auth: AuthService;

  beforeEach(() => {
    db = new PasswordResetFake();
    auth = new AuthService(db as unknown as PrismaService);
  });

  async function addUser(role: 'CUSTOMER' | 'ADMIN', email = 'yonetici@example.com') {
    const { user } = await auth.register({ email, password: PASSWORD, firstName: 'Y', lastName: 'Z', consent: true });
    db.users.find((row) => row.id === user.id)!.role = role;
    return user.id;
  }
  const rowOf = (token: string) => db.sessions.find((session) => session.tokenHash === hashSessionToken(token));
  // A session made at `createdAt`, last used at `lastUsedAt`, that a customer's rules would keep for 30 days.
  function addSession(userId: string, token: string, createdAt: Date, lastUsedAt = createdAt) {
    db.sessions.push({
      id: `s-${token}`,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: new Date(createdAt.getTime() + 30 * 24 * HOUR),
      createdAt,
      lastUsedAt,
    });
  }

  describe('nobody gives themselves the role', () => {
    it('a role in the sign-up body or in a profile update is ignored', async () => {
      const { user } = await auth.register({
        email: 'kendi@example.com',
        password: PASSWORD,
        firstName: 'K',
        lastName: 'L',
        consent: true,
        role: 'ADMIN',
      });
      expect(db.users.find((row) => row.id === user.id)!.role).toBe('CUSTOMER');
      await auth.updateProfile(user.id, { firstName: 'Kemal', role: 'ADMIN' });
      expect(db.users.find((row) => row.id === user.id)!.role).toBe('CUSTOMER');
    });
  });

  describe('the session', () => {
    it('sign-in gives an administrator a session of 12 hours, a customer one of 30 days', async () => {
      const adminId = await addUser('ADMIN');
      const customerId = await addUser('CUSTOMER', 'musteri@example.com');
      const admin = await auth.login({ email: 'yonetici@example.com', password: PASSWORD });
      const customer = await auth.login({ email: 'musteri@example.com', password: PASSWORD });
      expect(admin.user.id).toBe(adminId);
      expect(customer.user.id).toBe(customerId);
      const hours = (session: { expiresAt: Date }) => (session.expiresAt.getTime() - Date.now()) / HOUR;
      expect(hours(admin)).toBeGreaterThan(ADMIN_SESSION_HOURS - 0.01);
      expect(hours(admin)).toBeLessThanOrEqual(ADMIN_SESSION_HOURS);
      expect(hours(customer)).toBeGreaterThan(29 * 24);
    });

    it('is no longer valid after 12 hours, however often it was used', async () => {
      const id = await addUser('ADMIN');
      const start = new Date('2026-11-02T08:00:00Z');
      // Used every 30 minutes the whole time: the idle rule never trips, the absolute one must.
      addSession(id, 'busy', start, new Date(start.getTime() + 11 * HOUR + 40 * MINUTE));
      expect((await auth.authenticate('busy', new Date(start.getTime() + 11 * HOUR + 59 * MINUTE)))?.id).toBe(id);
      rowOf('busy')!.lastUsedAt = new Date(start.getTime() + 12 * HOUR + 10 * MINUTE);
      expect(await auth.authenticate('busy', new Date(start.getTime() + 12 * HOUR + 11 * MINUTE))).toBeNull();
      // The row is gone too, not only refused.
      expect(rowOf('busy')).toBeUndefined();
    });

    it('is no longer valid after an hour without use', async () => {
      const id = await addUser('ADMIN');
      const start = new Date('2026-11-02T08:00:00Z');
      addSession(id, 'quiet', start);
      expect((await auth.authenticate('quiet', new Date(start.getTime() + (ADMIN_IDLE_MINUTES - 1) * MINUTE)))?.id).toBe(id);
      // That use refreshed it (older than five minutes); an hour and a minute after the last use it is over.
      const last = rowOf('quiet')!.lastUsedAt as Date;
      expect(await auth.authenticate('quiet', new Date(last.getTime() + (ADMIN_IDLE_MINUTES + 1) * MINUTE))).toBeNull();
    });

    it('the same session of a customer is still valid 13 hours later and after 3 idle hours', async () => {
      const id = await addUser('CUSTOMER');
      const start = new Date('2026-11-02T08:00:00Z');
      addSession(id, 'customer', start, new Date(start.getTime() + 10 * HOUR));
      expect((await auth.authenticate('customer', new Date(start.getTime() + 13 * HOUR)))?.id).toBe(id);
    });

    it('an account given the role later is held to the rule with the sessions it already has', async () => {
      const id = await addUser('CUSTOMER');
      const start = new Date('2026-11-02T08:00:00Z');
      addSession(id, 'old', start, new Date(start.getTime() + 12 * HOUR));
      db.users.find((row) => row.id === id)!.role = 'ADMIN';
      expect(await auth.authenticate('old', new Date(start.getTime() + 12 * HOUR + 5 * MINUTE))).toBeNull();
    });
  });

  describe('Google', () => {
    const profile: GoogleProfile = { sub: 'g-9', email: 'yonetici@example.com', givenName: 'Y', familyName: 'Z', name: 'Y Z' };
    class Verifier extends GoogleTokenVerifier {
      isConfigured() {
        return true;
      }
      async verify(): Promise<GoogleProfile> {
        return profile;
      }
    }
    const google = () => new GoogleAuthService(db as unknown as PrismaService, new Verifier());

    it('an administrator is turned away with 403 GOOGLE_NOT_ALLOWED when the e-mail matches, and nothing changes', async () => {
      const id = await addUser('ADMIN');
      const before = db.users.find((row) => row.id === id)!.passwordHash;
      const sessions = db.sessions.length;
      const error = await failure(google().signIn({ credential: 'x', consent: true }));
      expect(error.getStatus()).toBe(403);
      expect(bodyOf(error).code).toBe('GOOGLE_NOT_ALLOWED');
      const row = db.users.find((user) => user.id === id)!;
      // Not linked, and above all the password is still there (linking would have removed it).
      expect(row.googleSub).toBeNull();
      expect(row.passwordHash).toBe(before);
      expect(db.sessions).toHaveLength(sessions);
    });

    it('is turned away the same when the Google account was linked before the role was given', async () => {
      const id = await addUser('CUSTOMER');
      db.users.find((row) => row.id === id)!.googleSub = 'g-9';
      db.users.find((row) => row.id === id)!.role = 'ADMIN';
      const error = await failure(google().signIn({ credential: 'x' }));
      expect(error.getStatus()).toBe(403);
      expect(bodyOf(error).code).toBe('GOOGLE_NOT_ALLOWED');
    });
  });

  describe('the password needs 12 characters', () => {
    const eleven = 'a1b2c3d4e5f';
    const twelve = 'a1b2c3d4e5f6';

    async function changePassword(role: 'CUSTOMER' | 'ADMIN', newPassword: string) {
      db = new PasswordResetFake();
      auth = new AuthService(db as unknown as PrismaService);
      const id = await addUser(role);
      const user = db.users.find((row) => row.id === id) as unknown as UserRow;
      return new AccountSecurityService(db as unknown as PrismaService).changePassword(user, null, {
        currentPassword: PASSWORD,
        newPassword,
      });
    }

    it('changing it: 11 is TOO_SHORT for an administrator and fine for a customer; 12 is fine', async () => {
      const error = await failure(changePassword('ADMIN', eleven));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ newPassword: 'TOO_SHORT' });
      await expect(changePassword('CUSTOMER', eleven)).resolves.toBeUndefined();
      await expect(changePassword('ADMIN', twelve)).resolves.toBeUndefined();
      expect(ADMIN_PASSWORD_MIN).toBe(12);
    });

    it('resetting it: a short one is refused and the link is not used up', async () => {
      const id = await addUser('ADMIN');
      db.users.find((row) => row.id === id)!.passwordHash = await hashPassword(PASSWORD);
      const sent: string[] = [];
      const notifier = { send: async (_email: string, link: string) => void sent.push(link) };
      const service = new PasswordResetService(db as unknown as PrismaService, notifier as unknown as ResetLinkNotifier);
      await service.requestReset({ email: 'yonetici@example.com' });
      const token = new URL(sent[0]!).searchParams.get('token')!;

      const error = await failure(service.resetPassword({ token, password: eleven }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ password: 'TOO_SHORT' });
      expect(db.resetTokens[0]!.usedAt).toBeNull();
      await expect(service.resetPassword({ token, password: twelve })).resolves.toBeUndefined();
    });
  });
});
