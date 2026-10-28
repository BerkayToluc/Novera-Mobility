import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

// Unit test for GET /me/reservations/{id}: the database is faked in memory.
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
    totalPrice: 324000,
    pointsUsed: 10,
    promoCode: null,
    promoPercent: null,
    discountAmount: 0,
    createdAt: NOW,
    userId: OWNER,
    vehicle: {
      id: 'v1',
      year: 2026,
      vehicleModel: {
        slug: 'toyota-corolla',
        brand: 'Toyota',
        model: 'Corolla',
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
    extras: [
      {
        quantity: 2,
        unitPrice: 12000,
        totalPrice: 24000,
        extra: { slug: 'cocuk-koltugu', nameTr: 'Çocuk koltuğu', nameEn: 'Child seat', pricing: 'PER_DAY' },
      },
    ],
    pointTransaction: { points: 3 },
    ...over,
  };
}

function setup(rows: Row[]) {
  const reservation = {
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

describe('ReservationsService.getMine', () => {
  it("returns the signed-in user's reservation in the same shape as the list", async () => {
    const service = setup([row()]);
    const view = await service.getMine(OWNER, 'r1');
    expect(view.id).toBe('r1');
    expect(view.number).toBe('NVR-2031-00001');
    expect(view.status).toBe('CONFIRMED');
    expect(view.pointsEarned).toBe(3);
  });

  it("carries the vehicle's year", async () => {
    const view = await setup([row()]).getMine(OWNER, 'r1');
    expect(view.vehicle.year).toBe(2026);
  });

  it('gives every price line its slug: the model on the vehicle line, the extra on an extra line', async () => {
    const view = await setup([row()]).getMine(OWNER, 'r1');
    expect(view.price.lines.map((line) => [line.type, line.slug])).toEqual([
      ['VEHICLE', 'toyota-corolla'],
      ['EXTRA', 'cocuk-koltugu'],
    ]);
  });

  it('states the points paid and what is left to pay in money', async () => {
    const view = await setup([row()]).getMine(OWNER, 'r1');
    expect(view.price.pointsUsed).toBe(10);
    // 10 points × ₺5 = ₺50 = 5 000 kuruş off 324 000.
    expect(view.price.payable).toEqual({ amount: 319000, currency: 'TRY' });
    expect(view.price.total).toEqual({ amount: 324000, currency: 'TRY' });
  });

  it('a cancelled reservation can be read too, and earns no points', async () => {
    const view = await setup([row({ status: 'CANCELLED' })]).getMine(OWNER, 'r1');
    expect(view.status).toBe('CANCELLED');
    expect(view.pointsEarned).toBe(0);
  });

  it("someone else's reservation is 404 NOT_FOUND, the same as an unknown one", async () => {
    const service = setup([row()]);
    const other = await failure(service.getMine('someone-else', 'r1'));
    expect(other.getStatus()).toBe(404);
    expect((other.getResponse() as { code: string }).code).toBe('NOT_FOUND');
    const unknown = await failure(service.getMine(OWNER, 'nope'));
    expect(unknown.getStatus()).toBe(404);
    expect(unknown.getResponse()).toEqual(other.getResponse());
  });

  it('shows the campaign code as a last, negative line, as it was when the booking was made', async () => {
    // 300 000 car + 24 000 extra = 324 000; 10% off = 32 400, so the stored total is 291 600.
    const view = await setup([
      row({ promoCode: 'NOVERA10', promoPercent: 10, discountAmount: 32400, totalPrice: 291600, pointsUsed: 0 }),
    ]).getMine(OWNER, 'r1');
    expect(view.price.lines.map((line) => [line.type, line.slug, line.total.amount])).toEqual([
      ['VEHICLE', 'toyota-corolla', 300000],
      ['EXTRA', 'cocuk-koltugu', 24000],
      ['DISCOUNT', 'NOVERA10', -32400],
    ]);
    expect(view.price.promo).toEqual({ code: 'NOVERA10', applied: true, percent: 10 });
    expect(view.price.total).toEqual({ amount: 291600, currency: 'TRY' });
    expect(view.price.lines.reduce((sum, line) => sum + line.total.amount, 0)).toBe(view.price.total.amount);
  });

  it('has no discount line and no promo when no code was used', async () => {
    const view = await setup([row()]).getMine(OWNER, 'r1');
    expect(view.price.promo).toBeNull();
    expect(view.price.lines.some((line) => line.type === 'DISCOUNT')).toBe(false);
  });
});
