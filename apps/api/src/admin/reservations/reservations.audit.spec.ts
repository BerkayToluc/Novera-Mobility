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
import { AdminReservationsService } from './reservations.service.js';
import type { ReservationDetail } from './reservations.view.js';

// "Every change is written to the audit log" (V2-31, ADR-24) for a cancellation: the action, the booking number, and the NAMES of
// the fields that were sent, never their values. The reason is written on the booking itself, not in the audit log, and the
// customer's name and e-mail are not in it either. The service is replaced by one that answers, so this is only about what the
// interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const NUMBER = 'NVR-2026-00123';
const DETAIL: ReservationDetail = {
  id: '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11',
  number: NUMBER,
  status: 'CANCELLED',
  startAt: '2026-11-10T10:00:00.000Z',
  endAt: '2026-11-12T10:00:00.000Z',
  createdAt: '2026-10-29T10:00:00.000Z',
  cancelledAt: '2026-10-30T10:00:00.000Z',
  customer: { name: 'Ayşe Yılmaz', email: 'ayse@example.com' },
  vehicle: { plate: '34 NV 1001', brand: 'Renault', model: 'Clio' },
  pickupBranch: { id: 'b1', name: 'Kadıköy', city: 'İstanbul' },
  returnBranch: { id: 'b1', name: 'Kadıköy', city: 'İstanbul' },
  total: { amount: 200000, currency: 'TRY' },
  days: 2,
  customerAccount: { type: 'INDIVIDUAL', companyName: null },
  price: {
    currency: 'TRY',
    exchangeRate: 1,
    days: 2,
    lines: [],
    total: { amount: 200000, currency: 'TRY' },
    promo: null,
    pointsUsed: 0,
    payable: { amount: 200000, currency: 'TRY' },
  },
  pointsEarned: 0,
  cancellation: { at: '2026-10-30T10:00:00.000Z', reason: 'Müşteri aradı', by: null },
  cancellable: false,
};
const service = {
  list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }),
  get: async () => DETAIL,
  cancel: async () => DETAIL,
};

describe('bookings in the audit log (V2-31)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminReservationsService)
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
        'X-Forwarded-For': `10.8.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
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

  it('a cancellation leaves one row: action, booking number, only the field name', async () => {
    const { cookie, id } = await administrator();
    expect((await call('POST', `/admin/reservations/${NUMBER.toLowerCase()}/cancel`, { cookie, body: { reason: 'Müşteri aradı, istemiyor' } })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(1);
    // The number in the path is written the way it is stored, whatever case it came in.
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'reservation.cancel', entity: 'reservation', entityId: NUMBER, fields: ['reason'] });
    // Names only: not the reason, and nothing about the customer.
    expect(JSON.stringify(fake.auditLogs)).not.toContain('Müşteri aradı');
    expect(JSON.stringify(fake.auditLogs)).not.toContain('ayse@example.com');
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/reservations', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/reservations/${NUMBER}`, { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
