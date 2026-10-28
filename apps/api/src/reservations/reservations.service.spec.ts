import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from './pricing.service.js';
import { pointsForTotal } from './points.rules.js';
import { MAX_ACTIVE_RESERVATIONS, ReservationsService } from './reservations.service.js';
import { DAY_MS, daysAhead, slotBefore } from './dates.testing.js';

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
const START_DATE = daysAhead(30);
const START = START_DATE.toISOString();
const END = new Date(START_DATE.getTime() + 3 * DAY_MS).toISOString(); // 3 gün
const CLIENT = 'client-key-1';
const startPlus = (days: number) => new Date(START_DATE.getTime() + days * DAY_MS);
const user = { id: IDS.user, accountType: 'INDIVIDUAL' } as unknown as UserRow;
const corporate = { id: IDS.user, accountType: 'CORPORATE' } as unknown as UserRow;

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
  locks = 0;
  serial = 0;
  numbers = 0;

  $transaction = async (fn: (tx: any) => Promise<any>) => {
    const snapshot = JSON.stringify([this.reservations, this.holds, this.points], (_k, v) => v);
    void snapshot;
    return fn(this);
  };
  // The number comes from a database sequence; the other raw queries are row locks.
  $queryRaw = async (strings: TemplateStringsArray) => {
    if (strings.join('').includes('nextval')) {
      this.numbers += 1;
      return [{ serial: BigInt(this.numbers) }];
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

function build(db = new FakeDb()) {
  const prisma = db as unknown as PrismaService;
  const pricing = new PricingService(prisma);
  return { db, pricing, service: new ReservationsService(prisma, pricing) };
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
    expect(db.locks).toBe(2); // vehicle, then account
    expect(db.points).toHaveLength(1);
  });

  it('numaralar sırayla artar', async () => {
    const { service } = build();
    const first = await service.create(user, base);
    const second = await service.create(user, { ...base, startAt: startPlus(31).toISOString(), endAt: startPlus(32).toISOString() });
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
      clientKey: CLIENT,
    });
    const blocked = await catchHttp(service.create(user, base, CLIENT));
    expect(bodyOf(blocked).code).toBe('VEHICLE_UNAVAILABLE');

    const result = await service.create(user, { ...base, holdId: IDS.hold }, CLIENT);
    expect(result.status).toBe('CONFIRMED');
    expect(db.holds).toHaveLength(0);
  });

  it('süresi dolmuş tutma sorun olmaz, araç boşsa devam edilir', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.vehicle, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2000-01-01T00:00:00Z'),
      clientKey: CLIENT,
    });
    const result = await service.create(user, { ...base, holdId: IDS.hold }, CLIENT);
    expect(result.status).toBe('CONFIRMED');
  });

  it('başka araca ait tutma id\'si kendi tutması sayılmaz ve silinmez', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.other, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2999-01-01T00:00:00Z'),
      clientKey: CLIENT,
    });
    await service.create(user, { ...base, holdId: IDS.hold }, CLIENT);
    expect(db.holds).toHaveLength(1);
  });

  // QUALITY G-16: a hold id is not a key to someone else's hold.
  it('another client\'s hold is no hold: the car stays unavailable and the hold stays', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.vehicle, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2999-01-01T00:00:00Z'),
      clientKey: CLIENT,
    });
    const error = await catchHttp(service.create(user, { ...base, holdId: IDS.hold }, 'someone-else'));
    expect(error.getStatus()).toBe(409);
    expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    expect(db.holds).toHaveLength(1);
    expect(db.reservations).toHaveLength(0);
  });

  it('a hold without a client key (made before keys were stored) belongs to nobody', async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold, vehicleId: IDS.vehicle, pickupBranchId: IDS.pickup, returnBranchId: IDS.dropoff,
      startAt: new Date(START), endAt: new Date(END), expiresAt: new Date('2999-01-01T00:00:00Z'),
      clientKey: null,
    });
    const error = await catchHttp(service.create(user, { ...base, holdId: IDS.hold }, null));
    expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
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

