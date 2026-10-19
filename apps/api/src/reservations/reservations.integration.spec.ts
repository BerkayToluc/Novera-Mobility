import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PricingService } from './pricing.service.js';
import { ReservationsService } from './reservations.service.js';

// Entegrasyon testi: GERÇEK PostgreSQL'e karşı. Asıl amaç iki şeyi kanıtlamak:
//  1) aynı araca aynı anda gelen 8 istekten YALNIZ 1'i rezervasyon alır (FOR UPDATE kilidi),
//  2) rezervasyon, ek hizmet ve puan kaydı gerçekten yazılıp okunabiliyor.
// Yalnızca adında "test" geçen veritabanında çalışır; TEST_DATABASE_URL yoksa atlanır.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const DAY = 24 * 60 * 60 * 1000;
const START = new Date('2031-06-10T10:00:00.000Z');
const END = new Date(START.getTime() + 3 * DAY);

describeDb('POST /reservations (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ReservationsService;
  const run = randomUUID().slice(0, 8);
  let vehicleId = '';
  let branchId = '';
  let user: UserRow;
  const ids = { classId: '', modelId: '', userId: '' };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ReservationsService(prisma, new PricingService(prisma));

    const klass = await prisma.vehicleClass.create({ data: { slug: `t-sinif-${run}`, nameTr: 'T', nameEn: 'T' } });
    ids.classId = klass.id;
    const model = await prisma.vehicleModel.create({
      data: {
        slug: `t-model-${run}`, brand: 'Test', model: 'Model', seats: 5, bags: 3, transmission: 'AUTOMATIC',
        fuelType: 'PETROL', consumption: 5.5, consumptionUnit: 'L_PER_100KM', dailyPrice: 125000,
        description: { tr: 'Test', en: 'Test' }, classId: klass.id,
      },
    });
    ids.modelId = model.id;
    const branch = await prisma.branch.create({
      data: {
        name: `Test Bayi ${run}`, city: 'Test', address: 'Test', latitude: 1, longitude: 1,
        phone: '+90 000 000 00 00', email: `bayi-${run}@example.test`,
        openingHours: { weekdays: { open: '08:00', close: '20:00' } },
      },
    });
    branchId = branch.id;
    const vehicle = await prisma.vehicle.create({
      data: { plate: `T${run}`, year: 2030, vehicleModelId: model.id, branchId: branch.id },
    });
    vehicleId = vehicle.id;
    const created = await prisma.user.create({
      data: {
        email: `t-${run}@example.test`, passwordHash: 'x', firstName: 'Test', lastName: 'Kullanici',
        accountType: 'INDIVIDUAL',
      },
    });
    ids.userId = created.id;
    user = created as unknown as UserRow;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: ids.userId } }); // puanlar cascade silinir
    await prisma.reservation.deleteMany({ where: { vehicleId } });
    await prisma.vehicle.deleteMany({ where: { id: vehicleId } });
    await prisma.branch.deleteMany({ where: { id: branchId } });
    await prisma.vehicleModel.deleteMany({ where: { id: ids.modelId } });
    await prisma.vehicleClass.deleteMany({ where: { id: ids.classId } });
    await prisma.$disconnect();
  });

  const body = () => ({
    vehicleId, pickupBranchId: branchId, returnBranchId: branchId,
    startAt: START.toISOString(), endAt: END.toISOString(), currency: 'TRY',
  });

  it('8 eşzamanlı istekten yalnız biri rezervasyon alır', async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => service.create(user, body())));
    const ok = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(7);
    for (const f of failed) {
      expect(f.reason).toBeInstanceOf(HttpException);
      expect((f.reason as HttpException).getStatus()).toBe(409);
    }
    const count = await prisma.reservation.count({ where: { vehicleId } });
    expect(count).toBe(1);
  });

  it('kayıt okunur: fiyat, numara ve puan yazılmıştır', async () => {
    const list = await service.listMine(user.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.number).toMatch(/^NVR-\d{4}-\d{5}$/);
    expect(list[0]!.price.total).toEqual({ amount: 375000, currency: 'TRY' });
    expect(list[0]!.pointsEarned).toBe(37);
    expect(list[0]!.vehicle.year).toBe(2030);
    expect(list[0]!.price.lines[0]).toMatchObject({ type: 'VEHICLE', slug: `t-model-${run}` });
    expect(list[0]!.price).toMatchObject({ pointsUsed: 0, payable: { amount: 375000, currency: 'TRY' } });
    const points = await service.points(user.id, new Date('2031-06-14T00:00:00Z'));
    expect(points.balance).toBe(37);
  });

  it('tek rezervasyon numarasıyla değil kimliğiyle okunur; başkası göremez', async () => {
    const [mine] = await service.listMine(user.id);
    const one = await service.getMine(user.id, mine!.id);
    expect(one).toEqual(mine);

    await expect(service.getMine('00000000-0000-4000-8000-000000000000', mine!.id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(service.getMine(user.id, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({
      status: 404,
    });
  });
});
