import 'reflect-metadata';
import { HttpException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../app.setup.js';
import { AuthService } from '../auth/auth.service.js';
import { SessionGuard } from '../auth/session.guard.js';
import { PricingService } from './pricing.service.js';
import { ReservationsController } from './reservations.controller.js';
import { ReservationsService } from './reservations.service.js';

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
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        { provide: ReservationsService, useValue: service },
        { provide: PricingService, useValue: {} },
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
});