// QUALITY G-02: no payment is taken, so the number of upcoming bookings per account is capped.
describe('upcoming reservation cap', () => {
  const bookAt = (service: ReservationsService, days: number, vehicleId = IDS.vehicle) =>
    service.create(user, {
      ...base, vehicleId, startAt: startPlus(days).toISOString(), endAt: startPlus(days + 1).toISOString(),
    });

  it('allows MAX_ACTIVE_RESERVATIONS bookings and refuses the next with 422 RESERVATION_LIMIT', async () => {
    const { service, db } = build();
    for (let i = 0; i < MAX_ACTIVE_RESERVATIONS; i += 1) await bookAt(service, 10 + 2 * i);
    const error = await catchHttp(bookAt(service, 40));
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).code).toBe('RESERVATION_LIMIT');
    expect(db.reservations).toHaveLength(MAX_ACTIVE_RESERVATIONS);
    expect(db.points).toHaveLength(MAX_ACTIVE_RESERVATIONS);
  });

  it('cancelling one frees a place', async () => {
    const { service, db } = build();
    for (let i = 0; i < MAX_ACTIVE_RESERVATIONS; i += 1) await bookAt(service, 10 + 2 * i);
    db.reservations[0]!.status = 'CANCELLED';
    await expect(bookAt(service, 40)).resolves.toMatchObject({ status: 'CONFIRMED' });
  });

  it('a finished rental does not count, and another account\'s bookings do not either', async () => {
    const { service, db } = build();
    for (let i = 0; i < MAX_ACTIVE_RESERVATIONS; i += 1) await bookAt(service, 10 + 2 * i);
    db.reservations[0]!.endAt = new Date('2020-01-02T00:00:00Z');
    await expect(bookAt(service, 40)).resolves.toBeDefined();
    const other = { id: 'other-user', accountType: 'INDIVIDUAL' } as unknown as UserRow;
    await expect(
      service.create(other, { ...base, startAt: startPlus(60).toISOString(), endAt: startPlus(61).toISOString() }),
    ).resolves.toBeDefined();
  });
});

describe('start time (G-01)', () => {
  it('a booking that starts in the past is refused with IN_PAST and writes nothing', async () => {
    const { service, db } = build();
    const start = daysAhead(-10);
    const error = await catchHttp(
      service.create(user, { ...base, startAt: start.toISOString(), endAt: new Date(start.getTime() + 3 * DAY_MS).toISOString() }),
    );
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).fieldErrors).toEqual({ startAt: 'IN_PAST' });
    expect(db.reservations).toHaveLength(0);
    expect(db.points).toHaveLength(0);
  });

  it('a start closer than one slot is refused too', async () => {
    const { service } = build();
    const start = slotBefore(30);
    const error = await catchHttp(
      service.create(user, { ...base, startAt: start.toISOString(), endAt: new Date(start.getTime() + DAY_MS).toISOString() }),
    );
    expect(bodyOf(error).fieldErrors).toEqual({ startAt: 'IN_PAST' });
  });
});

describe('listMine ve points', () => {
  it('yalnız kendi rezervasyonlarını yeniden eskiye döndürür', async () => {
    const { service, db } = build();
    await service.create(user, base);
    await service.create(user, { ...base, startAt: startPlus(61).toISOString(), endAt: startPlus(62).toISOString() });
    db.reservations.push({ ...db.reservations[0], id: 'x', userId: 'someone-else' });
    const list = await service.listMine(IDS.user);
    expect(list).toHaveLength(2);
    expect(list[0]!.startAt > list[1]!.startAt).toBe(true);
  });

  it('puan: biten kiralama bakiyeye, bitmeyen pending\'e gider; iptal sayılmaz', async () => {
    const { service, db } = build();
    await service.create(user, base); // 3750 TL → 37 puan, START'tan 3 gün sonra biter
    const before = await service.points(IDS.user, startPlus(-9));
    expect(before).toMatchObject({ balance: 0, pending: 37, history: [] });
    expect(before.rules.tr).toContain('₺100');

    const after = await service.points(IDS.user, startPlus(4));
    expect(after.balance).toBe(37);
    expect(after.pending).toBe(0);
    expect(after.history).toEqual([
      { points: 37, reservationNumber: expect.stringMatching(/^NVR-/), createdAt: END },
    ]);

    db.reservations[0]!.status = 'CANCELLED';
    const cancelled = await service.points(IDS.user, startPlus(4));
    expect(cancelled).toMatchObject({ balance: 0, pending: 0, history: [] });
  });
});

