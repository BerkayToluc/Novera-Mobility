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
import { VehicleModelsService } from './vehicle-models.service.js';
import type { ModelView } from './vehicle-models.view.js';

// "Every change is written to the audit log" (V2-29, ADR-24) for the vehicle models: the action, the model's address, and the
// NAMES of the fields that were sent, never their values. The service is replaced by one that answers, so this is only about
// what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const SLUG = 'renault-clio';
const VIEW: ModelView = {
  slug: SLUG,
  brand: 'Renault',
  model: 'Clio',
  class: { slug: 'ekonomik', name: { tr: 'Ekonomik', en: 'Economy' } },
  fuelType: 'PETROL',
  transmission: 'MANUAL',
  seats: 5,
  bags: 2,
  consumption: { value: 5.2, unit: 'L_PER_100KM' },
  dailyPrice: 80000,
  description: { tr: 'Şehir içi için', en: 'For the city' },
  imageUrl: '/fleet/renault-clio.webp',
  status: 'ACTIVE',
  retiredAt: null,
  activeVehicles: 3,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
};
const service = {
  classes: async () => [{ slug: 'ekonomik', name: { tr: 'Ekonomik', en: 'Economy' } }],
  list: async () => ({ items: [VIEW], total: 1, page: 1, pageSize: 20 }),
  get: async () => ({ ...VIEW, usage: { reservations: 0, holds: 0 } }),
  create: async () => VIEW,
  update: async () => VIEW,
  retire: async () => ({ ...VIEW, status: 'RETIRED' as const }),
  restore: async () => VIEW,
};

describe('vehicle models in the audit log (V2-29)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(VehicleModelsService)
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
        'X-Forwarded-For': `10.6.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
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

  it('creating, changing, retiring and putting back each leave one row: action, address, only the field names', async () => {
    const { cookie, id } = await administrator();

    expect((await call('POST', '/admin/vehicle-models', { cookie, body: { brand: 'Renault', model: 'Clio', dailyPrice: 80000 } })).status).toBe(201);
    expect((await call('PATCH', `/admin/vehicle-models/${SLUG.toUpperCase()}`, { cookie, body: { updatedAt: VIEW.updatedAt, dailyPrice: 99000 } })).status).toBe(200);
    expect((await call('POST', `/admin/vehicle-models/${SLUG}/retire`, { cookie })).status).toBe(200);
    expect((await call('POST', `/admin/vehicle-models/${SLUG}/restore`, { cookie })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(4);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'vehicle-model.create', entity: 'vehicle-model', entityId: SLUG, fields: ['brand', 'model', 'dailyPrice'] });
    // The address in the path is written the way it is stored, whatever case it came in.
    expect(fake.auditLogs[1]).toMatchObject({ action: 'vehicle-model.update', entity: 'vehicle-model', entityId: SLUG, fields: ['updatedAt', 'dailyPrice'] });
    expect(fake.auditLogs[2]).toMatchObject({ action: 'vehicle-model.retire', entityId: SLUG, fields: [] });
    expect(fake.auditLogs[3]).toMatchObject({ action: 'vehicle-model.restore', entityId: SLUG, fields: [] });
    // Names only: not the price.
    expect(JSON.stringify(fake.auditLogs)).not.toContain('99000');
    expect(JSON.stringify(fake.auditLogs)).not.toContain('80000');
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/vehicle-models', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/vehicle-models/${SLUG}`, { cookie })).status).toBe(200);
    expect((await call('GET', '/admin/vehicle-classes', { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
