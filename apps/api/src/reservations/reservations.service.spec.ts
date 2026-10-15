import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from './pricing.service.js';
import { pointsForTotal } from './points.rules.js';
import { ReservationsService } from './reservations.service.js';

// Birim testi: veritabanı bellekte taklit edilir. Gerçek kilit (FOR UPDATE) ve benzersizlik
// kısıtı için gerçek PostgreSQL gerekir; onlar reservations.integration.spec.ts'te.
type Row = Record<string, any>;

const IDS = {
  vehicle: '11111111-1111-4111-8111-111111111111',
  other: '11111111-1111-4111-8111-222222222222',
  pickup: '22222222-2222-4222-8222-222222222222',
  dropoff: '33333333-3333-4333-8333-333333333333',
  hold: '55555555-5555-4555-8555-555555555555',
  user: '66666666-6666-4666-8666-666666666666',
};
const START = '2031-03-10T10:00:00.000Z';
const END = '2031-03-13T10:00:00.000Z'; // 3 gün
const user = { id: IDS.user } as unknown as UserRow;

const base = {
  vehicleId: IDS.vehicle,
  pickupBranchId: IDS.pickup,
  returnBranchId: IDS.dropoff,
  startAt: START,
  endAt: END,
  currency: 'TRY',
};

class FakeDb {
  classRow = { slug: 'orta', nameTr: 'Orta', nameEn: 'Mid' };
  vehicles: Row[] = [
    {
      id: IDS.vehicle,
      active: true,
      branchId: IDS.pickup,
      vehicleModel: {
        slug: 'toyota-corolla', brand: 'Toyota', model: 'Corolla', dailyPrice: 125000, seats: 5, bags: 3,
        transmission: 'AUTOMATIC', fuelType: 'HYBRID', consumption: 4.5, consumptionUnit: 'L_PER_100KM',
        description: { tr: 'a', en: 'b' }, imageUrl: null, class: this.classRow,
      },
    },
  ];
  extras: Row[] = [
    { id: 'e1', slug: 'cocuk-koltugu', nameTr: 'Çocuk koltuğu', nameEn: 'Child seat', price: 12345, pricing: 'PER_DAY' },
    { id: 'e2', slug: 'ek-surucu', nameTr: 'Ek sürücü', nameEn: 'Additional driver', price: 50000, pricing: 'FIXED' },
  ];
  rates: Row[] = [{ currency: 'EUR', ratePerTry: '0.02500000' }];
  branches = [IDS.pickup, IDS.dropoff];
  reservations: Row[] = [];
  holds: Row[] = [];
  points: Row[] = [];
  failNumbers = 0; // bu kadar kez benzersizlik ihlali at
  locks = 0;
  serial = 0;

