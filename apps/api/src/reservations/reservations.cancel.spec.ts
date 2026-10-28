import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

// Unit test for POST /me/reservations/{id}/cancel: the database is faked in memory.
type Row = Record<string, any>;

const NOW = new Date('2031-03-01T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const OWNER = 'owner-1';

function row(over: Row = {}): Row {
  return {
    id: 'r1',
    number: 'NVR-2031-00001',
    status: 'CONFIRMED',
    startAt: new Date(NOW.getTime() + 3 * DAY),
    endAt: new Date(NOW.getTime() + 6 * DAY),
    days: 3,
    currency: 'TRY',
    exchangeRate: 1,
    vehicleDailyPrice: 100000,
    totalPrice: 300000,
    pointsUsed: 0,
    createdAt: NOW,
    userId: OWNER,
    vehicle: {
      id: 'v1',
      vehicleModel: {
        slug: 'm',
        brand: 'B',
        model: 'M',
        seats: 5,
        bags: 3,
        transmission: 'AUTOMATIC',
        fuelType: 'PETROL',
        consumption: 5,
        consumptionUnit: 'L_PER_100KM',
        description: { tr: 't', en: 't' },
        imageUrl: null,
        class: { slug: 'c', nameTr: 'C', nameEn: 'C' },
      },
    },
    pickupBranch: { id: 'b1', name: 'P', city: 'X' },
    returnBranch: { id: 'b1', name: 'P', city: 'X' },
    extras: [],
    pointTransaction: { points: 3 },
    ...over,
  };
}

function setup(rows: Row[]) {
  const reservation = {
    updateMany: async ({ where, data }: Row) => {
      const hit = rows.filter(
        (r) =>
          r.id === where.id && r.userId === where.userId && r.status === where.status && r.startAt > where.startAt.gt,
      );
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    findFirst: async ({ where }: Row) => rows.find((r) => r.id === where.id && r.userId === where.userId) ?? null,
  };
  const prisma = { reservation } as unknown as PrismaService;
  return new ReservationsService(prisma, {} as PricingService);
}

async function failure(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected an HttpException');
}

describe('ReservationsService.cancel', () => {
  it('cancels an upcoming reservation: status CANCELLED and no points earned', async () => {
    const service = setup([row()]);
    const view = await service.cancel(OWNER, 'r1', NOW);
    expect(view.status).toBe('CANCELLED');
    expect(view.pointsEarned).toBe(0);
  });

  it('stores the moment of the cancellation, and a repeated call does not move it', async () => {
    const rows = [row()];
    const service = setup(rows);
    await service.cancel(OWNER, 'r1', NOW);
    expect(rows[0]!.cancelledAt).toEqual(NOW);
    await service.cancel(OWNER, 'r1', new Date(NOW.getTime() + 60_000));
    expect(rows[0]!.cancelledAt).toEqual(NOW);
  });

  it('is allowed less than 24 hours before the start too (the free window is information only)', async () => {
    const service = setup([row({ startAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000) })]);
    expect((await service.cancel(OWNER, 'r1', NOW)).status).toBe('CANCELLED');
  });

  it('calling it again returns the same cancelled reservation', async () => {
    const service = setup([row()]);
    await service.cancel(OWNER, 'r1', NOW);
    const again = await service.cancel(OWNER, 'r1', NOW);
    expect(again.status).toBe('CANCELLED');
  });

  it("someone else's or unknown reservation is 404 NOT_FOUND", async () => {
    const service = setup([row()]);
    const other = await failure(service.cancel('someone-else', 'r1', NOW));
    expect(other.getStatus()).toBe(404);
    expect((other.getResponse() as { code: string }).code).toBe('NOT_FOUND');
    expect((await failure(service.cancel(OWNER, 'nope', NOW))).getStatus()).toBe(404);
  });

  it('a rental that has started cannot be cancelled: 409 RESERVATION_NOT_CANCELLABLE, stays confirmed', async () => {
    const rows = [row({ startAt: new Date(NOW.getTime() - DAY) })];
    const service = setup(rows);
    const error = await failure(service.cancel(OWNER, 'r1', NOW));
    expect(error.getStatus()).toBe(409);
    expect((error.getResponse() as { code: string }).code).toBe('RESERVATION_NOT_CANCELLABLE');
    expect(rows[0]!.status).toBe('CONFIRMED');
  });
});
