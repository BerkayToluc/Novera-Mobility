import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { AuthService } from '../../auth/auth.service.js';
import { GoogleAuthService } from '../../auth/google-auth.service.js';
import { GoogleTokenVerifier, type GoogleProfile } from '../../auth/google-verifier.js';
import { hashPassword } from '../../auth/password.js';
import { PasswordResetService } from '../../auth/password-reset.service.js';
import type { ResetLinkNotifier } from '../../auth/reset-link-notifier.js';
import { hashSessionToken, newSessionToken } from '../../auth/session-token.js';
import { testPlate } from '../../common/plate.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

// Accounts and closing them (V2-34) against a real PostgreSQL (TEST_DATABASE_URL), like the other integration tests; skipped
// without one. The test database is shared with suites that run at the same time, so every list is narrowed to this run's own
// accounts by a word in their e-mail address.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL must point at a database with "test" in its name.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const PASSWORD = 'uzun-bir-parola-1';
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

class FakeVerifier extends GoogleTokenVerifier {
  profile: GoogleProfile = { sub: 'g', email: 'g@example.test', givenName: 'G', familyName: 'G', name: 'G G' };
  isConfigured() {
    return true;
  }
  async verify(): Promise<GoogleProfile> {
    return this.profile;
  }
}

describeDb('user administration against the database (V2-34)', () => {
  let prisma: PrismaService;
  let service: UsersService;
  let auth: AuthService;
  let google: GoogleAuthService;
  let reset: PasswordResetService;
  const verifier = new FakeVerifier();
  const run = randomUUID().slice(0, 8);
  const sent: string[] = [];
  const ids = { classId: '', modelId: '', branchId: '', vehicleId: '' };
  const companies: string[] = [];

  const notifier = {
    send: async (email: string) => {
      sent.push(email);
    },
  } as unknown as ResetLinkNotifier;

  const mailOf = (word: string) => `${word}-${run}@example.test`;
  const person = async (word: string, data: Record<string, unknown> = {}) =>
    prisma.user.create({
      data: { email: mailOf(word), passwordHash: await hashPassword(PASSWORD), firstName: 'Kişi', lastName: word, ...data },
    });
  const reservation = (user: string, label: string, startAt: Date, status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED') =>
    prisma.reservation.create({
      data: {
        number: `V34-${run}-${label}`,
        status,
        startAt,
        endAt: new Date(startAt.getTime() + DAY),
        days: 1,
        vehicleDailyPrice: 100000,
        totalPrice: 100000,
        userId: user,
        vehicleId: ids.vehicleId,
        pickupBranchId: ids.branchId,
        returnBranchId: ids.branchId,
      },
    });
  const loginAs = (word: string, password = PASSWORD) => auth.login({ email: mailOf(word), password });

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new UsersService(prisma);
    auth = new AuthService(prisma);
    google = new GoogleAuthService(prisma, verifier);
    reset = new PasswordResetService(prisma, notifier);

    ids.classId = (await prisma.vehicleClass.create({ data: { slug: `v34-sinif-${run}`, nameTr: 'T', nameEn: 'T' } })).id;
    ids.modelId = (
      await prisma.vehicleModel.create({
        data: {
          slug: `v34-model-${run}`,
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
          name: `Kullanici Bayi ${run}`,
          city: 'Test',
          address: 'Test',
          latitude: 1,
          longitude: 1,
          phone: '+90 000 000 00 00',
          email: `kullanici-${run}@example.test`,
          openingHours: { weekdays: { open: '08:00', close: '20:00' } },
        },
      })
    ).id;
    ids.vehicleId = (await prisma.vehicle.create({ data: { plate: testPlate(), year: 2030, vehicleModelId: ids.modelId, branchId: ids.branchId } })).id;
  });

  afterAll(async () => {
    const mine = await prisma.user.findMany({ where: { email: { contains: run } }, select: { id: true } });
    const mineIds = mine.map((user) => user.id);
    await prisma.reservation.deleteMany({ where: { vehicleId: ids.vehicleId } });
    await prisma.user.deleteMany({ where: { id: { in: mineIds } } });
    await prisma.company.deleteMany({ where: { id: { in: companies } } });
    await prisma.vehicle.deleteMany({ where: { id: ids.vehicleId } });
    await prisma.branch.deleteMany({ where: { id: ids.branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  describe('listing', () => {
    it('lists this run’s accounts with their kind and state, and narrows by word, kind and state', async () => {
      const company = await prisma.company.create({ data: { name: `V34 Firma ${run}` } });
      companies.push(company.id);
      await person('ada', { firstName: 'Ada', lastName: 'Lovelace' });
      await person('firma', { accountType: 'CORPORATE', companyId: company.id });
      await person('yonetici', { role: 'ADMIN' });
      await person('kapali', { disabledAt: new Date() });

      const all = await service.list({ q: run, pageSize: '100' });
      expect(all.total).toBe(4);
      const byEmail = (word: string) => all.items.find((item) => item.email === mailOf(word))!;
      expect(byEmail('ada')).toMatchObject({ type: 'INDIVIDUAL', status: 'ACTIVE', companyName: null, disabledAt: null });
      expect(byEmail('firma')).toMatchObject({ type: 'CORPORATE', companyName: `V34 Firma ${run}` });
      expect(byEmail('yonetici').type).toBe('ADMIN');
      expect(byEmail('kapali')).toMatchObject({ status: 'DISABLED' });
      expect(byEmail('kapali').disabledAt).toEqual(expect.any(String));

      expect((await service.list({ q: `${run} ADA`, pageSize: '100' })).items.map((item) => item.email)).toEqual([mailOf('ada')]);
      expect((await service.list({ q: `lovelace ${run}` })).total).toBe(1);
      expect((await service.list({ q: run, type: 'ADMIN' })).items.map((item) => item.email)).toEqual([mailOf('yonetici')]);
      expect((await service.list({ q: run, type: 'CORPORATE' })).total).toBe(1);
      // An administrator is not counted among the individual accounts, though that is its account type.
      expect((await service.list({ q: run, type: 'INDIVIDUAL' })).total).toBe(2);
      expect((await service.list({ q: run, status: 'DISABLED' })).total).toBe(1);
      expect((await service.list({ q: run, status: 'ACTIVE' })).total).toBe(3);
      expect((await service.list({ q: 'yok-boyle-biri-' + run })).total).toBe(0);
    });

    it('sorts, and pages with a total that does not change', async () => {
      const sortedByEmail = await service.list({ q: run, sort: 'email:asc', pageSize: '100' });
      const emails = sortedByEmail.items.map((item) => item.email);
      expect(emails).toEqual([...emails].sort());

      const first = await service.list({ q: run, sort: 'email:asc', pageSize: '3', page: '1' });
      const second = await service.list({ q: run, sort: 'email:asc', pageSize: '3', page: '2' });
      expect(first.total).toBe(second.total);
      expect([...first.items, ...second.items].map((item) => item.email)).toEqual(emails);
    });

    it('is 422 for a sort, a kind, a state or a page that makes no sense', async () => {
      for (const query of [{ sort: 'passwordHash:asc' }, { type: 'ROOT' }, { status: 'GONE' }, { pageSize: '101' }, { q: 'x'.repeat(101) }]) {
        const answer = await refused(service.list(query));
        expect(answer.status).toBe(422);
      }
    });
  });

  describe('one account', () => {
    it('says how it signs in, its company, its points, and how many bookings it has and how many are still to come', async () => {
      const company = await prisma.company.create({ data: { name: `V34 Detay ${run}` } });
      companies.push(company.id);
      const user = await person('detay', { accountType: 'CORPORATE', companyId: company.id, contactTitle: 'Müdür', googleSub: `g-${run}` });
      await reservation(user.id, 'a', new Date(Date.now() + 3 * DAY));
      await reservation(user.id, 'b', new Date(Date.now() + 9 * DAY));
      await reservation(user.id, 'c', new Date(Date.now() - 5 * DAY));
      await reservation(user.id, 'd', new Date(Date.now() + 4 * DAY), 'CANCELLED');
      await prisma.pointTransaction.create({ data: { userId: user.id, points: 40 } });
      await prisma.pointTransaction.create({ data: { userId: user.id, points: -15 } });

      const detail = await service.get(user.id);
      expect(detail).toMatchObject({
        email: mailOf('detay'),
        type: 'CORPORATE',
        title: 'Müdür',
        hasPassword: true,
        googleLinked: true,
        company: { id: company.id, name: `V34 Detay ${run}` },
        // Four bookings, two of them confirmed and still to come (the started one and the cancelled one are not).
        reservations: { total: 4, upcoming: 2 },
        points: 25,
      });
    });

    it('is 404 for an id that is not there or cannot be one, on every route', async () => {
      for (const id of [randomUUID(), 'not-an-id']) {
        for (const call of [() => service.get(id), () => service.disable(id), () => service.enable(id)]) {
          expect((await refused(call())).status).toBe(404);
        }
      }
    });
  });

  describe('closing an account', () => {
    it('ends every session at once, and the account can neither sign in nor be told apart from a wrong password', async () => {
      await person('kapat', { firstName: 'Kapat' });
      const { token } = await loginAs('kapat');
      expect(await auth.authenticate(token)).not.toBeNull();
      const user = await prisma.user.findUniqueOrThrow({ where: { email: mailOf('kapat') } });

      const closed = await service.disable(user.id);
      expect(closed.status).toBe('DISABLED');
      expect(closed.disabledAt).toEqual(expect.any(String));
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
      expect(await auth.authenticate(token)).toBeNull();

      // With the right password the answer is the one for a wrong password: nothing says the account is closed.
      const rightPassword = await refused(loginAs('kapat'));
      const wrongPassword = await refused(loginAs('kapat', 'yanlis-parola-123'));
      expect(rightPassword.status).toBe(401);
      expect(rightPassword.body).toEqual(wrongPassword.body);
      expect(rightPassword.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('a session that appears after it was closed is no session', async () => {
      const user = await person('geç');
      await service.disable(user.id);
      const token = newSessionToken();
      await prisma.session.create({ data: { tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + DAY), userId: user.id } });
      expect(await auth.authenticate(token)).toBeNull();
      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    });

    it('keeps the first date when it is closed again, and the bookings to come stay confirmed', async () => {
      const user = await person('tekrar');
      const booking = await reservation(user.id, 'keep', new Date(Date.now() + 5 * DAY));
      const first = await service.disable(user.id);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const again = await service.disable(user.id);
      expect(again.disabledAt).toBe(first.disabledAt);
      expect(first.reservations.upcoming).toBe(1);
      expect((await prisma.reservation.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('CONFIRMED');
    });

    it('does not close an administrator, whoever asks (oneself included): 403 and nothing changes', async () => {
      const admin = await person('admin-kapat', { role: 'ADMIN' });
      const { token } = await loginAs('admin-kapat');
      const answer = await refused(service.disable(admin.id));
      expect(answer).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
      expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).disabledAt).toBeNull();
      expect(await auth.authenticate(token)).not.toBeNull();
    });

    it('a closed account gets no reset link, and a link it had is of no use', async () => {
      const user = await person('sifre');
      await service.disable(user.id);
      await reset.requestReset({ email: mailOf('sifre') });
      expect(sent).not.toContain(mailOf('sifre'));
      expect(await prisma.passwordResetToken.count({ where: { userId: user.id } })).toBe(0);

      // A link made some other way (an invitation sent again) cannot open the account either.
      const token = newSessionToken();
      await prisma.passwordResetToken.create({ data: { tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + DAY), userId: user.id } });
      const answer = await refused(reset.resetPassword({ token, password: 'yeni-uzun-parola-2' }));
      expect(answer.body).toMatchObject({ code: 'RESET_TOKEN_INVALID' });
      await expect(loginAs('sifre', 'yeni-uzun-parola-2')).rejects.toBeInstanceOf(HttpException);
    });

    it('a closed account cannot sign in with Google either, whether linked already or about to be', async () => {
      // Linked already.
      const linked = await person('google-bagli', { passwordHash: null, googleSub: `gs-${run}` });
      await service.disable(linked.id);
      verifier.profile = { sub: `gs-${run}`, email: mailOf('google-bagli'), givenName: 'G', familyName: 'B', name: 'G B' };
      expect(await refused(google.signIn({ credential: 'x' }))).toMatchObject({ status: 401, body: { code: 'INVALID_CREDENTIALS' } });
      expect(await prisma.session.count({ where: { userId: linked.id } })).toBe(0);

      // Not linked: the same verified address would link it and open it.
      const unlinked = await person('google-yeni');
      await service.disable(unlinked.id);
      verifier.profile = { sub: `gn-${run}`, email: mailOf('google-yeni'), givenName: 'G', familyName: 'Y', name: 'G Y' };
      expect(await refused(google.signIn({ credential: 'x' }))).toMatchObject({ status: 401, body: { code: 'INVALID_CREDENTIALS' } });
      const after = await prisma.user.findUniqueOrThrow({ where: { id: unlinked.id } });
      expect(after.googleSub).toBeNull();
      expect(after.passwordHash).not.toBeNull();
    });
  });

  describe('opening it again', () => {
    it('signs in as before, with a new session, and nothing else changed', async () => {
      const user = await person('ac');
      await service.disable(user.id);
      await expect(loginAs('ac')).rejects.toBeInstanceOf(HttpException);

      const opened = await service.enable(user.id);
      expect(opened).toMatchObject({ status: 'ACTIVE', disabledAt: null });
      const session = await loginAs('ac');
      expect(await auth.authenticate(session.token)).not.toBeNull();

      // Opening one that is open is no error and changes nothing.
      expect((await service.enable(user.id)).status).toBe('ACTIVE');
    });

    it('a closed account that signed in with Google signs in with Google again', async () => {
      const user = await person('google-ac', { passwordHash: null, googleSub: `ga-${run}` });
      await service.disable(user.id);
      await service.enable(user.id);
      verifier.profile = { sub: `ga-${run}`, email: mailOf('google-ac'), givenName: 'G', familyName: 'A', name: 'G A' };
      const result = await google.signIn({ credential: 'x' });
      expect(result.session.user.id).toBe(user.id);
    });
  });
});
