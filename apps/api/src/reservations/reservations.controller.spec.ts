import 'reflect-metadata';
import { HttpException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { AuthService } from '../auth/auth.service.js';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../common/rate-limit.guard.js';
import { RateLimitService } from '../common/rate-limit.service.js';
import { RateLimitStore } from '../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../common/rate-limit.testing.js';
import { LIMITS } from '../common/rate-limits.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PricingService } from './pricing.service.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

const CREATE_LIMIT_PER_HOUR = LIMITS.reserve.limit;
const PRICE_LIMIT_PER_10_MIN = LIMITS.price.limit;
const PROMO_PRICE_LIMIT_PER_10_MIN = LIMITS.promo.limit;

// HTTP-level check of the routes under /me/reservations: the new one-reservation route must not swallow
// the list or the cancel route, and an unauthenticated call must be refused before the service is reached.
describe('/me/reservations routes', () => {
  let app: INestApplication;
  let base = '';
  let signedIn = true;
  const service = {
    listMine: jest.fn(async () => [{ id: 'r1' }, { id: 'r2' }]),
    getMine: jest.fn(async (_userId: string, id: string) => ({ id })),
    cancel: jest.fn(async (_userId: string, id: string) => ({ id, status: 'CANCELLED' })),
    create: jest.fn(async () => ({ id: 'new' })),
  };
  const pricing = { price: jest.fn(async () => ({ total: { amount: 1, currency: 'TRY' } })) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: service },
        { provide: PricingService, useValue: pricing },
        RateLimitService,
        { provide: RateLimitStore, useClass: MemoryRateLimitStore },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: AuthService, useValue: {} },
      ],
    })
      .overrideGuard(SessionGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => Record<string, unknown> } }) => {
          if (!signedIn) {
            throw new HttpException({ code: 'UNAUTHENTICATED', message: 'Sign in' }, 401);
          }
          context.switchToHttp().getRequest().user = { id: 'user-1' };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app, {});
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    signedIn = true;
    Object.values(service).forEach((fn) => fn.mockClear());
    pricing.price.mockClear();
  });

  it('GET /me/reservations is still the list', async () => {
    const response = await fetch(`${base}/me/reservations`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([{ id: 'r1' }, { id: 'r2' }]);
    expect(service.listMine).toHaveBeenCalledWith('user-1');
    expect(service.getMine).not.toHaveBeenCalled();
  });

  it('GET /me/reservations/{id} reads one reservation of the signed-in user', async () => {
    const response = await fetch(`${base}/me/reservations/abc`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'abc' });
    expect(service.getMine).toHaveBeenCalledWith('user-1', 'abc');
    expect(service.listMine).not.toHaveBeenCalled();
  });

  it('POST /me/reservations/{id}/cancel still cancels', async () => {
    const response = await fetch(`${base}/me/reservations/abc/cancel`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(service.cancel).toHaveBeenCalledWith('user-1', 'abc');
    expect(service.getMine).not.toHaveBeenCalled();
  });

  it('GET /me/reservations/{id} without a session is 401 and never reaches the service', async () => {
    signedIn = false;
    const response = await fetch(`${base}/me/reservations/abc`);
    expect(response.status).toBe(401);
    expect(service.getMine).not.toHaveBeenCalled();
  });

  // QUALITY G-02: booking takes no payment, so one account may not fire requests without end.
  const post = (path: string) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

  it('POST /reservations: the 11th request in an hour is 429 RATE_LIMITED and never reaches the service', async () => {
    for (let i = 0; i < CREATE_LIMIT_PER_HOUR; i += 1) {
      expect((await post('/reservations')).status).toBe(201);
    }
    const refused = await post('/reservations');
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { code: string }).code).toBe('RATE_LIMITED');
    expect(service.create).toHaveBeenCalledTimes(CREATE_LIMIT_PER_HOUR);
    // The service is told whose request it is, so it can tell whose hold the hold id names (QUALITY G-16).
    const [, , clientKey] = service.create.mock.calls[0] as unknown as [unknown, unknown, string];
    expect(clientKey).toMatch(/^[0-9a-f]{32}$/);
  });

  it('POST /reservations/price: the 61st request in ten minutes is 429', async () => {
    for (let i = 0; i < PRICE_LIMIT_PER_10_MIN; i += 1) {
      expect((await post('/reservations/price')).status).toBe(200);
    }
    const refused = await post('/reservations/price');
    expect(refused.status).toBe(429);
    expect(pricing.price).toHaveBeenCalledTimes(PRICE_LIMIT_PER_10_MIN);
  });

  // QUALITY G-04: guessing campaign codes goes through the price call, so a request that carries a code is limited much harder.
  it('POST /reservations/price with a campaign code: the 11th request in ten minutes is 429; one without a code is not counted', async () => {
    // The limits of the shared test address are spent by the tests above, so each group uses its own client address.
    const as = (ip: string) => (body: unknown) =>
      fetch(`${base}/reservations/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
        body: JSON.stringify(body),
      });
    const client = as('203.0.113.7');
    for (let i = 0; i < PROMO_PRICE_LIMIT_PER_10_MIN; i += 1) {
      expect((await client({ promoCode: `CODE${i}` })).status).toBe(200);
    }
    const refused = await client({ promoCode: 'ONE-TOO-MANY' });
    expect(refused.status).toBe(429);
    expect(((await refused.json()) as { code: string }).code).toBe('RATE_LIMITED');
    // A price request without a code is still fine for this client, and another client is not affected.
    expect((await client({})).status).toBe(200);
    expect((await as('203.0.113.8')({ promoCode: 'FIRST' })).status).toBe(200);
  });
});
