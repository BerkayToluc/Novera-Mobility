import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { retentionCutoff } from './retention.js';
import { RetentionTask } from './retention.task.js';

// V2-12 against a real PostgreSQL: the retention task and the erasure that comes with deleting an account.
// Runs only on a database whose name contains "test"; skipped without TEST_DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const NOW = new Date('2026-10-29T10:00:00.000Z');
const monthsAgo = (months: number) => {
  const date = new Date(NOW.getTime());
  date.setUTCMonth(date.getUTCMonth() - months);
  return date;
};

describeDb('personal data retention (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
  });
  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({ where: { number: { startsWith: `T-${run}` } } });
    await prisma.contactMessage.deleteMany({ where: { subject: { startsWith: `T-${run}` } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  const message = (label: string, createdAt: Date) =>
    prisma.contactMessage.create({
      data: {
        name: 'Ayşe Yılmaz', email: `ayse-${label}-${run}@example.test`, phone: '+90 555 000 00 00',
        subject: `T-${run} ${label}`, message: 'Merhaba, kişisel bir ayrıntı içeriyorum.', kvkkConsentAt: createdAt, createdAt,
      },
    });
  const quote = (label: string, createdAt: Date, userId: string | null = null) =>
    prisma.quoteRequest.create({
      data: {
        number: `T-${run}-${label}`, companyName: 'Ege Lojistik', contactName: 'Mert Kaya', phone: '+90 555 111 11 11',
        email: `mert-${label}-${run}@example.test`, notes: 'Teslimat için kapı kodu 1234', deliveryCities: 'İzmir',
        vehicleCount: 5, durationMonths: 12, vehicleType: 'SUV', createdAt, userId,
      },
    });

  it('the cut-off is two years before the given moment', () => {
    expect(retentionCutoff(NOW).toISOString()).toBe('2024-10-29T10:00:00.000Z');
  });

  it('a message and a quote older than two years lose their personal fields; younger ones stay as they are', async () => {
    const oldMessage = await message('old', monthsAgo(25));
    const youngMessage = await message('young', monthsAgo(23));
    const oldQuote = await quote('old', monthsAgo(30));
    const youngQuote = await quote('young', monthsAgo(6));

    const result = await new RetentionTask(prisma).run(NOW);
    expect(result.contactMessages).toBeGreaterThanOrEqual(1);
    expect(result.quoteRequests).toBeGreaterThanOrEqual(1);

    const erasedMessage = await prisma.contactMessage.findUniqueOrThrow({ where: { id: oldMessage.id } });
    expect(erasedMessage).toMatchObject({ name: 'Silindi', email: '', phone: null, message: '', anonymizedAt: NOW });
    expect(erasedMessage.subject).toBe(`T-${run} old`); // the subject and the date stay for the figures
    expect(erasedMessage.createdAt).toEqual(oldMessage.createdAt);

    const erasedQuote = await prisma.quoteRequest.findUniqueOrThrow({ where: { id: oldQuote.id } });
    expect(erasedQuote).toMatchObject({ contactName: 'Silindi', email: '', phone: null, notes: null, anonymizedAt: NOW });
    expect(erasedQuote).toMatchObject({ companyName: 'Ege Lojistik', vehicleCount: 5, status: 'RECEIVED' }); // company and request stay

    expect(await prisma.contactMessage.findUniqueOrThrow({ where: { id: youngMessage.id } })).toMatchObject({
      name: 'Ayşe Yılmaz', anonymizedAt: null,
    });
    expect(await prisma.quoteRequest.findUniqueOrThrow({ where: { id: youngQuote.id } })).toMatchObject({
      contactName: 'Mert Kaya', anonymizedAt: null,
    });
  });

  it('a second run changes nothing that was already anonymised', async () => {
    const before = await prisma.contactMessage.findFirstOrThrow({ where: { subject: `T-${run} old` } });
    await new RetentionTask(prisma).run(new Date(NOW.getTime() + 24 * 60 * 60 * 1000));
    const after = await prisma.contactMessage.findFirstOrThrow({ where: { subject: `T-${run} old` } });
    expect(after.anonymizedAt).toEqual(before.anonymizedAt);
  });

  it('deleting an account erases the personal fields of its quote requests at once, and keeps the rest', async () => {
    const user = await prisma.user.create({ data: { email: `del-${run}@example.test`, firstName: 'Mert', lastName: 'Kaya', passwordHash: 'x' } });
    userIds.push(user.id);
    const mine = await quote('mine', monthsAgo(1), user.id);
    const other = await quote('other', monthsAgo(1));

    await new AuthService(prisma).deleteAccount(user.id, NOW);

    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    const erased = await prisma.quoteRequest.findUniqueOrThrow({ where: { id: mine.id } });
    expect(erased).toMatchObject({ userId: null, contactName: 'Silindi', email: '', phone: null, notes: null, anonymizedAt: NOW });
    expect(erased).toMatchObject({ companyName: 'Ege Lojistik', deliveryCities: 'İzmir', vehicleCount: 5 });
    expect(await prisma.quoteRequest.findUniqueOrThrow({ where: { id: other.id } })).toMatchObject({ contactName: 'Mert Kaya', anonymizedAt: null });
  });
});