  $transaction = async (fn: (tx: any) => Promise<any>) => {
    const snapshot = JSON.stringify([this.reservations, this.holds, this.points], (_k, v) => v);
    void snapshot;
    return fn(this);
  };
  $queryRaw = async () => {
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
      this.reservations.filter(
        (r) =>
          r.vehicleId === where.vehicleId &&
          r.status === where.status &&
          r.startAt < where.startAt.lt &&
          r.endAt > where.endAt.gt,
      ).length,
    findFirst: async () => {
      const sorted = [...this.reservations].sort((a, b) => b.number.localeCompare(a.number));
      return sorted[0] ? { number: sorted[0].number } : null;
    },
    create: async ({ data }: any) => {
      if (this.failNumbers > 0) {
        this.failNumbers -= 1;
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      this.serial += 1;
      const { extras, ...rest } = data;
      const row = {
        id: `res-${this.serial}`,
        createdAt: new Date('2031-01-01T00:00:00Z'),
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

function build(db = new FakeDb()) {
  const prisma = db as unknown as PrismaService;
  const pricing = new PricingService(prisma);
  return { db, service: new ReservationsService(prisma, pricing) };
}

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu');
}
const bodyOf = (e: HttpException) => e.getResponse() as { code: string; fieldErrors?: Record<string, string> };

describe('pointsForTotal', () => {
  it('her tam ₺100 için 1 puan, kalan puan getirmez', () => {
    expect(pointsForTotal(9_999, 'TRY', 1)).toBe(0);
    expect(pointsForTotal(10_000, 'TRY', 1)).toBe(1);
    expect(pointsForTotal(486_000, 'TRY', 1)).toBe(48);
  });
  it('başka para birimi TRY karşılığına çevrilir', () => {
    // 100 EUR cent'i * ... : 10 000 cent = 100 EUR, kur 0.025 → ₺4 000 → 40 puan
    expect(pointsForTotal(10_000, 'EUR', 0.025)).toBe(40);
  });
});

describe('ReservationsService.create', () => {
  it('rezervasyonu oluşturur, numara verir, fiyatı sunucu hesaplar, puan yazar', async () => {
    const { service, db } = build();
    const result = await service.create(user, {
      ...base,
      extras: [
        { slug: 'cocuk-koltugu', quantity: 2 },
        { slug: 'ek-surucu', quantity: 1 },
      ],
    });
    expect(result.number).toMatch(/^NVR-\d{4}-00001$/);
    expect(result.status).toBe('CONFIRMED');
    // 3 gün × 1250 + çocuk koltuğu 2 × 3 gün × 123,45 + ek sürücü 500 = 3750 + 740,70 + 500
    expect(result.price.total).toEqual({ amount: 375_000 + 74_070 + 50_000, currency: 'TRY' });
    expect(result.price.lines.map((l) => l.total.amount).reduce((a, b) => a + b, 0)).toBe(
      result.price.total.amount,
    );
    expect(result.price.lines[1]!.quantity).toBe(6);
    expect(result.pointsEarned).toBe(49); // 4990,70 TL → 49
    expect(result.pickupBranch.city).toBe('İstanbul');
    expect(db.locks).toBe(1);
    expect(db.points).toHaveLength(1);
  });

  it('numaralar sırayla artar', async () => {
    const { service } = build();
    const first = await service.create(user, base);
    const second = await service.create(user, { ...base, startAt: '2031-04-10T10:00:00.000Z', endAt: '2031-04-11T10:00:00.000Z' });
    expect(first.number.endsWith('00001')).toBe(true);
    expect(second.number.endsWith('00002')).toBe(true);
  });

  it('aynı aralığı ikinci kez almak 409 VEHICLE_UNAVAILABLE', async () => {
    const { service } = build();
    await service.create(user, base);
    const error = await catchHttp(service.create(user, base));
    expect(error.getStatus()).toBe(409);
    expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
  });

  it('başkasının tutması engeller, kendi tutması engellemez ve silinir', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.vehicle, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2999-01-01T00:00:00Z'),
    });
    const blocked = await catchHttp(service.create(user, base));
    expect(bodyOf(blocked).code).toBe('VEHICLE_UNAVAILABLE');

    const result = await service.create(user, { ...base, holdId: IDS.hold });
    expect(result.status).toBe('CONFIRMED');
    expect(db.holds).toHaveLength(0);
  });

  it('süresi dolmuş tutma sorun olmaz, araç boşsa devam edilir', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.vehicle, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2000-01-01T00:00:00Z'),
    });
    const result = await service.create(user, { ...base, holdId: IDS.hold });
    expect(result.status).toBe('CONFIRMED');
  });

  it('başka araca ait tutma id\'si kendi tutması sayılmaz ve silinmez', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.other, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2999-01-01T00:00:00Z'),
    });
    await service.create(user, { ...base, holdId: IDS.hold });
    expect(db.holds).toHaveLength(1);
  });

  it('numara çakışırsa (P2002) yeniden dener', async () => {
    const { service, db } = build();
    db.failNumbers = 2;
    const result = await service.create(user, base);
    expect(result.number.endsWith('00001')).toBe(true);
  });

  it('EUR rezervasyonda saklanan kurla puan hesaplanır', async () => {
    const { service } = build();
    const result = await service.create(user, { ...base, currency: 'EUR' });
    // 1250 TL × 0.025 = 31,25 EUR/gün → 3 gün 93,75 EUR (9375 cent) → /0.025 = ₺3750 → 37 puan
    expect(result.price.currency).toBe('EUR');
    expect(result.price.exchangeRate).toBe(0.025);
    expect(result.pointsEarned).toBe(37);
  });

  it('geçersiz istek 422, bilinmeyen bayi 422', async () => {
    const { service, db } = build();
    const invalid = await catchHttp(service.create(user, {}));
    expect(invalid.getStatus()).toBe(422);
    db.branches = [IDS.pickup];
    const unknown = await catchHttp(service.create(user, base));
    expect(bodyOf(unknown).fieldErrors).toEqual({ returnBranchId: 'UNKNOWN_REFERENCE' });
  });

  it('puan bu hata yüzünden yazılmaz: çakışmada puan kaydı oluşmaz', async () => {
    const { service, db } = build();
    await service.create(user, base);
    await catchHttp(service.create(user, base));
    expect(db.points).toHaveLength(1);
  });
});

describe('listMine ve points', () => {
  it('yalnız kendi rezervasyonlarını yeniden eskiye döndürür', async () => {
    const { service, db } = build();
    await service.create(user, base);
    await service.create(user, { ...base, startAt: '2031-05-10T10:00:00.000Z', endAt: '2031-05-11T10:00:00.000Z' });
    db.reservations.push({ ...db.reservations[0], id: 'x', userId: 'someone-else' });
    const list = await service.listMine(IDS.user);
    expect(list).toHaveLength(2);
    expect(list[0]!.startAt > list[1]!.startAt).toBe(true);
  });

  it('puan: biten kiralama bakiyeye, bitmeyen pending\'e gider; iptal sayılmaz', async () => {
    const { service, db } = build();
    await service.create(user, base); // 3750 TL → 37 puan, 2031'de biter
    const before = await service.points(IDS.user, new Date('2031-03-01T00:00:00Z'));
    expect(before).toMatchObject({ balance: 0, pending: 37, history: [] });
    expect(before.rules.tr).toContain('₺100');

    const after = await service.points(IDS.user, new Date('2031-03-14T00:00:00Z'));
    expect(after.balance).toBe(37);
    expect(after.pending).toBe(0);
    expect(after.history).toEqual([
      { points: 37, reservationNumber: expect.stringMatching(/^NVR-/), createdAt: END },
    ]);

    db.reservations[0]!.status = 'CANCELLED';
    const cancelled = await service.points(IDS.user, new Date('2031-03-14T00:00:00Z'));
    expect(cancelled).toMatchObject({ balance: 0, pending: 0, history: [] });
  });
});
