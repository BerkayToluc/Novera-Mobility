import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminSummaryService } from '../admin-summary.service.js';
import { AdminMessagesService } from './messages.service.js';

// The contact message administration against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped
// without one. The test database is shared with suites that run at the same time, so every list is narrowed to this run's own
// messages by a word in the e-mail address.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

describeDb('contact message administration against the database (V2-32)', () => {
  let prisma: PrismaService;
  let service: AdminMessagesService;
  const run = randomUUID().slice(0, 8);
  const made: string[] = [];
  const ids = { ece: '', deniz: '' };

  const message = async (overrides: Record<string, unknown> = {}) => {
    const row = await prisma.contactMessage.create({
      data: {
        name: 'Ayşe Yılmaz',
        email: `ayse-${run}@example.test`,
        phone: '+90 532 555 01 01',
        subject: 'Kurumsal fiyat sorusu',
        message: 'Merhaba, on araçlık bir filo için fiyat almak istiyoruz. Kasım ayında teslim gerekiyor.',
        kvkkConsentAt: new Date(),
        ...overrides,
      },
    });
    made.push(row.id);
    return row;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AdminMessagesService(prisma);
    const admin = (name: string) =>
      prisma.user.create({ data: { email: `${name.toLowerCase()}-${run}@example.test`, passwordHash: 'x', firstName: name, lastName: 'Yönetici', role: 'ADMIN' } });
    ids.ece = (await admin('Ece')).id;
    ids.deniz = (await admin('Deniz')).id;
  });

  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { id: { in: made } } });
    await prisma.user.deleteMany({ where: { id: { in: [ids.ece, ids.deniz] } } });
    await prisma.$disconnect();
  });

  describe('listing', () => {
    it('lists the messages newest first, each with a preview, and the full text only on its own page', async () => {
      const older = await message({ createdAt: new Date('2098-01-01T10:00:00Z') });
      const newer = await message({ createdAt: new Date('2098-02-01T10:00:00Z'), message: 'Kısa mesaj.' });
      const page = await service.list({ q: run, pageSize: '100' });
      const numbers = page.items.map((item) => item.id);
      expect(numbers.indexOf(newer.id)).toBeLessThan(numbers.indexOf(older.id));
      const item = page.items.find((entry) => entry.id === older.id)!;
      expect(item).toMatchObject({ name: 'Ayşe Yılmaz', subject: 'Kurumsal fiyat sorusu', handledAt: null, anonymized: false });
      expect(item.preview).toContain('on araçlık bir filo');
      expect(Object.keys(item)).not.toContain('message');
    });

    it('cuts a long message to a preview that ends with an ellipsis', async () => {
      const row = await message({ message: `${'Uzun mesaj '.repeat(40)}sonu` });
      const item = (await service.list({ q: run, pageSize: '100' })).items.find((entry) => entry.id === row.id)!;
      expect(item.preview.length).toBeLessThanOrEqual(120);
      expect(item.preview.endsWith('…')).toBe(true);
      expect((await service.get(row.id)).message).toContain('sonu');
    });

    it('finds a message by a part of the name, the e-mail or the subject, whatever the case', async () => {
      const row = await message({ subject: `Özel konu ${run}` });
      // Capitals are folded for the letters of the English alphabet (what the database does); a Turkish capital such as Ş is matched as written.
      for (const q of ['AYşe', `AYSE-${run.toUpperCase()}`, `özel KONU ${run}`]) {
        expect((await service.list({ q, pageSize: '100' })).items.map((item) => item.id)).toContain(row.id);
      }
      expect((await service.list({ q: `nobody-${run}` })).total).toBe(0);
    });

    it('narrows to the ones waiting, and to the ones handled', async () => {
      const waiting = await message();
      const handled = await message({ handledAt: new Date() });
      const erased = await message({ name: 'Silindi', email: `silindi-${run}@example.test`, phone: null, message: '', anonymizedAt: new Date() });
      const ids_ = (extra: Record<string, unknown>) => service.list({ q: run, pageSize: '100', ...extra }).then((page) => page.items.map((item) => item.id));
      const todo = await ids_({ handled: 'false' });
      expect(todo).toContain(waiting.id);
      expect(todo).not.toContain(handled.id);
      // A message the retention task already erased has nothing left to answer, so it does not wait.
      expect(todo).not.toContain(erased.id);
      const done = await ids_({ handled: 'true' });
      expect(done).toContain(handled.id);
      expect(done).not.toContain(waiting.id);
      // Without the filter the erased one is there too, marked.
      const everything = (await service.list({ q: run, pageSize: '100' })).items;
      expect(everything.find((item) => item.id === erased.id)).toMatchObject({ anonymized: true, name: 'Silindi' });
    });

    it('the list that the summary card opens has the same total as the card', async () => {
      await message();
      await message({ anonymizedAt: new Date(), message: '' });
      await message({ handledAt: new Date() });
      // Both counted over this run's rows only: the table is shared with suites that run at the same time.
      const own = { email: { contains: run } };
      const card = await prisma.contactMessage.count({ where: { handledAt: null, anonymizedAt: null, ...own } });
      const list = await service.list({ handled: 'false', q: run, pageSize: '100' });
      expect(list.items.length).toBe(card);
      const summaryOnOwn = {
        reservation: prisma.reservation,
        serviceRequest: prisma.serviceRequest,
        quoteRequest: prisma.quoteRequest,
        contactMessage: { count: (args: { where?: object }) => prisma.contactMessage.count({ where: { ...args.where, ...own } }) },
      };
      expect((await new AdminSummaryService(summaryOnOwn as unknown as PrismaService).get()).unhandledMessages).toBe(card);
    });

    it('pages with a total that does not change, and every message comes once', async () => {
      const same = new Date('2097-05-05T10:00:00Z');
      for (let index = 0; index < 5; index += 1) await message({ email: `sayfa-${run}@example.test`, createdAt: same });
      const all = await service.list({ q: `sayfa-${run}`, pageSize: '100' });
      const first = await service.list({ q: `sayfa-${run}`, pageSize: '2', page: '1' });
      const second = await service.list({ q: `sayfa-${run}`, pageSize: '2', page: '2' });
      expect(first.total).toBe(5);
      const seen = [...first.items, ...second.items].map((item) => item.id);
      expect(new Set(seen).size).toBe(4);
      expect(seen).toEqual(all.items.slice(0, 4).map((item) => item.id));
    });

    it('is 422 for a filter or a sort that makes no sense', async () => {
      expect((await refused(service.list({ handled: 'maybe' }))).body).toMatchObject({ fieldErrors: { handled: 'INVALID_FORMAT' } });
      expect((await refused(service.list({ sort: 'message:asc' }))).body).toMatchObject({ fieldErrors: { sort: 'INVALID_FORMAT' } });
    });
  });

  describe('one message', () => {
    it('gives the whole message, the phone, and who handled it', async () => {
      const row = await message({ handledAt: new Date(), handledById: ids.ece });
      expect(await service.get(row.id)).toMatchObject({
        id: row.id,
        phone: '+90 532 555 01 01',
        message: expect.stringContaining('Kasım ayında'),
        handledBy: { name: 'Ece Yönetici', email: `ece-${run}@example.test` },
      });
    });

    it('is 404 for an id that is not there or cannot be one', async () => {
      expect((await refused(service.get(randomUUID()))).status).toBe(404);
      expect((await refused(service.get('not-an-id'))).status).toBe(404);
      expect((await refused(service.handle('not-an-id', { handled: true }, ids.ece))).status).toBe(404);
      expect((await refused(service.handle(randomUUID(), { handled: true }, ids.ece))).status).toBe(404);
    });
  });

  describe('the handled mark', () => {
    it('is put on with the time and the administrator, and taken back', async () => {
      const row = await message();
      const now = new Date('2098-03-01T10:00:00Z');
      const marked = await service.handle(row.id, { handled: true }, ids.ece, now);
      expect(marked).toMatchObject({ handledAt: now.toISOString(), handledBy: { email: `ece-${run}@example.test` } });
      expect(await prisma.contactMessage.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ handledById: ids.ece });

      const undone = await service.handle(row.id, { handled: false }, ids.ece);
      expect(undone).toMatchObject({ handledAt: null, handledBy: null });
      expect(await prisma.contactMessage.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({ handledAt: null, handledById: null });
    });

    it('marked again by someone else, it keeps the first time and the first person', async () => {
      const row = await message();
      const first = new Date('2098-03-01T10:00:00Z');
      await service.handle(row.id, { handled: true }, ids.ece, first);
      const again = await service.handle(row.id, { handled: true }, ids.deniz, new Date('2098-03-02T10:00:00Z'));
      expect(again).toMatchObject({ handledAt: first.toISOString(), handledBy: { email: `ece-${run}@example.test` } });
    });

    it('two administrators pressing together leave one mark', async () => {
      const row = await message();
      await Promise.all([service.handle(row.id, { handled: true }, ids.ece), service.handle(row.id, { handled: true }, ids.deniz)]);
      const stored = await prisma.contactMessage.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored.handledAt).toBeInstanceOf(Date);
      expect([ids.ece, ids.deniz]).toContain(stored.handledById);
    });

    it('taking it back on a message that was never marked is no error', async () => {
      const row = await message();
      expect(await service.handle(row.id, { handled: false }, ids.ece)).toMatchObject({ handledAt: null });
    });

    it('needs a real true or false', async () => {
      const row = await message();
      expect((await refused(service.handle(row.id, {}, ids.ece))).body).toMatchObject({ fieldErrors: { handled: 'REQUIRED' } });
      expect((await refused(service.handle(row.id, { handled: 'yes' }, ids.ece))).body).toMatchObject({ fieldErrors: { handled: 'INVALID_FORMAT' } });
    });

    it('stays when the administrator account is removed, without the name', async () => {
      const temporary = await prisma.user.create({ data: { email: `gecici-${run}@example.test`, passwordHash: 'x', firstName: 'Geçici', lastName: 'Yönetici', role: 'ADMIN' } });
      const row = await message();
      await service.handle(row.id, { handled: true }, temporary.id);
      await prisma.user.delete({ where: { id: temporary.id } });
      const detail = await service.get(row.id);
      expect(detail.handledAt).not.toBeNull();
      expect(detail.handledBy).toBeNull();
    });
  });
});
