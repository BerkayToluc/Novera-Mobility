import 'reflect-metadata';
import { HttpException, Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RateLimiter } from '../forms/rate-limiter.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AccountSecurityService, CHANGE_PASSWORD_LIMIT_PER_15_MIN } from './account-security.service.js';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { FakePrisma } from './auth.testing.js';
import { cleanUserAgent, describeDevice } from './device.js';
import { hashSessionToken } from './session-token.js';
import { toUserResponse, type UserRow } from './user-view.js';

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected an HttpException');
}
type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const REGISTER = { email: 'ayse@example.com', password: 'guclu-parola-1', firstName: 'Ayşe', lastName: 'Yılmaz', consent: true };

describe('describeDevice', () => {
  it('makes a short label from the User-Agent', () => {
    expect(describeDevice(CHROME_WINDOWS)).toBe('Chrome · Windows');
    expect(describeDevice(SAFARI_IPHONE)).toBe('Safari · iOS');
    expect(describeDevice('Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/127.0')).toBe('Firefox · Linux');
    expect(describeDevice('curl/8.0')).toBeNull();
    expect(describeDevice(null)).toBeNull();
  });

  it('cleans the stored header', () => {
    expect(cleanUserAgent(undefined)).toBeNull();
    expect(cleanUserAgent('   ')).toBeNull();
    expect(cleanUserAgent('x'.repeat(1000))).toHaveLength(300);
  });
});

