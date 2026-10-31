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
import { AdminContractsService } from './contracts.service.js';

// "Every change is written to the audit log" (V2-35, ADR-24) for contracts, fleet cars and readings: the action, the record, the company
// where the call or the answer has it, and only the NAMES of the fields that were sent. The service is replaced by one that answers, so
// this is only about what the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const COMPANY = '5d0c1c0e-6f3a-4a52-9c1e-0a1b2c3d4e01';
const CAR = '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22';
const NUMBER = 'SZL-2026-00007';
const CONTRACT = { id: 'c', number: NUMBER, company: { id: COMPANY, name: 'Ege Lojistik A.Ş.' } };
const service = {
  listForCompany: async () => ({ items: [] }),
  create: async () => CONTRACT,
  get: async () => CONTRACT,
  update: async () => CONTRACT,
  createVehicle: async () => ({ id: CAR }),
  updateVehicle: async () => ({ id: CAR }),
  addReading: async () => ({ id: 'r' }),
};

describe('contracts and fleet cars in the audit log (V2-35)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminContractsService)
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
  const call = (method: string, path: string, cookie?: string, body?: unknown) =>
    fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.40.${Math.floor(counter / 250)}.${(counter += 1) % 250}`, ...(cookie ? { Cookie: cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  async function administrator() {
    const registered = await call('POST', '/auth/register', undefined, { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true });
    const cookie = (registered.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('each change leaves one row, with the action, the record, the company and only the field names', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', `/admin/companies/${COMPANY}/contracts`, cookie, { productSlug: 'akilli-kurumsal-filo', monthlyFee: 4500000 })).status).toBe(201);
    expect((await call('PATCH', `/admin/contracts/${NUMBER}`, cookie, { updatedAt: '2026-10-31T10:00:00.000Z', monthlyFee: 5000000 })).status).toBe(200);
    expect((await call('POST', `/admin/contracts/${NUMBER}/vehicles`, cookie, { plate: '34 ABC 123', modelSlug: 'x' })).status).toBe(201);
    expect((await call('PATCH', `/admin/fleet-vehicles/${CAR}`, cookie, { updatedAt: '2026-10-31T10:00:00.000Z', returned: true })).status).toBe(200);
    expect((await call('POST', `/admin/fleet-vehicles/${CAR}/readings`, cookie, { km: 1200, fuelPercent: 50 })).status).toBe(201);

    expect(fake.auditLogs).toHaveLength(5);
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, companyId: COMPANY, action: 'contract.create', entity: 'contract', entityId: NUMBER, fields: ['productSlug', 'monthlyFee'] });
    expect(fake.auditLogs[1]).toMatchObject({ companyId: COMPANY, action: 'contract.update', entityId: NUMBER, fields: ['updatedAt', 'monthlyFee'] });
    expect(fake.auditLogs[2]).toMatchObject({ action: 'fleet-vehicle.create', entity: 'fleet-vehicle', entityId: CAR, fields: ['plate', 'modelSlug'] });
    expect(fake.auditLogs[3]).toMatchObject({ action: 'fleet-vehicle.update', entityId: CAR, fields: ['updatedAt', 'returned'] });
    expect(fake.auditLogs[4]).toMatchObject({ action: 'fleet-vehicle.reading', entityId: CAR, fields: ['km', 'fuelPercent'] });
    // The plate and the figures are values: not in the log.
    const written = JSON.stringify(fake.auditLogs);
    for (const value of ['34 ABC 123', '4500000', '1200']) expect(written).not.toContain(value);
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', `/admin/companies/${COMPANY}/contracts`, cookie)).status).toBe(200);
    expect((await call('GET', `/admin/contracts/${NUMBER}`, cookie)).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
