import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from '../auth/auth.service.js';
import { verifyPassword } from '../auth/password.js';
import { PasswordResetFake } from '../auth/password-reset.testing.js';
import { AdminAccountError, assertAdminPassword, grantAdmin, revokeAdmin } from './admin-account.js';

// `pnpm admin:create` without the terminal (V2-23): the same functions the script calls.
const GOOD = 'a-long-enough-passphrase';

describe('admin:create', () => {
  let db: PasswordResetFake;
  const asDb = () => db as unknown as PrismaService;

  beforeEach(() => {
    db = new PasswordResetFake();
  });

  async function reject(promise: Promise<unknown>): Promise<AdminAccountError> {
    try {
      await promise;
    } catch (error) {
      if (error instanceof AdminAccountError) return error;
      throw error;
    }
    throw new Error('expected an AdminAccountError');
  }

  describe('the password', () => {
    it('needs 12 characters and may not be a common one, and the message never holds it', () => {
      expect(() => assertAdminPassword('short-1')).toThrow(/at least 12/);
      expect(() => assertAdminPassword('a'.repeat(200))).toThrow(/longer than/);
      expect(() => assertAdminPassword('password1234')).toThrow(/common/);
      expect(() => assertAdminPassword('12345678910111213')).not.toThrow(/at least/);
      expect(() => assertAdminPassword(GOOD)).not.toThrow();
      let message = '';
      try {
        assertAdminPassword('short-1');
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).not.toContain('short-1');
    });
  });

  describe('grant', () => {
    it('opens a new administrator account, with the e-mail lower case and the name split', async () => {
      const { id, created } = await grantAdmin(asDb(), { email: ' Ada@Example.COM ', name: 'Ada Byron Lovelace', password: GOOD });
      expect(created).toBe(true);
      const user = db.users.find((row) => row.id === id)!;
      expect(user).toMatchObject({ email: 'ada@example.com', firstName: 'Ada Byron', lastName: 'Lovelace', role: 'ADMIN', accountType: 'INDIVIDUAL' });
      expect(user.passwordHash).not.toContain(GOOD);
      expect(await verifyPassword(GOOD, user.passwordHash)).toBe(true);
    });

    it('gives the role to an existing account, sets the password and closes its sessions and reset links', async () => {
      const auth = new AuthService(db as unknown as PrismaService);
      const { user } = await auth.register({ email: 'ayse@example.com', password: 'eight-chars-1', firstName: 'A', lastName: 'B', consent: true });
      db.resetTokens.push({ id: 'r1', userId: user.id, tokenHash: 'h', usedAt: null, expiresAt: new Date(Date.now() + 1e6) });
      expect(db.sessions).toHaveLength(1);

      const result = await grantAdmin(asDb(), { email: 'ayse@example.com', password: GOOD });
      expect(result).toEqual({ id: user.id, created: false });
      const row = db.users.find((u) => u.id === user.id)!;
      expect(row.role).toBe('ADMIN');
      expect(await verifyPassword(GOOD, row.passwordHash)).toBe(true);
      expect(await verifyPassword('eight-chars-1', row.passwordHash)).toBe(false);
      expect(db.sessions).toHaveLength(0);
      expect(db.resetTokens).toHaveLength(0);
    });

    it('refuses a corporate account, a new account without a name, and a one-word name', async () => {
      db.users.push({ id: 'c1', email: 'firma@example.com', accountType: 'CORPORATE', role: 'CUSTOMER', passwordHash: 'x' });
      expect((await reject(grantAdmin(asDb(), { email: 'firma@example.com', password: GOOD }))).message).toMatch(/corporate/);
      expect((await reject(grantAdmin(asDb(), { email: 'yeni@example.com', password: GOOD }))).message).toMatch(/--name/);
      expect((await reject(grantAdmin(asDb(), { email: 'yeni@example.com', name: 'Ada', password: GOOD }))).message).toMatch(/first and a last/);
      expect(db.users.find((u) => u.id === 'c1')!.role).toBe('CUSTOMER');
      expect(db.auditLogs).toHaveLength(0);
    });

    it('refuses a bad address or a weak password before touching anything', async () => {
      await reject(grantAdmin(asDb(), { email: 'not-an-address', name: 'Ada Lovelace', password: GOOD }));
      await reject(grantAdmin(asDb(), { email: 'ada@example.com', name: 'Ada Lovelace', password: 'short' }));
      expect(db.users).toHaveLength(0);
      expect(db.auditLogs).toHaveLength(0);
    });

    it('writes the grant to the audit log, with `cli` as the actor and names only', async () => {
      const { id } = await grantAdmin(asDb(), { email: 'ada@example.com', name: 'Ada Lovelace', password: GOOD });
      expect(db.auditLogs).toHaveLength(1);
      expect(db.auditLogs[0]).toMatchObject({ actorId: 'cli', action: 'admin.grant', entity: 'user', entityId: id });
      const written = JSON.stringify(db.auditLogs);
      expect(written).not.toContain(GOOD);
      expect(written).not.toContain('ada@example.com');
    });
  });

  describe('revoke', () => {
    it('takes the role away and closes every open session, and logs it', async () => {
      const { id } = await grantAdmin(asDb(), { email: 'ada@example.com', name: 'Ada Lovelace', password: GOOD });
      await new AuthService(asDb()).login({ email: 'ada@example.com', password: GOOD });
      expect(db.sessions).toHaveLength(1);
      await revokeAdmin(asDb(), 'ada@example.com');
      expect(db.users.find((u) => u.id === id)!.role).toBe('CUSTOMER');
      expect(db.sessions).toHaveLength(0);
      expect(db.auditLogs.map((row) => row.action)).toEqual(['admin.grant', 'admin.revoke']);
    });

    it('refuses an account that is not an administrator, and one that does not exist', async () => {
      await new AuthService(asDb()).register({ email: 'ayse@example.com', password: 'eight-chars-1', firstName: 'A', lastName: 'B', consent: true });
      expect((await reject(revokeAdmin(asDb(), 'ayse@example.com'))).message).toMatch(/not an administrator/);
      expect((await reject(revokeAdmin(asDb(), 'nobody@example.com'))).message).toMatch(/No account/);
    });
  });
});