describe('AccountSecurityService', () => {
  let db: FakePrisma;
  let auth: AuthService;
  let security: AccountSecurityService;
  let user: UserRow;
  let currentHash = '';
  let otherHash = '';

  beforeEach(async () => {
    db = new FakePrisma();
    const limiter = new RateLimiter();
    auth = new AuthService(db as unknown as PrismaService, limiter);
    security = new AccountSecurityService(db as unknown as PrismaService, limiter);
    const first = await auth.register(REGISTER, 'c1', SAFARI_IPHONE);
    const second = await auth.login(REGISTER, 'c1', CHROME_WINDOWS);
    user = second.user;
    otherHash = hashSessionToken(first.token);
    currentHash = hashSessionToken(second.token);
    // Make the order unambiguous: the second session is newer.
    db.sessions.find((s) => s.tokenHash === otherHash)!.createdAt = new Date('2026-10-01T10:00:00Z');
    db.sessions.find((s) => s.tokenHash === currentHash)!.createdAt = new Date('2026-10-02T10:00:00Z');
  });

  describe('changePassword', () => {
    it('changes the password, keeps this session and ends the others', async () => {
      await security.changePassword(user, currentHash, { currentPassword: REGISTER.password, newPassword: 'yepyeni-parola-2' });
      expect(db.sessions.map((s) => s.tokenHash)).toEqual([currentHash]);
      expect((await auth.login({ ...REGISTER, password: 'yepyeni-parola-2' }, 'c2')).user.email).toBe('ayse@example.com');
      const old = await catchHttp(auth.login(REGISTER, 'c3'));
      expect(bodyOf(old).code).toBe('INVALID_CREDENTIALS');
    });

    it('a wrong current password is 422 on that field and nothing changes', async () => {
      const error = await catchHttp(security.changePassword(user, currentHash, { currentPassword: 'yanlis-parola', newPassword: 'yepyeni-parola-2' }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ currentPassword: 'INCORRECT' });
      expect(db.sessions).toHaveLength(2);
      expect((await auth.login(REGISTER, 'c2')).user.email).toBe('ayse@example.com');
    });

    it('the new password must differ, be long enough, and both fields are required', async () => {
      const same = await catchHttp(security.changePassword(user, currentHash, { currentPassword: REGISTER.password, newPassword: REGISTER.password }));
      expect(bodyOf(same).fieldErrors).toEqual({ newPassword: 'SAME_AS_CURRENT' });
      const short = await catchHttp(security.changePassword(user, currentHash, { currentPassword: REGISTER.password, newPassword: 'kisa' }));
      expect(bodyOf(short).fieldErrors).toEqual({ newPassword: 'TOO_SHORT' });
      const empty = await catchHttp(security.changePassword(user, currentHash, {}));
      expect(bodyOf(empty).fieldErrors).toEqual({ currentPassword: 'REQUIRED', newPassword: 'REQUIRED' });
    });

    it('is rate limited per account', async () => {
      for (let i = 0; i < CHANGE_PASSWORD_LIMIT_PER_15_MIN; i += 1) {
        await catchHttp(security.changePassword(user, currentHash, { currentPassword: 'yanlis', newPassword: 'yepyeni-parola-2' }));
      }
      const blocked = await catchHttp(security.changePassword(user, currentHash, { currentPassword: REGISTER.password, newPassword: 'yepyeni-parola-2' }));
      expect(blocked.getStatus()).toBe(429);
    });
  });

  describe('sessions', () => {
    it('lists the open sessions newest first, marks the current one and names the device', async () => {
      const list = await security.listSessions(user.id, currentHash, new Date('2026-10-03T00:00:00Z'));
      expect(list.map((s) => [s.current, s.device])).toEqual([
        [true, 'Chrome · Windows'],
        [false, 'Safari · iOS'],
      ]);
      expect(JSON.stringify(list)).not.toContain(currentHash);
    });

    it('does not list sessions that have expired', async () => {
      db.sessions.find((s) => s.tokenHash === otherHash)!.expiresAt = new Date('2026-10-02T00:00:00Z');
      const list = await security.listSessions(user.id, currentHash, new Date('2026-10-03T00:00:00Z'));
      expect(list).toHaveLength(1);
    });

    it('closes the other sessions and keeps this one', async () => {
      await security.revokeOthers(user.id, currentHash);
      expect(db.sessions.map((s) => s.tokenHash)).toEqual([currentHash]);
    });

    it('closes one session; the current one is reported so the cookie can be cleared', async () => {
      const other = db.sessions.find((s) => s.tokenHash === otherHash)!;
      expect(await security.revokeSession(user.id, other.id, currentHash)).toBe(false);
      const current = db.sessions.find((s) => s.tokenHash === currentHash)!;
      expect(await security.revokeSession(user.id, current.id, currentHash)).toBe(true);
      expect(db.sessions).toHaveLength(0);
    });

    it("someone else's or unknown session is 404", async () => {
      const stranger = await auth.register({ ...REGISTER, email: 'baska@example.com' }, 'c9', CHROME_WINDOWS);
      const theirs = db.sessions.find((s) => s.tokenHash === hashSessionToken(stranger.token))!;
      const error = await catchHttp(security.revokeSession(user.id, theirs.id, currentHash));
      expect(error.getStatus()).toBe(404);
      expect(bodyOf(await catchHttp(security.revokeSession(user.id, 'nope', currentHash))).code).toBe('NOT_FOUND');
      expect(db.sessions).toHaveLength(3);
    });
  });

  describe('notification preferences (PATCH /me)', () => {
    it('start as reminders on, campaigns off, and are returned with the user', () => {
      expect(toUserResponse(user).notifications).toEqual({ reminders: true, campaigns: false });
    });

    it('update only the fields that are sent', async () => {
      const updated = await auth.updateProfile(user.id, { notifications: { campaigns: true } });
      expect(toUserResponse(updated).notifications).toEqual({ reminders: true, campaigns: true });
      const again = await auth.updateProfile(user.id, { notifications: { reminders: false } });
      expect(toUserResponse(again).notifications).toEqual({ reminders: false, campaigns: true });
    });

    it('refuse anything that is not a boolean', async () => {
      const error = await catchHttp(auth.updateProfile(user.id, { notifications: { reminders: 'yes' } }));
      expect(bodyOf(error).fieldErrors).toEqual({ notifications: 'INVALID_FORMAT' });
      expect(bodyOf(await catchHttp(auth.updateProfile(user.id, { notifications: 5 }))).fieldErrors).toEqual({ notifications: 'INVALID_FORMAT' });
    });
  });
});

