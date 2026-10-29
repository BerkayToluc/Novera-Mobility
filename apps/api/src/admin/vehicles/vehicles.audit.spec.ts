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
import { ExtrasService } from '../extras/extras.service.js';
import type { ExtraView } from '../extras/extras.view.js';
import { VehiclesService } from './vehicles.service.js';
import type { VehicleView } from './vehicles.view.js';

// "Every change is written to the audit log" (V2-30, ADR-24) for the cars and the extra services: the action, the record, and the
// NAMES of the fields that were sent, never their values. The services are replaced by ones that answer, so this is only about
// what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
const VEHICLE: VehicleView = {
  id: ID,
  plate: '34 NV 1001',
  year: 2025,
  status: 'ACTIVE',
  model: { slug: 'renault-clio', brand: 'Renault', model: 'Clio', retired: false },
  branch: { id: '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22', name: 'İstanbul Kadıköy', city: 'İstanbul', closed: false },
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};
const EXTRA: ExtraView = {
  slug: 'child-seat',
  name: { tr: 'Çocuk koltuğu', en: 'Child seat' },
  price: 15000,
  pricing: 'PER_DAY',
  updatedAt: '2026-10-29T10:00:00.000Z',
};
const vehicles = {
  list: async () => ({ items: [VEHICLE], total: 1, page: 1, pageSize: 20 }),
  get: async () => ({ ...VEHICLE, usage: { reservations: 0, holds: 0 } }),
  create: async () => VEHICLE,
  update: async () => VEHICLE,
};
const extras = { list: async () => [EXTRA], get: async () => EXTRA, update: async () => EXTRA };

describe('vehicles and extra services in the audit log (V2-30)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(VehiclesService)
      .useValue(vehicles)
      .overrideProvider(ExtrasService)
      .useValue(extras)
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

  it('adding and changing a car, and changing an extra, each leave one row: action, record, only the field names', async () => {
    const { cookie, id } = await administrator();

    expect((await call('POST', '/admin/vehicles', { cookie, body: { plate: '34 NV 1001', year: 2025, modelSlug: 'renault-clio', branchId: VEHICLE.branch.id } })).status).toBe(201);
    expect((await call('PATCH', `/admin/vehicles/${ID}`, { cookie, body: { updatedAt: VEHICLE.updatedAt, active: false } })).status).toBe(200);
    expect((await call('PATCH', '/admin/extras/Child-Seat', { cookie, body: { updatedAt: EXTRA.updatedAt, price: 17500 } })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(3);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'vehicle.create', entity: 'vehicle', entityId: ID, fields: ['plate', 'year', 'modelSlug', 'branchId'] });
    expect(fake.auditLogs[1]).toMatchObject({ action: 'vehicle.update', entity: 'vehicle', entityId: ID, fields: ['updatedAt', 'active'] });
    // The address in the path is written the way it is stored, whatever case it came in.
    expect(fake.auditLogs[2]).toMatchObject({ action: 'extra.update', entity: 'extra', entityId: 'child-seat', fields: ['updatedAt', 'price'] });
    // Names only: not the plate, not the price.
    expect(JSON.stringify(fake.auditLogs)).not.toContain('NV 1001');
    expect(JSON.stringify(fake.auditLogs)).not.toContain('17500');
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/vehicles', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/vehicles/${ID}`, { cookie })).status).toBe(200);
    expect((await call('GET', '/admin/extras', { cookie })).status).toBe(200);
    expect((await call('GET', '/admin/extras/child-seat', { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
