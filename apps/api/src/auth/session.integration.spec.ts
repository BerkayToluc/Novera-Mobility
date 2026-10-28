import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { SessionCleaner } from './session.cleaner.js';
import { hashSessionToken, SESSION_IDLE_DAYS } from './session-token.js';

// Against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one.
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;

describeDb('sessions: idle time and the daily cleanup (V2-10)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  const run = randomUUID().slice(0, 8);
  let userId = '';

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    auth = new AuthService(prisma);
    userId = (
      await prisma.user.create({
        data: { email: `sess-${run}@example.com`, firstName: 'S', lastName: 'T', passwordHash: 'x' },
      })
    ).id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.loginThrottle.deleteMany({ where: { email: { contains: run } } });
    await prisma.$disconnect();
  });

  async function addSession(label: string, ageDays: number, idleDays: number, expiresInDays = 30 - ageDays) {
    const token = `${label}-${run}`;
    const now = Date.now();
    await prisma.session.create({
      data: {
        tokenHash: hashSessionToken(token),
        userId,
        expiresAt: new Date(now + expiresInDays * DAY),
        createdAt: new Date(now - ageDays * DAY),
        lastUsedAt: new Date(now - idleDays * DAY),
      },
    });
    return token;
  }

  it('a session used within the idle time works, and its last use is refreshed once it is older than five minutes', async () => {
    const token = await addSession('fresh', 3, 1);
    const user = await auth.authenticate(token);
    expect(user?.id).toBe(userId);
    const row = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
    expect(Date.now() - row!.lastUsedAt.getTime()).toBeLessThan(60_000);
  });

  it('a session that is used often is not written on every request', async () => {
    const token = await addSession('busy', 1, 0);
    const before = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
    await auth.authenticate(token);
    const after = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } });
    expect(after!.lastUsedAt.getTime()).toBe(before!.lastUsedAt.getTime());
  });

  it(`a session unused for more than ${SESSION_IDLE_DAYS} days is no longer valid, though it has not expired, and is deleted`, async () => {
    const token = await addSession('idle', 9, SESSION_IDLE_DAYS + 1);
    expect(await auth.authenticate(token)).toBeNull();
    expect(await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) } })).toBeNull();
  });

  it('a session past its 30 days is no longer valid however recently it was used', async () => {
    const token = await addSession('old', 31, 0, -1);
    expect(await auth.authenticate(token)).toBeNull();
  });

  it('the daily cleanup deletes ended sessions, used or expired reset links and untouched sign-in waits, and keeps the rest', async () => {
    const idle = await addSession('c-idle', 9, 8);
    const gone = await addSession('c-expired', 31, 1, -1);
    const alive = await addSession('c-alive', 2, 1);
    const now = new Date();
    const linkOf = (label: string, extra: object) =>
      prisma.passwordResetToken.create({
        data: { tokenHash: `${label}-${run}`, userId, expiresAt: new Date(now.getTime() + DAY), ...extra },
      });
    await linkOf('t-live', {});
    await linkOf('t-used', { usedAt: now });
    await linkOf('t-expired', { expiresAt: new Date(now.getTime() - DAY) });
    await prisma.loginThrottle.create({
      data: { email: `old-${run}@example.com`, failures: 6, updatedAt: new Date(now.getTime() - 2 * DAY) },
    });
    await prisma.loginThrottle.create({ data: { email: `new-${run}@example.com`, failures: 2 } });
    // updatedAt is set by Prisma on create; make the "old" one old.
    await prisma.$executeRaw`UPDATE "LoginThrottle" SET "updatedAt" = now() - interval '2 days' WHERE "email" = ${`old-${run}@example.com`}`;

    await new SessionCleaner(prisma).clean(now);

    for (const label of ['c-idle', 'c-expired']) {
      expect(await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(`${label}-${run}`) } })).toBeNull();
    }
    expect(idle && gone).toBeTruthy();
    expect(await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(alive) } })).not.toBeNull();
    const links = (await prisma.passwordResetToken.findMany({ where: { tokenHash: { endsWith: run } } })).map(
      (row) => row.tokenHash,
    );
    expect(links).toEqual([`t-live-${run}`]);
    expect(await prisma.loginThrottle.findUnique({ where: { email: `old-${run}@example.com` } })).toBeNull();
    expect(await prisma.loginThrottle.findUnique({ where: { email: `new-${run}@example.com` } })).not.toBeNull();
  });

  it('a wrong password makes the address wait after the free attempts, in the real database (and a right one clears it)', async () => {
    const email = `wait-${run}@example.com`;
    for (let i = 0; i < 6; i += 1) {
      await expect(auth.login({ email, password: 'yanlis-parola-1' })).rejects.toMatchObject({ status: 401 });
    }
    const row = await prisma.loginThrottle.findUnique({ where: { email } });
    expect(row?.failures).toBe(6);
    expect(row?.lockedUntil).not.toBeNull();
    await expect(auth.login({ email, password: 'yanlis-parola-1' })).rejects.toMatchObject({ status: 429 });
  });
});