describe('points of a booking made after its own start (G-01)', () => {
  it('never reach the balance, even once the rental has ended', async () => {
    const { service, db } = build();
    db.reservations.push({
      id: 'late', number: 'LATE-1', status: 'CONFIRMED', userId: IDS.user, vehicleId: IDS.other,
      startAt: new Date('2020-01-01T10:00:00Z'), endAt: new Date('2021-01-01T10:00:00Z'), pointsUsed: 0,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
    db.points.push({ id: 'late-p', userId: IDS.user, reservationId: 'late', points: 365, createdAt: new Date('2026-10-01T00:00:00Z') });
    const points = await service.points(IDS.user, new Date('2026-10-24T00:00:00Z'));
    expect(points).toMatchObject({ balance: 0, pending: 0, history: [] });
  });
});

// Points payment (SPEC §2.3): 1 point = ₺5, at most half of the total, individual accounts and TRY only.
function seedBalance(db: FakeDb, points: number) {
  db.reservations.push({
    id: 'seed', number: 'SEED-1', status: 'CONFIRMED', userId: IDS.user, vehicleId: IDS.other,
    startAt: new Date('2020-01-01T10:00:00Z'), endAt: new Date('2020-01-04T10:00:00Z'), pointsUsed: 0,
    createdAt: new Date('2020-01-01T00:00:00Z'),
  });
  db.points.push({ id: 'seed-p', userId: IDS.user, reservationId: 'seed', points, createdAt: new Date('2020-01-04T10:00:00Z') });
}
const AFTER = startPlus(22);

describe('paying with points', () => {
  it('spends the balance: ₺3.750 total, 100 points = ₺500 off, earns on the money paid', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    const view = await service.create(user, { ...base, usePoints: true });
    expect(view.price.total.amount).toBe(375000);
    expect(view.price.pointsUsed).toBe(100);
    expect(view.price.payable.amount).toBe(325000);
    expect(db.reservations.find((r) => r.id === view.id)!.pointsUsed).toBe(100);
    // ₺3.250 paid in money → 32 points (not 37).
    expect(view.pointsEarned).toBe(32);
  });

  it('is capped at half of the total even when the balance is larger', async () => {
    const { service, db } = build();
    seedBalance(db, 1000);
    const view = await service.create(user, { ...base, usePoints: true });
    expect(view.price.pointsUsed).toBe(375);
    expect(view.price.payable.amount).toBe(187500);
  });

  it('the spent points leave the balance at once and show as a negative history entry', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    await service.create(user, { ...base, usePoints: true });
    const points = await service.points(IDS.user, AFTER);
    expect(points.balance).toBe(32); // 100 - 100 spent + 32 earned (rental ended)
    expect(points.history.map((h) => h.points).sort((a, b) => a - b)).toEqual([-100, 32, 100]);
  });

  it('with nothing left to spend, no points are used and the full total is payable', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    await service.create(user, { ...base, usePoints: true });
    const second = await service.create(user, {
      ...base, usePoints: true, startAt: startPlus(61).toISOString(), endAt: startPlus(64).toISOString(),
    });
    expect(second.price.pointsUsed).toBe(0);
    expect(second.price.payable.amount).toBe(second.price.total.amount);
  });

  it('cancelling gives the spent points back', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    const view = await service.create(user, { ...base, usePoints: true });
    db.reservations.find((r) => r.id === view.id)!.status = 'CANCELLED';
    const points = await service.points(IDS.user, AFTER);
    expect(points.balance).toBe(100);
    expect(points.history.map((h) => h.points)).toEqual([100]);
  });

  it('without usePoints nothing is spent', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    const view = await service.create(user, base);
    expect(view.price.pointsUsed).toBe(0);
    expect(view.price.payable.amount).toBe(view.price.total.amount);
    expect(view.pointsEarned).toBe(37);
  });

  it('a corporate account or a non-TRY reservation is refused: 422 usePoints NOT_ALLOWED', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    const corp = await catchHttp(service.create(corporate, { ...base, usePoints: true }));
    expect(corp.getStatus()).toBe(422);
    expect(bodyOf(corp).fieldErrors).toEqual({ usePoints: 'NOT_ALLOWED' });
    const eur = await catchHttp(service.create(user, { ...base, currency: 'EUR', usePoints: true }));
    expect(bodyOf(eur).fieldErrors).toEqual({ usePoints: 'NOT_ALLOWED' });
    expect(db.reservations.filter((r) => r.id !== 'seed')).toHaveLength(0);
  });

  it('usePoints must be a boolean', async () => {
    const { service } = build();
    const error = await catchHttp(service.create(user, { ...base, usePoints: 'yes' }));
    expect(bodyOf(error).fieldErrors).toEqual({ usePoints: 'INVALID_FORMAT' });
  });

  it('the account is locked while spending (vehicle lock + account lock)', async () => {
    const { service, db } = build();
    seedBalance(db, 100);
    await service.create(user, { ...base, usePoints: true });
    expect(db.locks).toBe(2);
  });

  it('price: needs a session with usePoints (401), then shows points and what is payable', async () => {
    const { pricing, db } = build();
    seedBalance(db, 100);
    const anonymous = await catchHttp(pricing.price({ ...base, usePoints: true }, null));
    expect(anonymous.getStatus()).toBe(401);
    const view = await pricing.price({ ...base, usePoints: true }, user);
    expect(view.pointsUsed).toBe(100);
    expect(view.payable.amount).toBe(325000);
    const plain = await pricing.price(base, null);
    expect(plain.pointsUsed).toBe(0);
    expect(plain.payable.amount).toBe(plain.total.amount);
  });
});