import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { testPlate } from '../../common/plate.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PricingService } from '../../reservations/pricing.service.js';
import { ReservationsService } from '../../reservations/reservations.service.js';
import { AdminReservationsService } from './reservations.service.js';

// The booking administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without
// one. The test database is shared with suites that run at the same time, so every list is narrowed to this run's own branch.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;
const days = (count: number) => new Date(Date.now() + count * DAY);
const CODE = `V31${randomUUID().slice(0, 6).toUpperCase()}`;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('booking administration against the database (V2-31)', () => {
  let prisma: PrismaService;
  let service: AdminReservationsService;
  let customerService: ReservationsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branch: '', other: '', vehicleId: '', admin: '', ayse: '', can: '', deleted: '' };
  const made: string[] = [];

  const numberOf = () => `NVR-2999-${randomInt(10_000_000, 99_999_999)}`;
  const book = async (overrides: Record<string, unknown> = {}) => {
    const row = await prisma.reservation.create({
      data: {
        number: numberOf(),
        startAt: days(10),
        endAt: days(12),
        days: 2,
        vehicleDailyPrice: 100000,
        totalPrice: 200000,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branch,
        returnBranchId: ids.other,
        userId: ids.ayse,
        ...overrides,
      },
    });
    made.push(row.id);
    return row;
  };
  const noSuchBooking = (number = 'NVR-2999-00000000') => refused(service.get(number));

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AdminReservationsService(prisma);
    customerService = new ReservationsService(prisma, new PricingService(prisma));
    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v31c-${run}`, nameTr: 'Deneme', nameEn: 'Test' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `v31m-${run}`,
          brand: 'Deneme',
          model: 'Rezervasyon',
          seats: 5,
          bags: 2,
          transmission: 'MANUAL',
          fuelType: 'PETROL',
          consumption: 5.4,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 100000,
          description: { tr: 'Deneme', en: 'Test' },
          classId: ids.classId,
        },
      })
    ).id;
    const branch = (name: string) =>
      prisma.branch.create({
        data: {
          name: `${name} ${run}`,
          city: 'Ankara',
          address: 'Test',
          latitude: 39.9,
          longitude: 32.8,
          phone: '+90 312 555 00 00',
          email: `${name.toLowerCase()}-${run}@example.test`,
          openingHours: { weekdays: '00:00-23:59', saturday: '00:00-23:59', sunday: '00:00-23:59' },
        },
      });
    ids.branch = (await branch('Alis')).id;
    ids.other = (await branch('Donus')).id;
    ids.vehicleId = (await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: ids.branch } })).id;
    const user = (email: string, firstName: string, lastName: string, extra: Record<string, unknown> = {}) =>
      prisma.user.create({ data: { email, passwordHash: 'x', firstName, lastName, accountType: 'INDIVIDUAL', ...extra } });
    ids.admin = (await user(`yonetici-${run}@example.test`, 'Ece', 'Yönetici', { role: 'ADMIN' })).id;
    ids.ayse = (await user(`ayse-${run}@example.test`, 'Ayşe', 'Yılmaz')).id;
    ids.can = (await user(`can-${run}@example.test`, 'Can', 'Demir')).id;
    await prisma.promoCode.create({ data: { code: CODE, percent: 10 } });
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { id: { in: made } } });
    await prisma.promoCode.deleteMany({ where: { code: CODE } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.admin, ids.ayse, ids.can, ids.deleted].filter(Boolean) } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.branch.deleteMany({ where: { id: { in: [ids.branch, ids.other] } } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('listing', () => {
    it('lists the bookings of a branch newest start first, with the customer, the car and the branches', async () => {
      const first = await book({ startAt: days(30), endAt: days(31) });
      const second = await book({ startAt: days(40), endAt: days(41), userId: ids.can });
      const page = await service.list({ branch: ids.branch, pageSize: '100' });
      const numbers = page.items.map((item) => item.number);
      expect(numbers.indexOf(second.number)).toBeLessThan(numbers.indexOf(first.number));
      const item = page.items.find((entry) => entry.number === first.number)!;
      expect(item).toMatchObject({
        status: 'CONFIRMED',
        customer: { name: 'Ayşe Yılmaz', email: `ayse-${run}@example.test` },
        vehicle: { brand: 'Deneme', model: 'Rezervasyon' },
        pickupBranch: { id: ids.branch },
        returnBranch: { id: ids.other },
        total: { amount: 200000, currency: 'TRY' },
      });
      expect(item.vehicle.plate).toMatch(/^34 [A-Z]{3} \d{4}$/);
    });

    it('finds a booking by a part of its number or of the customer e-mail, whatever the case', async () => {
      const row = await book({ userId: ids.can });
      for (const q of [row.number, row.number.toLowerCase(), row.number.slice(-7), `CAN-${run}`.toUpperCase(), `can-${run}@EXAMPLE`]) {
        const page = await service.list({ q, branch: ids.branch });
        expect(page.items.map((item) => item.number)).toContain(row.number);
      }
      expect((await service.list({ q: `nobody-${run}` })).total).toBe(0);
    });

    it('narrows by state, and by the days the rental starts on by the Istanbul calendar, both days included', async () => {
      const inside = await book({ startAt: new Date('2098-03-10T20:30:00Z'), endAt: new Date('2098-03-11T20:30:00Z') });
      const before = await book({ startAt: new Date('2098-03-10T20:59:00Z'), endAt: new Date('2098-03-11T20:59:00Z') });
      const cancelled = await book({ startAt: new Date('2098-03-12T10:00:00Z'), endAt: new Date('2098-03-13T10:00:00Z'), status: 'CANCELLED', cancelledAt: new Date() });
      // 23:30 on the 10th in Istanbul is 20:30Z; 00:30 on the 11th is 21:30Z. The 10th ends at 21:00Z.
      const late = await book({ startAt: new Date('2098-03-10T21:30:00Z'), endAt: new Date('2098-03-11T21:30:00Z') });
      const on = (from: string, to: string, extra: Record<string, unknown> = {}) =>
        service.list({ branch: ids.branch, from, to, pageSize: '100', ...extra }).then((page) => page.items.map((item) => item.number));

      const tenth = await on('2098-03-10', '2098-03-10');
      expect(tenth).toEqual(expect.arrayContaining([inside.number, before.number]));
      expect(tenth).not.toContain(late.number);
      expect(await on('2098-03-11', '2098-03-11')).toContain(late.number);
      expect(await on('2098-03-10', '2098-03-12')).toEqual(expect.arrayContaining([inside.number, late.number, cancelled.number]));
      expect(await on('2098-03-10', '2098-03-12', { status: 'CANCELLED' })).toEqual([cancelled.number]);
      expect(await on('2098-03-10', '2098-03-12', { status: 'CONFIRMED' })).not.toContain(cancelled.number);
    });

    it('opens the numbers of the summary: starting today, ending today and made in the last seven days, the Istanbul way', async () => {
      // A fixed moment, so the windows are known: noon on 11 March 2098 in Istanbul (09:00Z). That day is [2098-03-10T21:00Z, 2098-03-11T21:00Z).
      const now = new Date('2098-03-11T09:00:00Z');
      const starts = await book({ startAt: new Date('2098-03-11T07:00:00Z'), endAt: new Date('2098-03-15T07:00:00Z') });
      const startsTomorrow = await book({ startAt: new Date('2098-03-11T21:00:00Z'), endAt: new Date('2098-03-12T21:00:00Z') });
      const ends = await book({ startAt: new Date('2098-03-08T07:00:00Z'), endAt: new Date('2098-03-11T20:59:00Z') });
      const madeRecently = await book({ startAt: new Date('2098-06-01T07:00:00Z'), endAt: new Date('2098-06-02T07:00:00Z'), createdAt: new Date('2098-03-06T00:00:00Z') });
      const madeLongAgo = await book({ startAt: new Date('2098-06-01T07:00:00Z'), endAt: new Date('2098-06-02T07:00:00Z'), createdAt: new Date('2098-03-01T00:00:00Z') });
      const cancelledToday = await book({ startAt: new Date('2098-03-11T08:00:00Z'), endAt: new Date('2098-03-12T08:00:00Z'), status: 'CANCELLED', cancelledAt: now });
      const numbers = (extra: Record<string, unknown>) =>
        service.list({ branch: ids.branch, pageSize: '100', ...extra }, now).then((page) => page.items.map((item) => item.number));

      const starting = await numbers({ start: 'today', status: 'CONFIRMED' });
      expect(starting).toContain(starts.number);
      expect(starting).not.toContain(startsTomorrow.number);
      expect(starting).not.toContain(cancelledToday.number);
      expect(await numbers({ start: 'today' })).toContain(cancelledToday.number);

      const ending = await numbers({ end: 'today', status: 'CONFIRMED' });
      expect(ending).toContain(ends.number);
      expect(ending).not.toContain(starts.number);

      const recent = await numbers({ created: 'last7days', status: 'CONFIRMED' });
      expect(recent).toContain(madeRecently.number);
      expect(recent).not.toContain(madeLongAgo.number);

      // Asked together they narrow each other.
      expect(await numbers({ start: 'today', end: 'today', status: 'CONFIRMED' })).toEqual([]);
      expect(await numbers({ start: 'today', from: '2098-03-12', to: '2098-03-12' })).toEqual([]);
      expect((await refused(service.list({ start: 'tomorrow' }))).body).toMatchObject({ fieldErrors: { start: 'INVALID_FORMAT' } });
    });

    it('narrows by the pick-up branch', async () => {
      const row = await book();
      expect((await service.list({ branch: ids.branch, q: row.number })).total).toBe(1);
      expect((await service.list({ branch: ids.other, q: row.number })).total).toBe(0);
    });

    it('pages with a total that does not change, and every booking comes once', async () => {
      const same = days(60);
      for (let index = 0; index < 5; index += 1) await book({ startAt: same, endAt: days(61), userId: ids.can });
      const all = await service.list({ branch: ids.branch, q: `can-${run}`, pageSize: '100' });
      const first = await service.list({ branch: ids.branch, q: `can-${run}`, pageSize: '2', page: '1' });
      const second = await service.list({ branch: ids.branch, q: `can-${run}`, pageSize: '2', page: '2' });
      expect(first.total).toBe(all.total);
      expect(second.total).toBe(all.total);
      const seen = [...first.items, ...second.items].map((item) => item.number);
      expect(new Set(seen).size).toBe(4);
      expect(seen).toEqual(all.items.slice(0, 4).map((item) => item.number));
    });

    it('sorts by start either way', async () => {
      const asc = await service.list({ branch: ids.branch, sort: 'startAt:asc', pageSize: '100' });
      const starts = asc.items.map((item) => item.startAt);
      expect(starts).toEqual([...starts].sort());
    });

    it('is 422 for a last day before the first day, and for dates that are not dates', async () => {
      expect((await refused(service.list({ from: '2098-03-12', to: '2098-03-10' }))).body).toMatchObject({ fieldErrors: { to: 'INVALID_DATE_RANGE' } });
      expect((await refused(service.list({ from: '2098-02-30', to: 'tomorrow' }))).body).toMatchObject({ fieldErrors: { from: 'INVALID_FORMAT', to: 'INVALID_FORMAT' } });
    });

    it('lists a booking whose account was removed, with no customer', async () => {
      const gone = await prisma.user.create({ data: { email: `gone-${run}@example.test`, passwordHash: 'x', firstName: 'Silinen', lastName: 'Hesap' } });
      ids.deleted = gone.id;
      const row = await book({ userId: gone.id });
      await prisma.user.delete({ where: { id: gone.id } });
      const detail = await service.get(row.number);
      expect(detail.customer).toBeNull();
      expect(detail.customerAccount).toBeNull();
    });
  });

  describe('one booking', () => {
    it('gives the price as it was made, the campaign code, the points, and that it can be cancelled', async () => {
      const row = await book({ promoCode: CODE, promoPercent: 10, discountAmount: 20000, pointsUsed: 100, totalPrice: 180000 });
      await prisma.pointTransaction.create({ data: { points: 90, userId: ids.ayse, reservationId: row.id } });
      const detail = await service.get(row.number.toLowerCase());
      expect(detail).toMatchObject({
        number: row.number,
        days: 2,
        cancellable: true,
        cancellation: null,
        pointsEarned: 90,
        customerAccount: { type: 'INDIVIDUAL' },
        price: { promo: { code: CODE, percent: 10 }, pointsUsed: 100, total: { amount: 180000 } },
      });
      expect(detail.price.lines.map((line) => line.type)).toEqual(['VEHICLE', 'DISCOUNT']);
    });

    // The company name of a corporate customer comes from the company (V2-33); the old column on the account is gone (V2-34).
    it('names the company of a corporate customer, from the company', async () => {
      const company = await prisma.company.create({ data: { name: `V31 Firma ${run}` } });
      const corporate = await prisma.user.create({
        data: { email: `kurumsal-${run}@example.test`, passwordHash: 'x', firstName: 'Kurumsal', lastName: 'Kişi', accountType: 'CORPORATE', companyId: company.id },
      });
      try {
        const row = await book({ userId: corporate.id });
        expect((await service.get(row.number)).customerAccount).toEqual({ type: 'CORPORATE', companyName: `V31 Firma ${run}` });
      } finally {
        await prisma.reservation.deleteMany({ where: { userId: corporate.id } });
        await prisma.user.delete({ where: { id: corporate.id } });
        await prisma.company.delete({ where: { id: company.id } });
      }
    });

    it('cannot be cancelled once it has started, and says so', async () => {
      const running = await book({ startAt: days(-1), endAt: days(1) });
      expect((await service.get(running.number)).cancellable).toBe(false);
    });

    it('is 404 for a number that is not there or cannot be one', async () => {
      expect((await noSuchBooking()).status).toBe(404);
      expect((await noSuchBooking('not-a-number')).status).toBe(404);
      expect((await refused(service.cancel('not-a-number', { reason: 'Deneme nedeni' }, ids.admin))).status).toBe(404);
    });
  });

  describe('cancelling', () => {
    it('writes the cancellation, the reason and the administrator, and the booking says so', async () => {
      const row = await book();
      const cancelled = await service.cancel(row.number.toLowerCase(), { reason: '  Müşteri aradı, aracı istemiyor.  ' }, ids.admin);
      expect(cancelled).toMatchObject({
        status: 'CANCELLED',
        cancellable: false,
        cancellation: { reason: 'Müşteri aradı, aracı istemiyor.', by: { email: `yonetici-${run}@example.test` } },
      });
      const stored = await prisma.reservation.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored).toMatchObject({ status: 'CANCELLED', cancelReason: 'Müşteri aradı, aracı istemiyor.', cancelledById: ids.admin });
      expect(stored.cancelledAt).toBeInstanceOf(Date);
      // The customer's own list (My bookings) shows it as cancelled, with no points earned.
      const mine = (await customerService.listMine(ids.ayse)).find((entry) => entry.number === row.number);
      expect(mine).toMatchObject({ status: 'CANCELLED', pointsEarned: 0 });
    });

    it('asks for a reason of 5 to 500 characters, and writes nothing without one', async () => {
      const row = await book();
      for (const [reason, code] of [
        [undefined, 'REQUIRED'],
        ['   ', 'REQUIRED'],
        ['kısa', 'TOO_SHORT'],
        ['x'.repeat(501), 'TOO_LONG'],
        [12345, 'INVALID_FORMAT'],
      ] as const) {
        const answer = await refused(service.cancel(row.number, { reason }, ids.admin));
        expect(answer).toMatchObject({ status: 422, body: { fieldErrors: { reason: code } } });
      }
      expect((await prisma.reservation.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CONFIRMED');
      expect((await service.cancel(row.number, { reason: 'x'.repeat(500) }, ids.admin)).status).toBe('CANCELLED');
    });

    it('is 409 INVALID_TRANSITION for a booking that has started or is already cancelled, and changes nothing', async () => {
      const running = await book({ startAt: days(-1), endAt: days(1) });
      const started = await refused(service.cancel(running.number, { reason: 'Başlamış kiralama' }, ids.admin));
      expect(started).toMatchObject({ status: 409, body: { code: 'INVALID_TRANSITION' } });
      expect((await prisma.reservation.findUniqueOrThrow({ where: { id: running.id } })).status).toBe('CONFIRMED');

      const row = await book();
      await service.cancel(row.number, { reason: 'İlk iptal nedeni' }, ids.admin);
      const again = await refused(service.cancel(row.number, { reason: 'İkinci iptal nedeni' }, ids.admin));
      expect(again).toMatchObject({ status: 409, body: { code: 'INVALID_TRANSITION' } });
      expect((await prisma.reservation.findUniqueOrThrow({ where: { id: row.id } })).cancelReason).toBe('İlk iptal nedeni');
    });

    it('a booking the customer cancelled cannot be cancelled again from the panel, and has no reason or administrator', async () => {
      const row = await book();
      await customerService.cancel(ids.ayse, row.id);
      expect((await refused(service.cancel(row.number, { reason: 'Geç kalmış iptal' }, ids.admin))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
      const detail = await service.get(row.number);
      expect(detail.cancellation).toMatchObject({ reason: null, by: null });
    });

    it('gives the same result as the customer cancelling: the points, the campaign code and the car', async () => {
      const make = async (userId: string) => {
        const row = await book({ userId, promoCode: CODE, promoPercent: 10, discountAmount: 20000, pointsUsed: 100, totalPrice: 180000, startAt: days(90), endAt: days(92) });
        await prisma.pointTransaction.create({ data: { points: 90, userId, reservationId: row.id } });
        return row;
      };
      const ledger = (userId: string) => customerService.points(userId);
      const uses = () => prisma.reservation.count({ where: { promoCode: CODE, status: 'CONFIRMED', id: { in: made } } });

      // The two accounts may have other bookings from the tests above, so each is compared with where it started.
      const start = { admin: await ledger(ids.ayse), customer: await ledger(ids.can) };
      const byAdmin = await make(ids.ayse);
      const byCustomer = await make(ids.can);

      // Before: 100 points are spent and 90 are waiting, on both accounts, and both uses of the code count.
      const during = { admin: await ledger(ids.ayse), customer: await ledger(ids.can) };
      expect(during.admin.balance).toBe(start.admin.balance - 100);
      expect(during.admin.pending).toBe(start.admin.pending + 90);
      expect(during.customer.balance).toBe(start.customer.balance - 100);
      expect(during.customer.pending).toBe(start.customer.pending + 90);
      const before = await uses();

      await service.cancel(byAdmin.number, { reason: 'Müşteri talebi üzerine' }, ids.admin);
      await customerService.cancel(ids.can, byCustomer.id);

      for (const row of [byAdmin, byCustomer]) {
        const stored = await prisma.reservation.findUniqueOrThrow({ where: { id: row.id } });
        expect(stored.status).toBe('CANCELLED');
        expect(stored.cancelledAt).toBeInstanceOf(Date);
      }
      // The campaign code is free again for both.
      expect(await uses()).toBe(before - 2);
      // The spent points are back and the waiting ones are gone: the same for both, and the same as before the booking.
      const after = { admin: await ledger(ids.ayse), customer: await ledger(ids.can) };
      expect(after.admin).toEqual(start.admin);
      expect(after.customer).toEqual(start.customer);
    });

    it('the car is free again for the dates at once', async () => {
      const row = await book({ startAt: days(120), endAt: days(122) });
      const clash = () =>
        prisma.reservation.count({
          where: { vehicleId: ids.vehicleId, status: 'CONFIRMED', startAt: { lt: days(122) }, endAt: { gt: days(120) } },
        });
      expect(await clash()).toBeGreaterThan(0);
      await service.cancel(row.number, { reason: 'Araç boşa çıksın' }, ids.admin);
      expect(await clash()).toBe(0);
    });

    it('a customer and an administrator cancelling at the same moment cancel it once, and the other one is told', async () => {
      const row = await book();
      const [admin, customer] = await Promise.allSettled([
        service.cancel(row.number, { reason: 'Aynı anda iptal' }, ids.admin),
        customerService.cancel(ids.ayse, row.id),
      ]);
      const stored = await prisma.reservation.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored.status).toBe('CANCELLED');
      // The customer's call is harmless either way (a repeated cancel gives the same result). The administrator's either won,
      // and then the reason is on the booking, or lost, and then it was told INVALID_TRANSITION and nothing was written.
      expect(customer.status).toBe('fulfilled');
      if (admin.status === 'fulfilled') {
        expect(stored.cancelReason).toBe('Aynı anda iptal');
      } else {
        expect(admin.reason).toBeInstanceOf(HttpException);
        expect((admin.reason as HttpException).getResponse()).toMatchObject({ code: 'INVALID_TRANSITION' });
        expect(stored.cancelReason).toBeNull();
      }
    });

    it('the database itself refuses a reason that is too short or too long', async () => {
      const row = await book();
      await expect(prisma.reservation.update({ where: { id: row.id }, data: { cancelReason: 'abc' } })).rejects.toThrow();
      await expect(prisma.reservation.update({ where: { id: row.id }, data: { cancelReason: 'x'.repeat(501) } })).rejects.toThrow();
    });

    it('the reason stays when the administrator account is removed', async () => {
      const temporary = await prisma.user.create({ data: { email: `gecici-${run}@example.test`, passwordHash: 'x', firstName: 'Geçici', lastName: 'Yönetici', role: 'ADMIN' } });
      const row = await book();
      await service.cancel(row.number, { reason: 'Geçici yönetici iptal etti' }, temporary.id);
      await prisma.user.delete({ where: { id: temporary.id } });
      const detail = await service.get(row.number);
      expect(detail.cancellation).toMatchObject({ reason: 'Geçici yönetici iptal etti', by: null });
    });
  });
});
