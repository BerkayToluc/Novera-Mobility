import type { UserRow } from '../auth/user-view.js';
import { pointsForTotal } from './points.rules.js';
import { MAX_ACTIVE_RESERVATIONS, ReservationsService } from './reservations.service.js';
import { DAY_MS, daysAhead, slotBefore } from './dates.testing.js';
import {
  CLIENT,
  END,
  IDS,
  START,
  base,
  bodyOf,
  build,
  catchHttp,
  startPlus,
  user,
} from './reservations.service.testing.js';

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
    expect(result.price.lines.map((l) => l.total.amount).reduce((a, b) => a + b, 0)).toBe(result.price.total.amount);
    expect(result.price.lines[1]!.quantity).toBe(6);
    expect(result.pointsEarned).toBe(49); // 4990,70 TL → 49
    expect(result.pickupBranch.city).toBe('İstanbul');
    expect(db.locks).toBe(2); // vehicle, then account
    expect(db.points).toHaveLength(1);
  });

  it('numaralar sırayla artar', async () => {
    const { service } = build();
    const first = await service.create(user, base);
    const second = await service.create(user, {
      ...base,
      startAt: startPlus(31).toISOString(),
      endAt: startPlus(32).toISOString(),
    });
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
      id: IDS.hold,
      vehicleId: IDS.vehicle,
      pickupBranchId: IDS.pickup,
      returnBranchId: IDS.dropoff,
      startAt: new Date(START),
      endAt: new Date(END),
      expiresAt: new Date('2999-01-01T00:00:00Z'),
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
      id: IDS.hold,
      vehicleId: IDS.vehicle,
      pickupBranchId: IDS.pickup,
      returnBranchId: IDS.dropoff,
      startAt: new Date(START),
      endAt: new Date(END),
      expiresAt: new Date('2000-01-01T00:00:00Z'),
      clientKey: CLIENT,
    });
    const result = await service.create(user, { ...base, holdId: IDS.hold }, CLIENT);
    expect(result.status).toBe('CONFIRMED');
  });

  it("başka araca ait tutma id'si kendi tutması sayılmaz ve silinmez", async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold,
      vehicleId: IDS.other,
      pickupBranchId: IDS.pickup,
      returnBranchId: IDS.dropoff,
      startAt: new Date(START),
      endAt: new Date(END),
      expiresAt: new Date('2999-01-01T00:00:00Z'),
      clientKey: CLIENT,
    });
    await service.create(user, { ...base, holdId: IDS.hold }, CLIENT);
    expect(db.holds).toHaveLength(1);
  });

  // QUALITY G-16: a hold id is not a key to someone else's hold.
  it("another client's hold is no hold: the car stays unavailable and the hold stays", async () => {
    const { service, db } = build();
    db.holds.push({
      id: IDS.hold,
      vehicleId: IDS.vehicle,
      pickupBranchId: IDS.pickup,
      returnBranchId: IDS.dropoff,
      startAt: new Date(START),
      endAt: new Date(END),
      expiresAt: new Date('2999-01-01T00:00:00Z'),
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
      id: IDS.hold,
      vehicleId: IDS.vehicle,
      pickupBranchId: IDS.pickup,
      returnBranchId: IDS.dropoff,
      startAt: new Date(START),
      endAt: new Date(END),
      expiresAt: new Date('2999-01-01T00:00:00Z'),
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
      ...base,
      vehicleId,
      startAt: startPlus(days).toISOString(),
      endAt: startPlus(days + 1).toISOString(),
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

  it("a finished rental does not count, and another account's bookings do not either", async () => {
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
      service.create(user, {
        ...base,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + 3 * DAY_MS).toISOString(),
      }),
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
      service.create(user, {
        ...base,
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + DAY_MS).toISOString(),
      }),
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

  it("puan: biten kiralama bakiyeye, bitmeyen pending'e gider; iptal sayılmaz", async () => {
    const { service, db } = build();
    await service.create(user, base); // 3750 TL → 37 puan, START'tan 3 gün sonra biter
    const before = await service.points(IDS.user, startPlus(-9));
    expect(before).toMatchObject({ balance: 0, pending: 37, history: [] });
    expect(before.rules.tr).toContain('₺100');

    const after = await service.points(IDS.user, startPlus(4));
    expect(after.balance).toBe(37);
    expect(after.pending).toBe(0);
    expect(after.history).toEqual([{ points: 37, reservationNumber: expect.stringMatching(/^NVR-/), createdAt: END }]);

    db.reservations[0]!.status = 'CANCELLED';
    const cancelled = await service.points(IDS.user, startPlus(4));
    expect(cancelled).toMatchObject({ balance: 0, pending: 0, history: [] });
  });
});

describe('points of a booking made after its own start (G-01)', () => {
  it('never reach the balance, even once the rental has ended', async () => {
    const { service, db } = build();
    db.reservations.push({
      id: 'late',
      number: 'LATE-1',
      status: 'CONFIRMED',
      userId: IDS.user,
      vehicleId: IDS.other,
      startAt: new Date('2020-01-01T10:00:00Z'),
      endAt: new Date('2021-01-01T10:00:00Z'),
      pointsUsed: 0,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
    db.points.push({
      id: 'late-p',
      userId: IDS.user,
      reservationId: 'late',
      points: 365,
      createdAt: new Date('2026-10-01T00:00:00Z'),
    });
    const points = await service.points(IDS.user, new Date('2026-10-24T00:00:00Z'));
    expect(points).toMatchObject({ balance: 0, pending: 0, history: [] });
  });
});
