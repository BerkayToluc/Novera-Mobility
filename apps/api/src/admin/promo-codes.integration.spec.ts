import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isPromoUsable, promoBlock } from '../reservations/pricing.service.js';
import { PromoCodesService } from './promo-codes.service.js';

// The campaign code administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests;
// skipped without one. The test database is shared with suites that run at the same time and holds the seed codes, so
// every list is narrowed to this run's own codes with the search (`q`).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const NOW = new Date();
const days = (count: number) => new Date(NOW.getTime() + count * 86_400_000);

// What an HttpException answered, to compare on without caring about its class.
async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('campaign code administration against the database (V2-26)', () => {
  let prisma: PrismaService;
  let service: PromoCodesService;
  // Letters and digits only, upper case: a valid code. Eight hex digits keep this run's codes apart from others.
  const run = randomUUID().slice(0, 8).toUpperCase();
  const name = (suffix: string) => `V26${run}${suffix}`;
  const ids = { classId: '', modelId: '', branchId: '', vehicleId: '' };

  const book = (suffix: string, code: string, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.reservation.create({
      data: {
        number: `P26-${run}-${suffix}`,
        status,
        promoCode: code,
        startAt: days(30),
        endAt: days(31),
        days: 1,
        vehicleDailyPrice: 100000,
        totalPrice: 90000,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
      },
    });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new PromoCodesService(prisma);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `p26-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `p26-model-${run}`,
          brand: 'Test',
          model: 'Model',
          seats: 5,
          bags: 3,
          transmission: 'AUTOMATIC',
          fuelType: 'PETROL',
          consumption: 5.5,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 100000,
          description: { tr: 'Test', en: 'Test' },
          classId: ids.classId,
        },
      })
    ).id;
    ids.branchId = (
      await prisma.branch.create({
        data: {
          name: `Kod Bayi ${run}`,
          city: 'Test',
          address: 'Test',
          latitude: 1,
          longitude: 1,
          phone: '+90 000 000 00 00',
          email: `kod-${run}@example.test`,
          openingHours: { weekdays: { open: '08:00', close: '20:00' } },
        },
      })
    ).id;
    ids.vehicleId = (
      await prisma.vehicle.create({ data: { plate: `K${run}`, year: 2030, vehicleModelId: ids.modelId, branchId: ids.branchId } })
    ).id;
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId: ids.vehicleId } });
    await prisma.promoCode.deleteMany({ where: { code: { startsWith: `V26${run}` } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('creating', () => {
    it('writes the code as the booking form reads it, with the defaults', async () => {
      const typed = ` v26 ${run.toLowerCase()}n `;
      const created = await service.create({ code: typed, percent: 15 });
      expect(created).toMatchObject({
        code: name('N'),
        percent: 15,
        active: true,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        oncePerUser: true,
        used: 0,
        deletable: true,
        status: 'ACTIVE',
      });
      expect(await service.get(name('n'))).toEqual(created);
    });

    it('a name that is taken is 409 CODE_TAKEN, whatever the case', async () => {
      await service.create({ code: name('T'), percent: 10 });
      const again = await refused(service.create({ code: name('T').toLowerCase(), percent: 20 }));
      expect(again.status).toBe(409);
      expect(again.body).toMatchObject({ code: 'CODE_TAKEN', fieldErrors: { code: 'CODE_TAKEN' } });
      expect((await service.get(name('T'))).percent).toBe(10);
    });

    it('a code that ends before or when it starts is 422 INVALID_DATE_RANGE', async () => {
      for (const validUntil of [days(1), days(2)]) {
        const bad = await refused(
          service.create({ code: name('D'), percent: 10, validFrom: days(2).toISOString(), validUntil: validUntil.toISOString() }),
        );
        expect(bad.status).toBe(422);
        expect(bad.body).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { validUntil: 'INVALID_DATE_RANGE' } });
      }
      expect((await prisma.promoCode.findUnique({ where: { code: name('D') } }))).toBeNull();
    });
  });

  // The rules are also kept by the database (migration 20261030120000), so a write that goes around the API cannot break them.
  describe('the database itself', () => {
    it('refuses a code that is not letters and digits in upper case, 3 to 20 long', async () => {
      for (const code of [`v26${run}low`, `V26${run}-X`, 'AB', `V26${run}`.padEnd(21, 'X')]) {
        await expect(prisma.promoCode.create({ data: { code, percent: 10 } })).rejects.toThrow(/PromoCode_code_check/);
      }
    });

    it('refuses a period that ends when or before it starts', async () => {
      const at = days(3);
      for (const validUntil of [at, days(2)]) {
        await expect(
          prisma.promoCode.create({ data: { code: name('PX'), percent: 10, validFrom: at, validUntil } }),
        ).rejects.toThrow(/PromoCode_period_check/);
      }
      expect(await prisma.promoCode.findUnique({ where: { code: name('PX') } })).toBeNull();
    });
  });

  describe('listing', () => {
    // Four codes in four states, and a booking that holds the one with a cap of one.
    beforeAll(async () => {
      await service.create({ code: name('LA'), percent: 10 });
      await service.create({ code: name('LB'), percent: 20, active: false });
      await service.create({ code: name('LC'), percent: 30, validFrom: days(-10).toISOString(), validUntil: days(-1).toISOString() });
      await service.create({ code: name('LD'), percent: 40, maxRedemptions: 1 });
      await service.create({ code: name('LE'), percent: 50, validFrom: days(5).toISOString() });
      await book('LD1', name('LD'));
      // A cancelled booking gives the use back: it is on the code's history but not in `used`.
      await book('LD2', name('LD'), 'CANCELLED');
    });

    const mine = (query: Record<string, string> = {}) => service.list({ q: `V26${run}L`, ...query });

    it('names each code’s state, and counts only the bookings that still hold it', async () => {
      const page = await mine({ sort: 'code:asc' });
      expect(page.total).toBe(5);
      expect(page.items.map((item) => [item.code.slice(-2), item.status, item.used])).toEqual([
        ['LA', 'ACTIVE', 0],
        ['LB', 'INACTIVE', 0],
        ['LC', 'EXPIRED', 0],
        ['LD', 'EXHAUSTED', 1],
        ['LE', 'SCHEDULED', 0],
      ]);
    });

    it('a code on any booking, cancelled or not, is not deletable', async () => {
      const page = await mine({ sort: 'code:asc' });
      expect(page.items.map((item) => item.deletable)).toEqual([true, true, true, false, true]);
    });

    it('narrows by state', async () => {
      for (const [status, expected] of [
        ['ACTIVE', ['LA']],
        ['INACTIVE', ['LB']],
        ['EXPIRED', ['LC']],
        ['EXHAUSTED', ['LD']],
        ['SCHEDULED', ['LE']],
      ] as const) {
        const page = await mine({ status });
        expect(page.items.map((item) => item.code.slice(-2))).toEqual(expected);
        expect(page.total).toBe(expected.length);
      }
    });

    it('searches by part of a code, in any case', async () => {
      const page = await service.list({ q: `v26 ${run.toLowerCase()}lc` });
      expect(page.items.map((item) => item.code)).toEqual([name('LC')]);
    });

    it('sorts, with the code as the tie-break, and pages with a total that does not change', async () => {
      const byPercent = await mine({ sort: 'percent:desc' });
      expect(byPercent.items.map((item) => item.percent)).toEqual([50, 40, 30, 20, 10]);

      const first = await mine({ sort: 'percent:desc', pageSize: '2', page: '1' });
      const third = await mine({ sort: 'percent:desc', pageSize: '2', page: '3' });
      expect(first).toMatchObject({ total: 5, page: 1, pageSize: 2 });
      expect(first.items.map((item) => item.percent)).toEqual([50, 40]);
      expect(third.items.map((item) => item.percent)).toEqual([10]);
      expect((await mine({ page: '9' })).items).toEqual([]);

      // A code with no end date sorts as the furthest one.
      const byEnd = await mine({ sort: 'validUntil:asc' });
      expect(byEnd.items[0]?.code).toBe(name('LC'));
      expect(byEnd.items.at(-1)?.validUntil).toBeNull();
    });

    // The list may only say ACTIVE for a code that a booking would actually take.
    it('says ACTIVE exactly when the booking-time check accepts the code', async () => {
      for (const view of (await mine()).items) {
        const row = await prisma.promoCode.findUniqueOrThrow({ where: { code: view.code } });
        const takes = isPromoUsable(row, new Date()) && (await promoBlock(prisma, row, null)) === null;
        expect(view.status === 'ACTIVE').toBe(takes);
      }
    });
  });

  describe('changing', () => {
    it('changes only what is sent, and moves the version on', async () => {
      const created = await service.create({ code: name('U'), percent: 10, maxRedemptions: 5, validUntil: days(30).toISOString() });
      const changed = await service.update(name('U'), { updatedAt: created.updatedAt, percent: 25 });
      expect(changed).toMatchObject({ percent: 25, maxRedemptions: 5, validUntil: created.validUntil, active: true });
      expect(changed.updatedAt).not.toBe(created.updatedAt);

      // null is "none": the end date and the cap are cleared.
      const cleared = await service.update(name('U'), { updatedAt: changed.updatedAt, validUntil: null, maxRedemptions: null });
      expect(cleared).toMatchObject({ validUntil: null, maxRedemptions: null, percent: 25 });
    });

    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const created = await service.create({ code: name('S'), percent: 10 });
      await service.update(name('S'), { updatedAt: created.updatedAt, percent: 20 });
      const late = await refused(service.update(name('S'), { updatedAt: created.updatedAt, percent: 30, active: false }));
      expect(late.status).toBe(409);
      expect(late.body.code).toBe('STALE_WRITE');
      expect(await service.get(name('S'))).toMatchObject({ percent: 20, active: true });
    });

    it('the cap cannot go below the uses so far; at the uses it can', async () => {
      const created = await service.create({ code: name('C'), percent: 10, maxRedemptions: 5 });
      await book('C1', name('C'));
      await book('C2', name('C'));
      const tooLow = await refused(service.update(name('C'), { updatedAt: created.updatedAt, maxRedemptions: 1 }));
      expect(tooLow.status).toBe(422);
      expect(tooLow.body).toMatchObject({ fieldErrors: { maxRedemptions: 'BELOW_USAGE' } });
      const equal = await service.update(name('C'), { updatedAt: created.updatedAt, maxRedemptions: 2 });
      expect(equal).toMatchObject({ maxRedemptions: 2, used: 2, status: 'EXHAUSTED' });
    });

    it('a period that would end before it starts is refused, counting the dates that were not sent', async () => {
      const created = await service.create({ code: name('P'), percent: 10, validFrom: days(5).toISOString() });
      const bad = await refused(service.update(name('P'), { updatedAt: created.updatedAt, validUntil: days(2).toISOString() }));
      expect(bad.status).toBe(422);
      expect(bad.body).toMatchObject({ fieldErrors: { validUntil: 'INVALID_DATE_RANGE' } });
    });

    it('a switched-off code stops being taken, and switching it on gives it back', async () => {
      const created = await service.create({ code: name('O'), percent: 10 });
      const off = await service.update(name('O'), { updatedAt: created.updatedAt, active: false });
      expect(off.status).toBe('INACTIVE');
      const row = await prisma.promoCode.findUniqueOrThrow({ where: { code: name('O') } });
      expect(isPromoUsable(row, new Date())).toBe(false);
      const on = await service.update(name('O'), { updatedAt: off.updatedAt, active: true });
      expect(on.status).toBe('ACTIVE');
    });

    it('a code that does not exist is 404, and so is something that cannot be a code', async () => {
      expect((await refused(service.get(name('X')))).status).toBe(404);
      expect((await refused(service.update(name('X'), { updatedAt: new Date().toISOString() }))).status).toBe(404);
      expect((await refused(service.get('no!'))).status).toBe(404);
    });
  });

  describe('deleting', () => {
    it('removes a code that was never on a booking', async () => {
      await service.create({ code: name('R'), percent: 10 });
      await service.remove(name('R'));
      expect((await refused(service.get(name('R')))).status).toBe(404);
    });

    it('refuses a code that is on a booking with 409 IN_USE, and leaves it exactly as it was', async () => {
      const created = await service.create({ code: name('K'), percent: 10 });
      await book('K1', name('K'));
      const stay = await refused(service.remove(name('K')));
      expect(stay.status).toBe(409);
      expect(stay.body.code).toBe('IN_USE');
      expect(await service.get(name('K'))).toMatchObject({ code: name('K'), active: true, updatedAt: created.updatedAt, used: 1 });
    });

    it('also refuses a code whose only booking was cancelled: the booking still carries its name', async () => {
      await service.create({ code: name('Q'), percent: 10 });
      await book('Q1', name('Q'), 'CANCELLED');
      expect((await refused(service.remove(name('Q')))).body.code).toBe('IN_USE');
    });

    it('a code that does not exist is 404', async () => {
      expect((await refused(service.remove(name('Z')))).status).toBe(404);
    });
  });

  describe('against a booking made at the same moment', () => {
    // A booking locks the code row before it counts the uses; a change locks the same row, so they take turns. A booking
    // is simulated here by holding the row lock in a transaction that adds a second use, while a change that lowers the
    // cap to 1 is made. Without the lock the change would see one use, allow the cap, and leave two uses on a cap of 1.
    it('a change that lowers the cap waits for the booking, then sees its use and refuses', async () => {
      const created = await service.create({ code: name('W'), percent: 10, maxRedemptions: 3 });
      await book('W1', name('W'));

      const events: string[] = [];
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let locked!: () => void;
      const lockTaken = new Promise<void>((resolve) => {
        locked = resolve;
      });
      const booking = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "PromoCode" WHERE "code" = ${name('W')} FOR UPDATE`;
        await tx.reservation.create({
          data: {
            number: `P26-${run}-W2`,
            promoCode: name('W'),
            startAt: days(30),
            endAt: days(31),
            days: 1,
            vehicleDailyPrice: 100000,
            totalPrice: 90000,
            vehicleId: ids.vehicleId,
            pickupBranchId: ids.branchId,
            returnBranchId: ids.branchId,
          },
        });
        events.push('booking made its use');
        locked();
        await held;
        events.push('booking commits');
      });
      await lockTaken;

      const change = refused(service.update(name('W'), { updatedAt: created.updatedAt, maxRedemptions: 1 })).then((answer) => {
        events.push('change answered');
        return answer;
      });
      // The change has had time to run, and is still waiting for the booking.
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).toEqual(['booking made its use']);

      release();
      await booking;
      const answer = await change;
      expect(events).toEqual(['booking made its use', 'booking commits', 'change answered']);
      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ fieldErrors: { maxRedemptions: 'BELOW_USAGE' } });
      expect(await service.get(name('W'))).toMatchObject({ maxRedemptions: 3, used: 2 });
    });
  });
});
