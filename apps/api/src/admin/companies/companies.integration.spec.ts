import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service.js';
import { PasswordResetService } from '../../auth/password-reset.service.js';
import type { ResetLinkNotifier } from '../../auth/reset-link-notifier.js';
import { toUserResponse } from '../../auth/user-view.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CompaniesService } from './companies.service.js';

// The company administration and the invitation against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests;
// skipped without one. The test database is shared with suites that run at the same time, so every list is narrowed to this run's
// own companies by a word in their name.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 86_400_000;

async function refused(promise: Promise<unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return { status: error.getStatus(), body: error.getResponse() as Record<string, unknown> };
    throw error;
  }
  throw new Error('expected the call to be refused');
}

type Sent = { email: string; link: string; locale: 'TR' | 'EN'; invite?: { company: string; name: string } };

describeDb('company administration and invitation against the database (V2-33)', () => {
  let prisma: PrismaService;
  let service: CompaniesService;
  let reset: PasswordResetService;
  let auth: AuthService;
  const run = randomUUID().slice(0, 8);
  const sent: Sent[] = [];
  const companies: string[] = [];
  const users: string[] = [];

  // A notifier that remembers what it was asked to send, so the link can be followed.
  const notifier = {
    send: async (email: string, link: string, locale: 'TR' | 'EN' = 'TR', invite?: { company: string; name: string }) => {
      sent.push({ email, link, locale, invite });
    },
  } as unknown as ResetLinkNotifier;

  const tokenOf = (link: string): string => new URL(link).searchParams.get('token')!;
  const lastLinkTo = (email: string): Sent => sent.filter((entry) => entry.email === email).at(-1)!;
  const name = (word: string) => `V33 ${word} ${run}`;
  const company = async (word = 'Sirket', extra: Record<string, unknown> = {}) => {
    const row = await service.create({ name: name(word), ...extra });
    companies.push(row.id);
    return row;
  };
  const mailOf = (word: string) => `${word}-${run}@example.test`;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new CompaniesService(prisma, notifier);
    reset = new PasswordResetService(prisma, notifier);
    auth = new AuthService(prisma);
  });

  afterAll(async () => {
    const mine = await prisma.user.findMany({ where: { email: { contains: run } }, select: { id: true } });
    await prisma.user.deleteMany({ where: { id: { in: [...users, ...mine.map((user) => user.id)] } } });
    const named = await prisma.company.findMany({ where: { name: { contains: run } }, select: { id: true } });
    await prisma.company.deleteMany({ where: { id: { in: [...companies, ...named.map((row) => row.id)] } } });
    await prisma.$disconnect();
  });

  describe('making a company', () => {
    it('writes what was sent, with no people yet', async () => {
      const made = await company('Tam', {
        taxOffice: 'Bornova',
        city: 'İzmir',
        phone: '+90 232 555 01 00',
        salesContact: { name: 'Selin', email: 'Satis@Novera.example', phone: '+90 212 555 01 99' },
      });
      expect(made).toMatchObject({
        name: name('Tam'),
        taxOffice: 'Bornova',
        city: 'İzmir',
        phone: '+90 232 555 01 00',
        salesContact: { name: 'Selin', email: 'satis@novera.example', phone: '+90 212 555 01 99' },
        users: [],
      });
    });

    it('only the name is needed; the rest may be left out or sent empty', async () => {
      const made = await company('Bos', { taxOffice: '  ', city: '', phone: null, salesContact: { name: '', email: '', phone: '' } });
      expect(made).toMatchObject({ taxOffice: null, city: null, phone: null, salesContact: null });
    });

    it('a name that is taken, in any case and with spaces around it, is 409 NAME_TAKEN and nothing is added', async () => {
      const first = await company('Ayni');
      for (const typed of [first.name, first.name.toUpperCase(), `  ${first.name.toLowerCase()}  `]) {
        const answer = await refused(service.create({ name: typed }));
        expect(answer).toMatchObject({ status: 409, body: { code: 'NAME_TAKEN', fieldErrors: { name: 'NAME_TAKEN' } } });
      }
      expect((await service.list({ q: first.name, pageSize: '100' })).total).toBe(1);
    });

    it('refuses what is wrong with a code for each field', async () => {
      const answer = await refused(service.create({ name: 'A', phone: 'abc', salesContact: { name: 'Selin' } }));
      expect(answer.status).toBe(422);
      expect(answer.body).toMatchObject({ fieldErrors: { name: 'TOO_SHORT', phone: 'INVALID_FORMAT', salesContact: 'REQUIRED' } });
      expect((await refused(service.create({}))).body).toMatchObject({ fieldErrors: { name: 'REQUIRED' } });
      expect((await refused(service.create({ name: name('Posta'), salesContact: { name: 'S', email: 'degil', phone: '+90 212 555 01 99' } }))).body).toMatchObject({
        fieldErrors: { salesContact: 'INVALID_EMAIL' },
      });
    });
  });

  describe('listing', () => {
    it('lists this run’s companies with how many people they have and how many are still waiting', async () => {
      const made = await company('Liste');
      await service.invite(made.id, { email: mailOf('liste-a'), firstName: 'Ali', lastName: 'Veli' });
      const second = await service.invite(made.id, { email: mailOf('liste-b'), firstName: 'Ece', lastName: 'Su' });
      await prisma.user.update({ where: { id: second.id }, data: { passwordHash: 'x' } });
      const page = await service.list({ q: name('Liste') });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({ id: made.id, name: name('Liste'), users: 2, pendingUsers: 1 });
    });

    it('searches the name, the tax office and the city, whatever the case', async () => {
      const made = await company('Ara', { taxOffice: 'Kadıköy', city: 'Eskişehir' });
      for (const q of [`v33 ara ${run}`.toUpperCase(), 'kadıköy', 'eskişehir']) {
        expect((await service.list({ q, pageSize: '100' })).items.map((item) => item.id)).toContain(made.id);
      }
      expect((await service.list({ q: `nobody-${run}` })).total).toBe(0);
    });

    it('sorts by name and by how many people, and pages with a total that does not change', async () => {
      for (const word of ['Sira-A', 'Sira-B', 'Sira-C']) await company(word);
      const asc = await service.list({ q: `Sira-`, sort: 'name:asc', pageSize: '100' });
      expect(asc.items.map((item) => item.name)).toEqual([name('Sira-A'), name('Sira-B'), name('Sira-C')]);
      const desc = await service.list({ q: `Sira-`, sort: 'name:desc', pageSize: '100' });
      expect(desc.items.map((item) => item.name)).toEqual([name('Sira-C'), name('Sira-B'), name('Sira-A')]);
      const first = await service.list({ q: 'Sira-', pageSize: '2', page: '1' });
      const second = await service.list({ q: 'Sira-', pageSize: '2', page: '2' });
      expect([first.total, second.total]).toEqual([3, 3]);
      expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(3);
      expect((await refused(service.list({ sort: 'taxOffice:asc' }))).body).toMatchObject({ fieldErrors: { sort: 'INVALID_FORMAT' } });
    });

    it('is 404 for an id that is not there or cannot be one', async () => {
      expect((await refused(service.get(randomUUID()))).status).toBe(404);
      expect((await refused(service.get('not-an-id'))).status).toBe(404);
      expect((await refused(service.update('not-an-id', { updatedAt: new Date().toISOString() }))).status).toBe(404);
      expect((await refused(service.invite(randomUUID(), { email: mailOf('x'), firstName: 'A', lastName: 'B' }))).status).toBe(404);
    });
  });

  describe('changing a company', () => {
    it('changes only what is sent, clears what is sent empty, and moves the version on', async () => {
      const made = await company('Degis', { taxOffice: 'Bornova', city: 'İzmir', salesContact: { name: 'Selin', email: 's@n.example', phone: '+90 212 555 01 99' } });
      const changed = await service.update(made.id, { updatedAt: made.updatedAt, city: 'Ankara', taxOffice: '', salesContact: null });
      expect(changed).toMatchObject({ name: name('Degis'), city: 'Ankara', taxOffice: null, salesContact: null });
      expect(changed.updatedAt).not.toBe(made.updatedAt);
      const raw = await prisma.company.findUniqueOrThrow({ where: { id: made.id } });
      // A sales contact that was taken away is an empty column, not a JSON null.
      expect(raw.salesContact).toBeNull();
    });

    it('an edit made against an old version is 409 STALE_WRITE and writes nothing', async () => {
      const made = await company('Surum');
      await service.update(made.id, { updatedAt: made.updatedAt, phone: '+90 212 555 01 01' });
      const answer = await refused(service.update(made.id, { updatedAt: made.updatedAt, city: 'Bursa' }));
      expect(answer).toMatchObject({ status: 409, body: { code: 'STALE_WRITE' } });
      expect((await service.get(made.id)).city).toBeNull();
    });

    it('cannot take the name of another company, but may change the case of its own', async () => {
      const first = await company('Ad-1');
      const second = await company('Ad-2');
      expect((await refused(service.update(second.id, { updatedAt: second.updatedAt, name: first.name.toUpperCase() }))).body).toMatchObject({ code: 'NAME_TAKEN' });
      const own = await service.update(second.id, { updatedAt: second.updatedAt, name: second.name.toUpperCase() });
      expect(own.name).toBe(second.name.toUpperCase());
    });
  });

  describe('inviting a person', () => {
    it('opens a corporate account with no password, tied to the company, and sends one invitation', async () => {
      const made = await company('Davet');
      const before = sent.length;
      const person = await service.invite(made.id, {
        email: ` ${mailOf('Davet-Kisi').toUpperCase()} `.replace('@EXAMPLE.TEST', '@example.test'),
        firstName: 'Mert',
        lastName: 'Kaya',
        title: 'Filo Müdürü',
      });
      expect(person).toMatchObject({ firstName: 'Mert', lastName: 'Kaya', title: 'Filo Müdürü', status: 'PENDING' });
      expect(person.email).toBe(mailOf('davet-kisi'));

      const stored = await prisma.user.findUniqueOrThrow({ where: { id: person.id } });
      expect(stored).toMatchObject({ accountType: 'CORPORATE', role: 'CUSTOMER', passwordHash: null, googleSub: null, companyId: made.id, locale: 'TR' });
      const tokens = await prisma.passwordResetToken.findMany({ where: { userId: person.id } });
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: 'INVITE', usedAt: null });
      // Seven days, give or take the time the test took.
      expect(Math.abs(tokens[0]!.expiresAt.getTime() - (Date.now() + 7 * DAY))).toBeLessThan(60_000);

      expect(sent.length).toBe(before + 1);
      const mail = lastLinkTo(person.email);
      expect(mail).toMatchObject({ locale: 'TR', invite: { company: name('Davet'), name: 'Mert' } });
      expect(mail.link).toContain('/tr/sifre-sifirla/yeni?token=');
      expect(mail.link).toContain('&tur=davet');
      // Only the hash of the link is stored.
      expect(tokens[0]!.tokenHash).not.toContain(tokenOf(mail.link));
    });

    it('is in English when asked to be', async () => {
      const made = await company('Ingilizce');
      const person = await service.invite(made.id, { email: mailOf('en'), firstName: 'John', lastName: 'Doe', locale: 'en' });
      expect(lastLinkTo(person.email).link).toContain('/en/sifre-sifirla/yeni');
      expect((await prisma.user.findUniqueOrThrow({ where: { id: person.id } })).locale).toBe('EN');
    });

    it('an e-mail that already has an account, in any case, is 409 EMAIL_TAKEN and nothing is added or sent', async () => {
      const made = await company('Var');
      const person = await service.invite(made.id, { email: mailOf('var'), firstName: 'A', lastName: 'B' });
      const before = { mails: sent.length, tokens: await prisma.passwordResetToken.count({ where: { userId: person.id } }) };
      for (const typed of [mailOf('var'), mailOf('var').toUpperCase().replace('@EXAMPLE.TEST', '@example.test')]) {
        const answer = await refused(service.invite(made.id, { email: typed, firstName: 'C', lastName: 'D' }));
        expect(answer).toMatchObject({ status: 409, body: { code: 'EMAIL_TAKEN', fieldErrors: { email: 'EMAIL_TAKEN' } } });
      }
      expect(sent.length).toBe(before.mails);
      expect(await prisma.passwordResetToken.count({ where: { userId: person.id } })).toBe(before.tokens);
      // An account of an ordinary customer is not taken over either.
      const customer = await prisma.user.create({ data: { email: mailOf('musteri'), passwordHash: 'x', firstName: 'M', lastName: 'M' } });
      users.push(customer.id);
      expect((await refused(service.invite(made.id, { email: mailOf('musteri'), firstName: 'A', lastName: 'B' }))).status).toBe(409);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).companyId).toBeNull();
    });

    it('two invitations of the same address at once let one through', async () => {
      const made = await company('Es-zamanli');
      const results = await Promise.allSettled([
        service.invite(made.id, { email: mailOf('es'), firstName: 'A', lastName: 'B' }),
        service.invite(made.id, { email: mailOf('es'), firstName: 'A', lastName: 'B' }),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await prisma.user.count({ where: { email: mailOf('es') } })).toBe(1);
    });

    it('is 422 for an address that is not one or a name that is missing', async () => {
      const made = await company('Hatali');
      const answer = await refused(service.invite(made.id, { email: 'degil', firstName: '', lastName: 'B', locale: 'fr' }));
      expect(answer.body).toMatchObject({ fieldErrors: { email: 'INVALID_EMAIL', firstName: 'REQUIRED', locale: 'INVALID_FORMAT' } });
    });

    it('shows the people of the company with where their invitation is', async () => {
      const made = await company('Liste-kisi');
      const waiting = await service.invite(made.id, { email: mailOf('bekleyen'), firstName: 'Bekleyen', lastName: 'Kisi' });
      const active = await service.invite(made.id, { email: mailOf('aktif'), firstName: 'Aktif', lastName: 'Kisi' });
      await prisma.user.update({ where: { id: active.id }, data: { passwordHash: 'x' } });
      const detail = await service.get(made.id);
      const byId = new Map(detail.users.map((person) => [person.id, person]));
      expect(byId.get(waiting.id)).toMatchObject({ status: 'PENDING', invite: { expired: false } });
      expect(byId.get(active.id)).toMatchObject({ status: 'ACTIVE', invite: null });

      // A link that has run out says so.
      await prisma.passwordResetToken.updateMany({ where: { userId: waiting.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await service.get(made.id)).users.find((person) => person.id === waiting.id)?.invite?.expired).toBe(true);
    });
  });

  describe('using the invitation', () => {
    const invited = async (word: string) => {
      const made = await company(`Giris-${word}`, { taxOffice: 'Bornova', city: 'İzmir', phone: '+90 232 555 01 00' });
      const person = await service.invite(made.id, { email: mailOf(word), firstName: 'Mert', lastName: 'Kaya', title: 'Filo Müdürü' });
      return { made, person, token: tokenOf(lastLinkTo(person.email).link) };
    };
    const PASSWORD = 'uzun-bir-parola-1';

    it('the person sets a password from the link and signs in with it; their account carries the company', async () => {
      const { made, person, token } = await invited('giris');
      await reset.resetPassword({ token, password: PASSWORD });

      const session = await auth.login({ email: person.email, password: PASSWORD });
      expect(toUserResponse(session.user)).toMatchObject({
        accountType: 'CORPORATE',
        companyName: made.name,
        taxOffice: 'Bornova',
        companyCity: 'İzmir',
        companyPhone: '+90 232 555 01 00',
        contactTitle: 'Filo Müdürü',
      });
      expect((await service.get(made.id)).users.find((entry) => entry.id === person.id)?.status).toBe('ACTIVE');
    });

    it('the link works once', async () => {
      const { token } = await invited('bir-kez');
      await reset.resetPassword({ token, password: PASSWORD });
      expect((await refused(reset.resetPassword({ token, password: 'baska-bir-parola-2' }))).body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
    });

    it('seven days on, the link is no longer good; a link a minute short of that still is', async () => {
      const late = await invited('gec');
      await prisma.passwordResetToken.updateMany({ where: { userId: late.person.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await refused(reset.resetPassword({ token: late.token, password: PASSWORD }))).body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });

      const inTime = await invited('zamaninda');
      await prisma.passwordResetToken.updateMany({ where: { userId: inTime.person.id }, data: { expiresAt: new Date(Date.now() + 60_000) } });
      await reset.resetPassword({ token: inTime.token, password: PASSWORD });
      expect((await auth.login({ email: inTime.person.email, password: PASSWORD })).user.email).toBe(inTime.person.email);
    });

    it('cannot sign in before the password is set', async () => {
      const { person } = await invited('sifresiz');
      expect((await refused(auth.login({ email: person.email, password: PASSWORD }))).body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });
  });

  describe('sending the invitation again', () => {
    it('makes a new link and the old one stops working, whether it had run out or not', async () => {
      const made = await company('Tekrar');
      const person = await service.invite(made.id, { email: mailOf('tekrar'), firstName: 'A', lastName: 'B' });
      const oldToken = tokenOf(lastLinkTo(person.email).link);
      const before = sent.length;

      const again = await service.resend(made.id, person.id);
      expect(again).toMatchObject({ status: 'PENDING', invite: { expired: false } });
      expect(sent.length).toBe(before + 1);
      const newToken = tokenOf(lastLinkTo(person.email).link);
      expect(newToken).not.toBe(oldToken);
      expect(await prisma.passwordResetToken.count({ where: { userId: person.id } })).toBe(1);

      expect((await refused(new PasswordResetService(prisma, notifier).resetPassword({ token: oldToken, password: 'uzun-bir-parola-1' }))).body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
      await new PasswordResetService(prisma, notifier).resetPassword({ token: newToken, password: 'uzun-bir-parola-1' });
      expect((await auth.login({ email: person.email, password: 'uzun-bir-parola-1' })).user.id).toBe(person.id);
    });

    it('renews a link that had run out', async () => {
      const made = await company('Suresi-doldu');
      const person = await service.invite(made.id, { email: mailOf('dolmus'), firstName: 'A', lastName: 'B' });
      await prisma.passwordResetToken.updateMany({ where: { userId: person.id }, data: { expiresAt: new Date(Date.now() - DAY) } });
      expect((await service.get(made.id)).users[0]?.invite?.expired).toBe(true);
      expect((await service.resend(made.id, person.id)).invite?.expired).toBe(false);
    });

    it('pressed twice at the same moment, leaves one live link', async () => {
      const made = await company('Cift-basis');
      const person = await service.invite(made.id, { email: mailOf('cift'), firstName: 'A', lastName: 'B' });
      await Promise.all([service.resend(made.id, person.id), service.resend(made.id, person.id)]);
      expect(await prisma.passwordResetToken.count({ where: { userId: person.id, kind: 'INVITE', usedAt: null } })).toBe(1);
    });

    it('is 409 INVALID_TRANSITION for a person who already has a password, and 404 for one of another company', async () => {
      const made = await company('Aktif-kisi');
      const other = await company('Baska-sirket');
      const person = await service.invite(made.id, { email: mailOf('aktif-kisi'), firstName: 'A', lastName: 'B' });
      expect((await refused(service.resend(other.id, person.id))).status).toBe(404);
      expect((await refused(service.resend(made.id, randomUUID()))).status).toBe(404);
      expect((await refused(service.resend(made.id, 'not-an-id'))).status).toBe(404);
      await prisma.user.update({ where: { id: person.id }, data: { passwordHash: 'x' } });
      expect((await refused(service.resend(made.id, person.id))).body).toMatchObject({ code: 'INVALID_TRANSITION' });
    });
  });
});
