import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';
import { DAY_MS, daysAhead } from './dates.testing.js';

// Shared set-up of reservations.service.spec.ts (V2-13, QUALITY M-04): the fake database and the fixtures, moved out so the spec itself is only the cases.
// Birim testi: veritabanı bellekte taklit edilir. Gerçek kilit (FOR UPDATE) ve benzersizlik
// kısıtı için gerçek PostgreSQL gerekir; onlar reservations.integration.spec.ts'te.
export type Row = Record<string, any>;

export const IDS = {
  vehicle: '11111111-1111-4111-8111-111111111111',
  other: '11111111-1111-4111-8111-222222222222',
  pickup: '22222222-2222-4222-8222-222222222222',
  dropoff: '33333333-3333-4333-8333-333333333333',
  hold: '55555555-5555-4555-8555-555555555555',
  user: '66666666-6666-4666-8666-666666666666',
};
export const START_DATE = daysAhead(30);
export const START = START_DATE.toISOString();
export const END = new Date(START_DATE.getTime() + 3 * DAY_MS).toISOString(); // 3 gün
export const CLIENT = 'client-key-1';
export const startPlus = (days: number) => new Date(START_DATE.getTime() + days * DAY_MS);
export const user = { id: IDS.user, accountType: 'INDIVIDUAL' } as unknown as UserRow;
export const corporate = { id: IDS.user, accountType: 'CORPORATE' } as unknown as UserRow;

export const base = {
  vehicleId: IDS.vehicle,
  pickupBranchId: IDS.pickup,
  returnBranchId: IDS.dropoff,
  startAt: START,
  endAt: END,
  currency: 'TRY',
};

export class FakeDb {
  classRow = { slug: 'orta', nameTr: 'Orta', nameEn: 'Mid' };
  vehicles: Row[] = [
    {
      id: IDS.vehicle,
      active: true,
      branchId: IDS.pickup,
      vehicleModel: {
        slug: 'toyota-corolla',
        brand: 'Toyota',
        model: 'Corolla',
        dailyPrice: 125000,
        seats: 5,
        bags: 3,
        transmission: 'AUTOMATIC',
        fuelType: 'HYBRID',
        consumption: 4.5,
        consumptionUnit: 'L_PER_100KM',
        description: { tr: 'a', en: 'b' },
        imageUrl: null,
        class: this.classRow,
      },
    },
  ];
  extras: Row[] = [
    {
      id: 'e1',
      slug: 'cocuk-koltugu',
      nameTr: 'Çocuk koltuğu',
      nameEn: 'Child seat',
      price: 12345,
      pricing: 'PER_DAY',
    },
    { id: 'e2', slug: 'ek-surucu', nameTr: 'Ek sürücü', nameEn: 'Additional driver', price: 50000, pricing: 'FIXED' },
  ];
  rates: Row[] = [{ currency: 'EUR', ratePerTry: '0.02500000' }];
  branches = [IDS.pickup, IDS.dropoff];
  reservations: Row[] = [];
  holds: Row[] = [];
  points: Row[] = [];
  locks = 0;
  serial = 0;
  numbers = 0;

  $transaction = async (fn: (tx: any) => Promise<any>) => {
    const snapshot = JSON.stringify([this.reservations, this.holds, this.points], (_k, v) => v);
    void snapshot;
    return fn(this);
  };
  // The number comes from a database sequence, the branches are locked for sharing as the last lock (V2-27, none of the
  // ones this fake knows is closed), and the other raw queries are row locks.
  $queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
    const text = strings.join('');
    if (text.includes('nextval')) {
      this.numbers += 1;
      return [{ serial: BigInt(this.numbers) }];
    }
    if (text.includes('"Branch"')) {
      return (values[0].values as string[]).filter((id) => this.branches.includes(id)).map((id) => ({ id }));
    }
    this.locks += 1;
    return [];
  };

  vehicle = { findUnique: async ({ where }: any) => this.vehicles.find((v) => v.id === where.id) ?? null };
  extra = {
    findMany: async ({ where }: any) => this.extras.filter((e) => where.slug.in.includes(e.slug)),
  };
  exchangeRate = {
    findUnique: async ({ where }: any) => this.rates.find((r) => r.currency === where.currency) ?? null,
  };
  branch = {
    findMany: async ({ where }: any) => this.branches.filter((id) => where.id.in.includes(id)).map((id) => ({ id })),
  };
  hold = {
    findUnique: async ({ where }: any) => this.holds.find((h) => h.id === where.id) ?? null,
    delete: async ({ where }: any) => {
      this.holds = this.holds.filter((h) => h.id !== where.id);
    },
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
  pointTransaction = {
    create: async ({ data }: any) => {
      this.points.push({ ...data, createdAt: new Date('2031-01-01T00:00:00Z'), id: `p${this.points.length}` });
    },
    findMany: async ({ where }: any) =>
      this.points
        .filter((p) => p.userId === where.userId)
        .map((p) => ({ ...p, reservation: this.reservations.find((r) => r.id === p.reservationId) ?? null })),
  };
  reservation = {
    count: async ({ where }: any) =>
      where.userId
        ? this.reservations.filter(
            (r) => r.userId === where.userId && r.status === where.status && r.endAt > where.endAt.gt,
          ).length
        : this.reservations.filter(
            (r) =>
              r.vehicleId === where.vehicleId &&
              r.status === where.status &&
              r.startAt < where.startAt.lt &&
              r.endAt > where.endAt.gt,
          ).length,
    create: async ({ data }: any) => {
      this.serial += 1;
      const { extras, ...rest } = data;
      const row = {
        id: `res-${this.serial}`,
        createdAt: new Date(),
        ...rest,
        extraItems: extras.create,
      };
      this.reservations.push(row);
      return { id: row.id };
    },
    findUniqueOrThrow: async ({ where }: any) => this.hydrate(this.reservations.find((r) => r.id === where.id)!),
    findMany: async ({ where }: any) =>
      this.reservations
        .filter((r) => r.userId === where.userId)
        .filter((r) => !where.status || r.status === where.status)
        .filter((r) => !where.pointsUsed || r.pointsUsed > where.pointsUsed.gt)
        .sort((a, b) => b.startAt - a.startAt)
        .map((r) => this.hydrate(r)),
  };

  hydrate(r: Row) {
    const vehicle = this.vehicles.find((v) => v.id === r.vehicleId)!;
    const point = this.points.find((p) => p.reservationId === r.id);
    return {
      ...r,
      vehicle,
      pickupBranch: { id: r.pickupBranchId, name: 'A', city: 'İstanbul' },
      returnBranch: { id: r.returnBranchId, name: 'B', city: 'İzmir' },
      extras: (r.extraItems ?? []).map((item: Row) => ({
        ...item,
        extra: this.extras.find((e) => e.id === item.extraId),
      })),
      pointTransaction: point ? { points: point.points } : null,
    };
  }
}

export function build(db = new FakeDb()) {
  const prisma = db as unknown as PrismaService;
  const pricing = new PricingService(prisma);
  return { db, pricing, service: new ReservationsService(prisma, pricing) };
}

export async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu');
}
export const bodyOf = (e: HttpException) => e.getResponse() as { code: string; fieldErrors?: Record<string, string> };
