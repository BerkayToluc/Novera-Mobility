import {
  FakeDb,
  IDS,
  base,
  bodyOf,
  build,
  catchHttp,
  corporate,
  startPlus,
  user,
} from './reservations.service.testing.js';

// Points payment (SPEC §2.3): 1 point = ₺5, at most half of the total, individual accounts and TRY only.
function seedBalance(db: FakeDb, points: number) {
  db.reservations.push({
    id: 'seed',
    number: 'SEED-1',
    status: 'CONFIRMED',
    userId: IDS.user,
    vehicleId: IDS.other,
    startAt: new Date('2020-01-01T10:00:00Z'),
    endAt: new Date('2020-01-04T10:00:00Z'),
    pointsUsed: 0,
    createdAt: new Date('2020-01-01T00:00:00Z'),
  });
  db.points.push({
    id: 'seed-p',
    userId: IDS.user,
    reservationId: 'seed',
    points,
    createdAt: new Date('2020-01-04T10:00:00Z'),
  });
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
      ...base,
      usePoints: true,
      startAt: startPlus(61).toISOString(),
      endAt: startPlus(64).toISOString(),
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
