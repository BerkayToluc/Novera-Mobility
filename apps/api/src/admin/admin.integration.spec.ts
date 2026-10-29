import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { grantAdmin, revokeAdmin } from './admin-account.js';
import { AuditService } from './audit.service.js';

// Against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one.
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeDb = databaseUrl ? describe : describe.skip;

describeDb('administration against the database (V2-23)', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const email = `admin-${run}@example.com`;
  const PASSWORD = 'a-long-enough-passphrase';

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    // The audit log is not cleaned up: the database does not allow it (below). Everything else is.
    await prisma.user.deleteMany({ where: { email: { contains: run } } });
    await prisma.$disconnect();
  });

  it('the audit log only adds: the database refuses UPDATE and DELETE', async () => {
    const entityId = `entity-${run}`;
    await new AuditService(prisma).record({ actorId: 'actor', action: 'test.change', entity: 'test', entityId, fields: ['name', 'bad name!'] });
    const row = await prisma.auditLog.findFirstOrThrow({ where: { entityId } });
    // A field name that is not a plain identifier is not kept.
    expect(row.fields).toEqual(['name']);
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: 'changed' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.deleteMany({ where: { entityId } })).rejects.toThrow(/append-only/);
    expect(await prisma.auditLog.count({ where: { entityId } })).toBe(1);
  });

  it('grant, sign-in (12 hours), and revoke, in the real tables', async () => {
    const { id, created } = await grantAdmin(prisma, { email, name: 'Test Admin', password: PASSWORD });
    expect(created).toBe(true);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).role).toBe('ADMIN');

    const session = await new AuthService(prisma).login({ email, password: PASSWORD });
    const hours = (session.expiresAt.getTime() - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(11.99);
    expect(hours).toBeLessThanOrEqual(12);

    await revokeAdmin(prisma, email);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).role).toBe('CUSTOMER');
    expect(await prisma.session.count({ where: { userId: id } })).toBe(0);
    const actions = (await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { at: 'asc' } })).map((row) => row.action);
    expect(actions).toEqual(['admin.grant', 'admin.revoke']);
  });
});
