import 'dotenv/config';
import { randomInt, randomUUID } from 'node:crypto';
import { AdminRequestsService } from '../admin/requests/requests.service.js';
import { AdminReservationsService } from '../admin/reservations/reservations.service.js';
import type { UserRow } from '../auth/user-view.js';
import { testPlate } from '../common/plate.testing.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { daysAhead } from '../reservations/dates.testing.js';
import { PricingService } from '../reservations/pricing.service.js';
import { ReservationsService } from '../reservations/reservations.service.js';
import { MailService } from './mail.service.js';
import { NotificationsService } from './notifications.service.js';
import { REMINDER_LEAD_MS, RemindersService } from './reminders.service.js';

// The e-mails of V2-44 against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped without one. What the issue
// names is here: the four kinds arrive (to the right person, in their language, with what they should and should not say), a person who turned
// the reminders off gets none, the same booking is never reminded twice (not even by two runs at once), and with the mail service off or broken
// every flow goes on as it did. The test database is shared with suites that run at the same time, so only this run's own addresses are looked at.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const HOUR = 3_600_000;
const NOW = new Date('2026-11-10T09:00:00.000Z');
const after = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

describeDb('the e-mails about bookings and requests against the database (V2-44)', () => {
  let prisma: PrismaService;
  let mail: MailService;
  let notifications: NotificationsService;
  let reminders: RemindersService;
  let admin: AdminReservationsService;
  let customer: ReservationsService;
  let desk: AdminRequestsService;
  const run = randomUUID().slice(0, 8);
  const ids = { classId: '', modelId: '', branch: '', other: '', vehicleId: '', adminId: '', companyId: '' };
  const users = {} as Record<'ayse' | 'john' | 'off' | 'closed' | 'firma', { id: string; email: string }>;
  const made: string[] = [];
  const requests: string[] = [];
  let sent: Array<{ to: string; subject: string; text: string; html: string }>;
  let answer: () => Promise<Response>;
  const savedEnv: Record<string, string | undefined> = {};

  const mine = () => sent.filter((message) => message.to.endsWith(`-${run}@example.test`));
  const to = (email: string) => mine().filter((message) => message.to === email);

  const book = async (userId: string | null, overrides: Record<string, unknown> = {}) => {
    const row = await prisma.reservation.create({
      data: {
        number: `NVR-2999-${randomInt(10_000_000, 99_999_999)}`,
        startAt: after(100),
        endAt: after(124),
        days: 1,
        vehicleDailyPrice: 100000,
        totalPrice: 123456,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branch,
        returnBranchId: ids.other,
        userId,
        createdAt: after(-100),
        ...overrides,
      },
    });
    made.push(row.id);
    return row;
  };
  const reminded = async (id: string) => (await prisma.reservation.findUniqueOrThrow({ where: { id }, select: { reminderSentAt: true } })).reminderSentAt;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    for (const key of ['RESEND_API_KEY', 'MAIL_FROM', 'WEB_URL']) savedEnv[key] = process.env[key];
    prisma = new PrismaService();
    await prisma.$connect();
    mail = new MailService();
    mail.fetcher = async (_url, init) => {
      const body = JSON.parse(init.body as string) as { to: string[]; subject: string; text: string; html: string };
      sent.push({ to: body.to[0]!, subject: body.subject, text: body.text, html: body.html });
      return answer();
    };
    notifications = new NotificationsService(prisma, mail);
    reminders = new RemindersService(prisma, mail, notifications);
    admin = new AdminReservationsService(prisma, notifications);
    customer = new ReservationsService(prisma, new PricingService(prisma), notifications);
    desk = new AdminRequestsService(prisma, notifications);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v44c-${run}`, nameTr: 'Deneme', nameEn: 'Test' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: { slug: `v44m-${run}`, brand: 'Deneme', model: 'Eposta', seats: 5, bags: 2, transmission: 'MANUAL', fuelType: 'PETROL', consumption: 5.4, consumptionUnit: 'L_PER_100KM', dailyPrice: 100000, description: { tr: 'Deneme', en: 'Test' }, classId: ids.classId },
      })
    ).id;
    const branch = (name: string, city: string) =>
      prisma.branch.create({
        data: { name: `${name} ${run}`, city, address: 'Test', latitude: 39.9, longitude: 32.8, phone: '+90 312 555 00 00', email: `${name.toLowerCase()}-${run}@example.test`, openingHours: { weekdays: '00:00-23:59', saturday: '00:00-23:59', sunday: '00:00-23:59' } },
      });
    ids.branch = (await branch('Alis', 'İzmir')).id;
    ids.other = (await branch('Donus', 'Ankara')).id;
    ids.vehicleId = (await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: ids.branch } })).id;
    ids.companyId = (await prisma.company.create({ data: { name: `V44 Firma ${run}` } })).id;
    const user = async (key: keyof typeof users, first: string, extra: Record<string, unknown> = {}) => {
      const email = `${key}-${run}@example.test`;
      users[key] = { id: (await prisma.user.create({ data: { email, passwordHash: 'x', firstName: first, lastName: 'Gizli', accountType: 'INDIVIDUAL', ...extra } })).id, email };
    };
    await user('ayse', 'Ayşe', { locale: 'TR' });
    await user('john', 'John', { locale: 'EN' });
    await user('off', 'Ece', { notifyReminders: false });
    await user('closed', 'Can', { disabledAt: new Date('2026-01-01T00:00:00Z') });
    await user('firma', 'Fatma', { accountType: 'CORPORATE', companyId: ids.companyId, locale: 'TR' });
    ids.adminId = (await prisma.user.create({ data: { email: `yonetici-${run}@example.test`, passwordHash: 'x', firstName: 'Ece', lastName: 'Yönetici', accountType: 'INDIVIDUAL', role: 'ADMIN' } })).id;
  });

  beforeEach(() => {
    sent = [];
    answer = async () => new Response('{"id":"1"}', { status: 200 });
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.MAIL_FROM = 'Novera <bildirim@novera.example>';
    process.env.WEB_URL = 'https://novera.example';
  });

  afterAll(async () => {
    for (const key of Object.keys(savedEnv)) {
      if (savedEnv[key] === undefined) delete process.env[key];
      else process.env[key] = savedEnv[key];
    }
    await prisma.serviceRequestEvent.deleteMany({ where: { request: { number: { in: requests } } } });
    await prisma.serviceRequest.deleteMany({ where: { number: { in: requests } } });
    await prisma.reservation.deleteMany({ where: { id: { in: made } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.branch.deleteMany({ where: { id: { in: [ids.branch, ids.other] } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
    await prisma.company.deleteMany({ where: { id: ids.companyId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('a booking confirmed', () => {
    it('goes to the person, in their language, with the number, the car, the places and the link to the terms', async () => {
      const tr = await book(users.ayse.id);
      const en = await book(users.john.id);
      expect(await notifications.sendReservation(tr.id, 'confirmed')).toBe(true);
      expect(await notifications.sendReservation(en.id, 'confirmed')).toBe(true);
      const [turkish] = to(users.ayse.email);
      const [english] = to(users.john.email);
      expect(turkish!.subject).toBe(`Rezervasyonun onaylandı (${tr.number})`);
      for (const part of ['Merhaba Ayşe,', 'Deneme Eposta', `Alis ${run}, İzmir`, `Donus ${run}, Ankara`, '1.234,56', 'https://novera.example/kiralama-kosullari']) expect(turkish!.text).toContain(part);
      expect(english!.subject).toBe(`Your booking is confirmed (${en.number})`);
      expect(english!.text).toContain('https://novera.example/en/rental-terms');
    });

    it('is sent by the booking itself, after it is saved and without being waited for', async () => {
      const booked = await book(users.ayse.id);
      notifications.reservationConfirmed(booked.id);
      expect(to(users.ayse.email).length).toBeLessThanOrEqual(1);
      await notifications.idle();
      expect(to(users.ayse.email).map((message) => message.subject)).toEqual([`Rezervasyonun onaylandı (${booked.number})`]);
    });

    it('is sent when a booking is really made through the service: one e-mail, with its number, and the answer is the same as without the mail', async () => {
      const start = daysAhead(40);
      const body = { vehicleId: ids.vehicleId, pickupBranchId: ids.branch, returnBranchId: ids.other, startAt: start.toISOString(), endAt: new Date(start.getTime() + 2 * 86_400_000).toISOString(), currency: 'TRY' };
      const view = await customer.create({ ...(await prisma.user.findUniqueOrThrow({ where: { id: users.john.id } })) } as unknown as UserRow, body);
      made.push(view.id);
      await notifications.idle();
      expect(to(users.john.email).map((message) => message.subject)).toEqual([`Your booking is confirmed (${view.number})`]);
      expect(view.status).toBe('CONFIRMED');
    });

    it('is not sent to a booking with no account, to a closed account, or for a booking that has been cancelled since', async () => {
      const orphan = await book(null);
      const closed = await book(users.closed.id);
      const gone = await book(users.ayse.id, { status: 'CANCELLED', cancelledAt: after(-1) });
      for (const row of [orphan, closed, gone]) expect(await notifications.sendReservation(row.id, 'confirmed')).toBe(false);
      expect(mine()).toEqual([]);
    });
  });

  describe('a booking cancelled', () => {
    it('is told to the person by the cancelling, and a second call sends nothing', async () => {
      const row = await book(users.john.id, { startAt: after(500), endAt: after(524) });
      await customer.cancel(users.john.id, row.id, NOW);
      await notifications.idle();
      expect(to(users.john.email).map((message) => message.subject)).toEqual([`Your booking was cancelled (${row.number})`]);
      await customer.cancel(users.john.id, row.id, NOW);
      await notifications.idle();
      expect(to(users.john.email)).toHaveLength(1);
    });

    it('is told when the administration cancels it too, and the reason is not in it', async () => {
      const row = await book(users.ayse.id, { startAt: after(500), endAt: after(524) });
      await admin.cancel(row.number, { reason: 'Araç kazalı, çok özel bir neden' }, ids.adminId, NOW);
      await notifications.idle();
      const [message] = to(users.ayse.email);
      expect(message!.subject).toBe(`Rezervasyonun iptal edildi (${row.number})`);
      expect(message!.text + message!.html).not.toContain('kazalı');
      expect(message!.text + message!.html).not.toContain('özel bir neden');
    });

    it('is not sent when nothing was cancelled (a rental that has begun is refused)', async () => {
      const started = await book(users.ayse.id, { startAt: after(-2), endAt: after(20) });
      await expect(customer.cancel(users.ayse.id, started.id, NOW)).rejects.toBeDefined();
      await notifications.idle();
      expect(mine()).toEqual([]);
    });
  });

  describe('the reminder', () => {
    it('goes to a confirmed booking that begins within 24 hours, once, to the right person in their language', async () => {
      const due = await book(users.ayse.id, { startAt: after(20), endAt: after(44) });
      const english = await book(users.john.id, { startAt: after(23), endAt: after(47) });
      const first = await reminders.run(NOW);
      expect(first.sent).toBeGreaterThanOrEqual(2);
      expect(to(users.ayse.email).map((message) => message.subject)).toEqual([`Yarın aracını teslim alıyorsun (${due.number})`]);
      expect(to(users.john.email).map((message) => message.subject)).toEqual([`You pick up your car tomorrow (${english.number})`]);
      expect(await reminded(due.id)).toEqual(NOW);

      sent = [];
      await reminders.run(NOW);
      await reminders.run(new Date(NOW.getTime() + HOUR));
      expect(mine()).toEqual([]);
    });

    it('does not go to a rental that is further than 24 hours away, one that has begun, or one that was cancelled', async () => {
      const far = await book(users.ayse.id, { startAt: after(30), endAt: after(54) });
      const begun = await book(users.ayse.id, { startAt: after(-1), endAt: after(23) });
      const cancelled = await book(users.ayse.id, { startAt: after(10), endAt: after(34), status: 'CANCELLED', cancelledAt: after(-5) });
      await reminders.run(NOW);
      expect(mine()).toEqual([]);
      for (const row of [far, begun, cancelled]) expect(await reminded(row.id)).toBeNull();
      // Six hours later the far one is within the day.
      await reminders.run(after(7));
      expect(to(users.ayse.email).map((message) => message.subject)).toEqual([`Yarın aracını teslim alıyorsun (${far.number})`]);
    });

    it('does not go to a person who turned the reminders off, or to a closed account, and marks nothing of theirs', async () => {
      const off = await book(users.off.id, { startAt: after(10), endAt: after(34) });
      const closed = await book(users.closed.id, { startAt: after(10), endAt: after(34) });
      await reminders.run(NOW);
      expect(mine()).toEqual([]);
      expect(await reminded(off.id)).toBeNull();
      expect(await reminded(closed.id)).toBeNull();
    });

    it('does not go to a booking made less than 24 hours before the pickup: the confirmation has just said it', async () => {
      const late = await book(users.ayse.id, { startAt: after(10), endAt: after(34), createdAt: after(-2) });
      const result = await reminders.run(NOW);
      expect(result.skipped).toBeGreaterThanOrEqual(1);
      expect(mine()).toEqual([]);
      expect(await reminded(late.id)).toBeNull();
    });

    it('is sent once when two runs happen at the same time', async () => {
      const row = await book(users.ayse.id, { startAt: after(12), endAt: after(36) });
      await Promise.all([reminders.run(NOW), reminders.run(NOW), reminders.run(NOW)]);
      expect(to(users.ayse.email)).toHaveLength(1);
      expect(await reminded(row.id)).toEqual(NOW);
    });

    it('is tried again by the next run when the mail provider failed, and sent once it answers', async () => {
      const row = await book(users.john.id, { startAt: after(12), endAt: after(36) });
      answer = async () => new Response('{}', { status: 500 });
      const failed = await reminders.run(NOW);
      expect(failed.failed).toBeGreaterThanOrEqual(1);
      expect(await reminded(row.id)).toBeNull();
      answer = async () => new Response('{"id":"1"}', { status: 200 });
      await reminders.run(new Date(NOW.getTime() + HOUR));
      expect(await reminded(row.id)).not.toBeNull();
      expect(to(users.john.email).filter((message) => message.subject.includes(row.number))).toHaveLength(2);
    });

    it('marks nothing while no mail provider is set up, so the rentals ahead are reminded the day one is', async () => {
      delete process.env.RESEND_API_KEY;
      const row = await book(users.ayse.id, { startAt: after(12), endAt: after(36) });
      expect(await reminders.run(NOW)).toEqual({ due: 0, sent: 0, failed: 0, skipped: 0 });
      expect(await reminded(row.id)).toBeNull();
      process.env.RESEND_API_KEY = 're_test_key';
      await reminders.run(NOW);
      expect(await reminded(row.id)).toEqual(NOW);
    });

    it('is 24 hours before the start', () => {
      expect(REMINDER_LEAD_MS).toBe(24 * HOUR);
    });
  });

  describe('a request that moved', () => {
    const open = async () => {
      const number = `TLP-2999-${randomInt(10_000, 99_999)}`;
      await prisma.serviceRequest.create({ data: { number, companyId: ids.companyId, createdById: users.firma.id, type: 'TRANSFER', details: {} } });
      requests.push(number);
      return number;
    };

    it('is told to the person who opened it, by the words of the step, without the note and without the driver', async () => {
      const number = await open();
      await desk.setStatus(number, ids.adminId, { status: 'DRIVER_ASSIGNED', note: 'Gizli iç not', assignee: 'Şoför Mehmet 0555 000 00 00' }, NOW);
      await notifications.idle();
      const [message] = to(users.firma.email);
      expect(message!.subject).toBe(`Talebin güncellendi: Şoför atandı (${number})`);
      expect(message!.text).toContain('VIP transfer');
      expect(message!.text).toContain(`https://novera.example/filom/talepler/${number}`);
      expect(message!.text + message!.html).not.toMatch(/Gizli iç not|Mehmet|0555/);
    });

    it('is not sent when the move is refused, or when the request has no one to tell', async () => {
      const refused = await open();
      await expect(desk.setStatus(refused, ids.adminId, { status: 'RECEIVED' }, NOW)).rejects.toBeDefined();
      const orphan = await open();
      await prisma.serviceRequest.update({ where: { number: orphan }, data: { createdById: null } });
      await desk.setStatus(orphan, ids.adminId, { status: 'CANCELLED' }, NOW);
      await notifications.idle();
      expect(mine()).toEqual([]);
    });
  });

  describe('with the mail service off or broken', () => {
    it('leaves every flow as it was: the answers are the same and nothing throws', async () => {
      delete process.env.RESEND_API_KEY;
      const off = await book(users.ayse.id, { startAt: after(500), endAt: after(524) });
      expect((await customer.cancel(users.ayse.id, off.id, NOW)).status).toBe('CANCELLED');
      const requestNumber = `TLP-2999-${randomInt(10_000, 99_999)}`;
      await prisma.serviceRequest.create({ data: { number: requestNumber, companyId: ids.companyId, createdById: users.firma.id, type: 'TRANSFER', details: {} } });
      requests.push(requestNumber);
      expect((await desk.setStatus(requestNumber, ids.adminId, { status: 'CANCELLED' }, NOW)).status).toBe('CANCELLED');
      await notifications.idle();
      expect(sent).toEqual([]);
    });

    it('does the same when the provider answers with an error or the connection fails', async () => {
      const broken = await book(users.ayse.id, { startAt: after(500), endAt: after(524) });
      answer = async () => new Response('{}', { status: 503 });
      expect((await customer.cancel(users.ayse.id, broken.id, NOW)).status).toBe('CANCELLED');
      mail.fetcher = async () => {
        throw new TypeError('fetch failed');
      };
      const second = await book(users.ayse.id, { startAt: after(500), endAt: after(524) });
      expect((await admin.cancel(second.number, { reason: 'Deneme amaçlı iptal' }, ids.adminId, NOW)).status).toBe('CANCELLED');
      await notifications.idle();
    });
  });
});
