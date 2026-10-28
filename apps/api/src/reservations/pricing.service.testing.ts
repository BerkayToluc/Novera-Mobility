import { HttpException } from '@nestjs/common';
import { DAY_MS, daysAhead } from './dates.testing.js';

// Shared set-up of pricing.service.spec.ts (V2-13, QUALITY M-04): the fake database and the fixtures, moved out so the spec itself is only the cases.
// Birim testi: veritabanı bellekte taklit edilir (gerçek PostgreSQL gerekmez).
export type Row = Record<string, any>;

export const IDS = {
  vehicle: '11111111-1111-4111-8111-111111111111',
  vehicle2: '11111111-1111-4111-8111-222222222222',
  pickup: '22222222-2222-4222-8222-222222222222',
  dropoff: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
  hold: '55555555-5555-4555-8555-555555555555',
};
export const START_DATE = daysAhead(30);
export const START = START_DATE.toISOString();
export const END = new Date(START_DATE.getTime() + 3 * DAY_MS).toISOString(); // 3 gün
export const startPlus = (days: number) => new Date(START_DATE.getTime() + days * DAY_MS);

export class FakeDb {
  vehicles: Row[] = [
    {
      id: IDS.vehicle,
      active: true,
      branchId: IDS.pickup,
      vehicleModel: { slug: 'toyota-corolla', brand: 'Toyota', model: 'Corolla', dailyPrice: 125000 },
    },
    {
      id: IDS.vehicle2,
      active: false,
      branchId: IDS.pickup,
      vehicleModel: { slug: 'fiat-egea', brand: 'Fiat', model: 'Egea', dailyPrice: 90000 },
    },
  ];
  extras: Row[] = [
    { slug: 'cocuk-koltugu', nameTr: 'Çocuk koltuğu', nameEn: 'Child seat', price: 12345, pricing: 'PER_DAY' },
    { slug: 'ek-surucu', nameTr: 'Ek sürücü', nameEn: 'Additional driver', price: 50000, pricing: 'FIXED' },
  ];
  rates: Row[] = [{ currency: 'EUR', ratePerTry: '0.02300000' }];
  promoCodes: Row[] = [
    {
      code: 'NOVERA10',
      percent: 10,
      active: true,
      validFrom: null,
      validUntil: null,
      maxRedemptions: null,
      oncePerUser: true,
    },
    {
      code: 'HOSGELDIN',
      percent: 5,
      active: true,
      validFrom: null,
      validUntil: null,
      maxRedemptions: null,
      oncePerUser: true,
    },
  ];
  branches = [IDS.pickup, IDS.dropoff];
  reservations: Row[] = [];
  holds: Row[] = [];

  vehicle = {
    findUnique: async ({ where }: any) => this.vehicles.find((v) => v.id === where.id) ?? null,
  };
  extra = {
    findMany: async ({ where }: any) => this.extras.filter((e) => where.slug.in.includes(e.slug)),
  };
  promoCode = {
    findUnique: async ({ where }: any) => this.promoCodes.find((c) => c.code === where.code) ?? null,
  };
  exchangeRate = {
    findUnique: async ({ where }: any) => this.rates.find((r) => r.currency === where.currency) ?? null,
  };
  branch = {
    findMany: async ({ where }: any) => this.branches.filter((id) => where.id.in.includes(id)).map((id) => ({ id })),
  };
  reservation = {
    count: async ({ where }: any) =>
      where.promoCode !== undefined
        ? this.reservations.filter(
            (r) =>
              r.promoCode === where.promoCode &&
              r.status === where.status &&
              (where.userId === undefined || r.userId === where.userId),
          ).length
        : this.reservations.filter(
            (r) =>
              r.vehicleId === where.vehicleId &&
              r.status === where.status &&
              r.startAt < where.startAt.lt &&
              r.endAt > where.endAt.gt,
          ).length,
  };
  hold = {
    count: async ({ where }: any) =>
      this.holds.filter(
        (h) =>
          h.vehicleId === where.vehicleId &&
          h.expiresAt > where.expiresAt.gt &&
          h.startAt < where.startAt.lt &&
          h.endAt > where.endAt.gt &&
          (!where.id?.not || h.id !== where.id.not),
      ).length,
  };
}

export async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}
export type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
export const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

export const base = {
  vehicleId: IDS.vehicle,
  pickupBranchId: IDS.pickup,
  returnBranchId: IDS.dropoff,
  startAt: START,
  endAt: END,
  currency: 'TRY',
};