// The same, through a real Nest app: cookies, the guard and the routes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

describe('account security over HTTP', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    fake.users = [];
    fake.sessions = [];
  });

  const send = (path: string, init: RequestInit & { cookie?: string; agent?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.cookie ? { Cookie: init.cookie } : {}),
        ...(init.agent ? { 'User-Agent': init.agent } : {}),
        'X-Forwarded-For': `10.1.0.${Math.floor(Math.random() * 250)}`,
      },
    });
  const cookieOf = (response: Response): string => (response.headers.get('set-cookie') ?? '').split(';')[0] ?? '';

  it('lists sessions with the device, changes the password and keeps the cookie working', async () => {
    const registered = await send('/auth/register', { method: 'POST', body: JSON.stringify(REGISTER), agent: CHROME_WINDOWS });
    const cookie = cookieOf(registered);
    const login = await send('/auth/login', { method: 'POST', body: JSON.stringify({ email: REGISTER.email, password: REGISTER.password }), agent: SAFARI_IPHONE });
    const otherCookie = cookieOf(login);

    const list = await (await send('/me/sessions', { cookie })).json();
    expect(list).toHaveLength(2);
    expect(list.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    expect(list.map((s: { device: string }) => s.device).sort()).toEqual(['Chrome · Windows', 'Safari · iOS']);

    const changed = await send('/me/password', { method: 'POST', cookie, body: JSON.stringify({ currentPassword: REGISTER.password, newPassword: 'yepyeni-parola-2' }) });
    expect(changed.status).toBe(204);
    expect((await send('/me', { cookie })).status).toBe(200);
    expect((await send('/me', { cookie: otherCookie })).status).toBe(401);
  });

  it('a wrong current password is 422, not 401, and the session stays', async () => {
    const cookie = cookieOf(await send('/auth/register', { method: 'POST', body: JSON.stringify(REGISTER) }));
    const response = await send('/me/password', { method: 'POST', cookie, body: JSON.stringify({ currentPassword: 'yanlis-parola', newPassword: 'yepyeni-parola-2' }) });
    expect(response.status).toBe(422);
    expect((await response.json()).fieldErrors).toEqual({ currentPassword: 'INCORRECT' });
    expect((await send('/me', { cookie })).status).toBe(200);
  });

  it('closing the current session clears the cookie; the endpoints need a session', async () => {
    const cookie = cookieOf(await send('/auth/register', { method: 'POST', body: JSON.stringify(REGISTER) }));
    const [current] = await (await send('/me/sessions', { cookie })).json();
    const closed = await send(`/me/sessions/${current.id}`, { method: 'DELETE', cookie });
    expect(closed.status).toBe(204);
    expect(closed.headers.get('set-cookie') ?? '').toMatch(/novera_session=;/);
    expect((await send('/me', { cookie })).status).toBe(401);
    expect((await send('/me/sessions')).status).toBe(401);
    expect((await send('/me/password', { method: 'POST', body: '{}' })).status).toBe(401);
  });

  it('closing the other sessions leaves this one open', async () => {
    const cookie = cookieOf(await send('/auth/register', { method: 'POST', body: JSON.stringify(REGISTER) }));
    const otherCookie = cookieOf(await send('/auth/login', { method: 'POST', body: JSON.stringify({ email: REGISTER.email, password: REGISTER.password }) }));
    expect((await send('/me/sessions', { method: 'DELETE', cookie })).status).toBe(204);
    expect((await send('/me', { cookie })).status).toBe(200);
    expect((await send('/me', { cookie: otherCookie })).status).toBe(401);
  });
});
