import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../app.module.js';
import { configureApp } from '../app.setup.js';
import { DAY_MS } from '../common/time.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysAhead } from './dates.testing.js';

// V2-19 (QUALITY T-03): a booking through the whole application over HTTP, signed in with a real session: the booking
// itself, a start in the past (V2-02 regression), a long history, cancelling, and whose record is whose.
// Runs only on a database whose name contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

type Json = Record<string, any>;

describeDb('reservations over HTTP (gerçek PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let base = '';
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branchId: '' };
  const vehicleIds: string[] = [];
  const userEmails: string[] = [];
  let hits = 0;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
    prisma = app.get(PrismaService);

    ids.classId = (
      await prisma.vehicleClass.create({ data: { slug: `rez-sinif-${run}`, nameTr: 'Rez', nameEn: 'Res' } })
    ).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `rez-model-${run}`,
          brand: 'Test',
          model: `Rezervasyon ${run}`,
          seats: 5,
          bags: 3,
          transmission: 'AUTOMATIC',
          fuelType: 'PETROL',
          consumption: 5.5,
          consumptionUnit: 'L_PER_100KM',
          dailyPrice: 125000,
          description: { tr: 'Test', en: 'Test' },
          classId: ids.classId,
        },
      })
    ).id;
    ids.branchId = (
      await prisma.branch.create({
        data: {
          name: `Rez bayi ${run}`,
          city: 'Testville',
          address: 'Test adresi',
          latitude: 1,
          longitude: 1,
          phone: '+90 000 000 00 00',
          email: `rez-${run}@example.test`,
          openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' },
        },
      })
    ).id;
    for (let i = 0; i < 6; i += 1) {
      vehicleIds.push(
        (
          await prisma.vehicle.create({
            data: { plate: `R${run}${i}`, year: 2026, vehicleModelId: ids.modelId, branchId: ids.branchId },
          })
        ).id,
      );
    }
  });

  afterAll(async () => {
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: vehicleIds } } });
    await prisma.user.deleteMany({ where: { email: { in: userEmails } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: vehicleIds } } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await app.close();
  });

  // Each call comes from its own address, so the per-address limits of the real guard are never the thing tested.
  const send = (path: string, init: RequestInit & { cookie?: string } = {}) =>
    fetch(base + path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.21.${Math.floor(hits / 250)}.${(hits += 1) % 250}`,
        ...(init.cookie ? { Cookie: init.cookie } : {}),
      },
    });

  async function signUp(label: string): Promise<{ cookie: string; id: string }> {
    const email = `rez-${label}-${run}@example.test`;
    userEmails.push(email);
    const response = await send('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'kisa-ama-uzun-1', firstName: 'Test', lastName: label, consent: true }),
    });
    expect(response.status).toBe(201);
    return {
      cookie: (response.headers.get('set-cookie') ?? '').split(';')[0]!,
      id: ((await response.json()) as Json).id,
    };
  }

  const bookingBody = (vehicleId: string, startAt: Date, days = 2): Json => ({
    vehicleId,
    pickupBranchId: ids.branchId,
    returnBranchId: ids.branchId,
    startAt: startAt.toISOString(),
    endAt: new Date(startAt.getTime() + days * DAY_MS).toISOString(),
    currency: 'TRY',
  });
  const book = (cookie: string, body: Json) =>
    send('/reservations', { method: 'POST', cookie, body: JSON.stringify(body) });

  it('books a car, and the booking shows in the account with the stored price', async () => {
    const { cookie } = await signUp('ilk');
    const response = await book(cookie, bookingBody(vehicleIds[0]!, daysAhead(40)));
    expect(response.status).toBe(201);
    const created = (await response.json()) as Json;
    expect(created).toMatchObject({
      status: 'CONFIRMED',
      price: { days: 2, total: { amount: 250000, currency: 'TRY' } },
    });
    expect(created.number).toMatch(/^NVR-\d{4}-\d{5,}$/);

    const mine = await send('/me/reservations', { cookie });
    expect(mine.status).toBe(200);
    expect(((await mine.json()) as Json[]).map((entry) => entry.id)).toEqual([created.id]);
  });

  // V2-02 regression: a start in the past was accepted and charged.
  it.each([
    ['yesterday', -1],
    ['a year ago', -365],
  ])('refuses a start %s with 422 IN_PAST, and keeps nothing', async (_label, days) => {
    const { cookie, id } = await signUp(`gecmis${days}`);
    const response = await book(cookie, bookingBody(vehicleIds[1]!, daysAhead(days)));
    expect(response.status).toBe(422);
    expect(((await response.json()) as Json).fieldErrors.startAt).toBe('IN_PAST');
    expect(await prisma.reservation.count({ where: { userId: id } })).toBe(0);
  });

  it('refuses a booking without a session (401) and with a malformed body (422)', async () => {
    expect((await book('', bookingBody(vehicleIds[2]!, daysAhead(41)))).status).toBe(401);
    const { cookie } = await signUp('govde');
    const bad = await book(cookie, { vehicleId: 42, startAt: 'yarın' });
    expect(bad.status).toBe(422);
    expect(Object.keys(((await bad.json()) as Json).fieldErrors).length).toBeGreaterThan(2);
  });

  it('keeps a long history in order and answers in reasonable time (a hundred and twenty past bookings)', async () => {
    const { cookie, id } = await signUp('hacim');
    const rows = Array.from({ length: 120 }, (_, index) => {
      const startAt = daysAhead(-400 + index * 3);
      return {
        number: `VOL-${run}-${String(index).padStart(3, '0')}`,
        status: 'CONFIRMED' as const,
        startAt,
        endAt: new Date(startAt.getTime() + 2 * DAY_MS),
        days: 2,
        vehicleDailyPrice: 125000,
        totalPrice: 250000,
        vehicleId: vehicleIds[index % vehicleIds.length]!,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
        userId: id,
      };
    });
    await prisma.reservation.createMany({ data: rows });

    const started = Date.now();
    const response = await send('/me/reservations', { cookie });
    const elapsed = Date.now() - started;
    expect(response.status).toBe(200);
    const list = (await response.json()) as Json[];
    expect(list).toHaveLength(120);
    const starts = list.map((entry) => new Date(entry.startAt).getTime());
    expect(starts).toEqual([...starts].sort((a, b) => b - a));
    expect(elapsed).toBeLessThan(2000);
  });

  it('cancels an upcoming booking once, stores when, frees the car, and repeating it changes nothing', async () => {
    const { cookie, id } = await signUp('iptal');
    const created = (await (await book(cookie, bookingBody(vehicleIds[3]!, daysAhead(45)))).json()) as Json;

    const first = await send(`/me/reservations/${created.id}/cancel`, { method: 'POST', cookie });
    expect(first.status).toBe(200);
    expect(((await first.json()) as Json).status).toBe('CANCELLED');
    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.cancelledAt).toBeInstanceOf(Date);

    const again = await send(`/me/reservations/${created.id}/cancel`, { method: 'POST', cookie });
    expect(again.status).toBe(200);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } })).cancelledAt).toEqual(
      row.cancelledAt,
    );

    // The car can be taken again for the same days.
    const other = await signUp('iptal-sonra');
    expect((await book(other.cookie, bookingBody(vehicleIds[3]!, daysAhead(45)))).status).toBe(201);
    expect(await prisma.reservation.count({ where: { userId: id, status: 'CANCELLED' } })).toBe(1);
  });

  it("someone else's booking is a 404 to read and to cancel, and nothing about it leaks", async () => {
    const owner = await signUp('sahip');
    const stranger = await signUp('yabanci');
    const created = (await (await book(owner.cookie, bookingBody(vehicleIds[4]!, daysAhead(50)))).json()) as Json;

    const statuses: number[] = [];
    for (const [method, path] of [
      ['GET', `/me/reservations/${created.id}`],
      ['POST', `/me/reservations/${created.id}/cancel`],
    ] as const) {
      statuses.push((await send(path, { method, cookie: stranger.cookie })).status);
    }
    expect(statuses).toEqual([404, 404]);
    expect(((await (await send('/me/reservations', { cookie: stranger.cookie })).json()) as Json[]).length).toBe(0);
    expect((await prisma.reservation.findUniqueOrThrow({ where: { id: created.id } })).status).toBe('CONFIRMED');
  });
});
