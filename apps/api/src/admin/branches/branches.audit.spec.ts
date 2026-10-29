import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../app.setup.js';
import { AuthModule } from '../../auth/auth.module.js';
import { FakePrisma } from '../../auth/auth.testing.js';
import { RateLimitModule } from '../../common/rate-limit.module.js';
import { RateLimitStore } from '../../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../../common/rate-limit.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminModule } from '../admin.module.js';
import { BranchesService } from './branches.service.js';
import type { BranchView } from './branches.view.js';

// "Every change is written to the audit log" (V2-27, ADR-24) for the branches: the action, the branch id, and the NAMES of
// the fields that were sent, never their values (an address and a phone number are in them). The service is replaced by one
// that answers, so this is only about what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const ID = '6f1c1b5e-2f3a-4c55-9d0e-0a1b2c3d4e5f';
const VIEW: BranchView = {
  id: ID,
  name: 'Ankara Çankaya',
  city: 'Ankara',
  address: 'Kızılay Mahallesi, Çankaya',
  latitude: 39.9179,
  longitude: 32.8627,
  phone: '+90 312 555 01 03',
  email: 'ankara@novera.example',
  kind: 'CITY',
  openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: '10:00-16:00' },
  status: 'OPEN',
  closedAt: null,
  activeVehicles: 0,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};
const service = {
  list: async () => ({ items: [VIEW], total: 1, page: 1, pageSize: 20 }),
  get: async () => ({ ...VIEW, usage: { reservations: 0, holds: 0, vehicles: 0 } }),
  create: async () => VIEW,
  update: async () => VIEW,
  close: async () => ({ ...VIEW, status: 'CLOSED' as const }),
  reopen: async () => VIEW,
};

describe('branches in the audit log (V2-27)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(BranchesService)
      .useValue(service)
      .overrideProvider(RateLimitStore)
      .useValue(new MemoryRateLimitStore())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    fake.users = [];
    fake.sessions = [];
    fake.throttles = [];
    fake.auditLogs = [];
  });

  let counter = 0;
  const call = (method: string, path: string, options: { body?: unknown; cookie?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.7.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  async function administrator() {
    const response = await call('POST', '/auth/register', {
      body: { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true },
    });
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('creating, changing, closing and opening each leave one row: action, branch id, only the field names', async () => {
    const { cookie, id } = await administrator();

    expect((await call('POST', '/admin/branches', { cookie, body: { name: 'Ankara Çankaya', phone: '+90 312 555 01 03', address: 'Kızılay Mahallesi' } })).status).toBe(201);
    expect((await call('PATCH', `/admin/branches/${ID}`, { cookie, body: { updatedAt: VIEW.updatedAt, phone: '+90 312 555 99 99' } })).status).toBe(200);
    expect((await call('POST', `/admin/branches/${ID}/close`, { cookie })).status).toBe(200);
    expect((await call('POST', `/admin/branches/${ID}/reopen`, { cookie })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(4);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'branch.create', entity: 'branch', entityId: ID, fields: ['name', 'phone', 'address'] });
    expect(fake.auditLogs[1]).toMatchObject({ action: 'branch.update', entity: 'branch', entityId: ID, fields: ['updatedAt', 'phone'] });
    expect(fake.auditLogs[2]).toMatchObject({ action: 'branch.close', entity: 'branch', entityId: ID, fields: [] });
    expect(fake.auditLogs[3]).toMatchObject({ action: 'branch.reopen', entity: 'branch', entityId: ID, fields: [] });
    // Names only: not the address, not the phone numbers.
    const written = JSON.stringify(fake.auditLogs);
    expect(written).not.toContain('Kızılay');
    expect(written).not.toContain('555');
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/branches', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/branches/${ID}`, { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
