import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from './audit-log.service.js';

// The audit log screen's list (V2-34) against a real PostgreSQL (TEST_DATABASE_URL); skipped without one. The log is shared with
// suites that run at the same time, and it cannot be cleaned (the database refuses to delete a line), so every list is narrowed to
// a kind of record that only this run uses.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('audit log list against the database (V2-34)', () => {
  let prisma: PrismaService;
  let service: AuditLogService;
  const run = randomUUID().slice(0, 8);
  const entity = `v34-${run}`;
  let admin: { id: string };
  const userIds: string[] = [];

  const line = (at: string, actorId: string, action: string, extra: { entityId?: string; fields?: string[]; entity?: string } = {}) =>
    prisma.auditLog.create({
      data: { at: new Date(at), actorId, action, entity: extra.entity ?? entity, entityId: extra.entityId ?? null, fields: extra.fields ?? [] },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AuditLogService(prisma);
    admin = await prisma.user.create({
      data: { email: `kayit-${run}@example.test`, passwordHash: 'x', firstName: 'Ece', lastName: 'Aydın', role: 'ADMIN' },
    });
    userIds.push(admin.id);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('lists the newest first, with who did it (name and address read from the account), what, to which record and the field names', async () => {
    await line('2090-03-01T09:00:00Z', admin.id, 'branch.close', { entityId: 'b-1', fields: ['updatedAt'] });
    await line('2090-03-02T09:00:00Z', 'cli', 'admin.grant', { entityId: 'u-1', fields: ['role', 'password'] });
    await line('2090-03-03T09:00:00Z', admin.id, 'branch.update', { entityId: 'b-2', fields: ['name', 'city'] });

    const page = await service.list({ entity });
    expect(page.total).toBe(3);
    expect(page.items.map((item) => item.action)).toEqual(['branch.update', 'admin.grant', 'branch.close']);
    expect(page.items[0]).toMatchObject({
      actor: { id: admin.id, name: 'Ece Aydın', email: `kayit-${run}@example.test` },
      entity,
      entityId: 'b-2',
      fields: ['name', 'city'],
      at: '2090-03-03T09:00:00.000Z',
    });
    // A person at the terminal is no account: it has no name or address.
    expect(page.items[1]!.actor).toEqual({ id: 'cli', name: null, email: null });
  });

  it('narrows by who did it, by kind of record and by days (both included, by the Istanbul calendar)', async () => {
    expect((await service.list({ entity, actor: admin.id })).total).toBe(2);
    expect((await service.list({ entity, actor: 'cli' })).total).toBe(1);
    expect((await service.list({ entity: 'yok-boyle-bir-sey-' + run })).total).toBe(0);

    // 2 March 2090, Istanbul: from 1 March 21:00 UTC to 2 March 20:59:59.999 UTC.
    await line('2090-03-01T21:00:00Z', 'cli', 'edge.first', { entity: `${entity}-edge` });
    await line('2090-03-02T20:59:59.999Z', 'cli', 'edge.last', { entity: `${entity}-edge` });
    await line('2090-03-01T20:59:59.999Z', 'cli', 'edge.before', { entity: `${entity}-edge` });
    await line('2090-03-02T21:00:00Z', 'cli', 'edge.after', { entity: `${entity}-edge` });
    const day = await service.list({ entity: `${entity}-edge`, from: '2090-03-02', to: '2090-03-02' });
    expect(day.items.map((item) => item.action).sort()).toEqual(['edge.first', 'edge.last']);

    expect((await service.list({ entity, from: '2090-03-02' })).total).toBe(2);
    expect((await service.list({ entity, to: '2090-03-02' })).total).toBe(2);
    expect((await service.list({ entity, from: '2090-03-02', to: '2090-03-02', actor: 'cli' })).total).toBe(1);
  });

  it('pages with a total that does not change, and a line is never on two pages', async () => {
    const paged = `${entity}-paged`;
    for (let index = 0; index < 5; index += 1) await line('2090-04-01T09:00:00Z', 'cli', `same.${index}`, { entity: paged });
    const first = await service.list({ entity: paged, pageSize: '2', page: '1' });
    const second = await service.list({ entity: paged, pageSize: '2', page: '2' });
    const third = await service.list({ entity: paged, pageSize: '2', page: '3' });
    expect([first.total, second.total, third.total]).toEqual([5, 5, 5]);
    const ids = [...first.items, ...second.items, ...third.items].map((item) => item.id);
    expect(new Set(ids).size).toBe(5);
    expect(third.items).toHaveLength(1);
  });

  it('an account that has been deleted since is still the actor of its lines, without a name', async () => {
    const gone = await prisma.user.create({ data: { email: `gone-${run}@example.test`, passwordHash: 'x', firstName: 'Silinen', lastName: 'Kişi', role: 'ADMIN' } });
    await line('2090-05-01T09:00:00Z', gone.id, 'gone.did', { entity: `${entity}-gone` });
    await prisma.user.delete({ where: { id: gone.id } });
    const page = await service.list({ entity: `${entity}-gone` });
    expect(page.items[0]!.actor).toEqual({ id: gone.id, name: null, email: null });
  });

  it('is 422 for an actor, a kind, a day or a page that makes no sense', async () => {
    for (const query of [{ actor: 'someone' }, { entity: 'Not A Kind' }, { from: '2090-02-30' }, { to: 'yesterday' }, { pageSize: '0' }]) {
      expect((await refused(service.list(query))).status).toBe(422);
    }
  });

  it('the database itself refuses to change or remove a line', async () => {
    const written = await line('2090-06-01T09:00:00Z', 'cli', 'keep.me', { entity: `${entity}-keep` });
    await expect(prisma.auditLog.update({ where: { id: written.id }, data: { action: 'changed' } })).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: written.id } })).rejects.toThrow();
  });
});
