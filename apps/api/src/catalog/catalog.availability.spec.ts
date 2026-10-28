import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvailabilityService } from './availability.service.js';
import { daysAhead, slotAtLeast, slotBefore } from '../reservations/dates.testing.js';

// Entegrasyon testi: GET /vehicles müsaitlik sorgusunu GERÇEK PostgreSQL'e karşı sınar (BACKLOG #21).
// Sorgunun doğruluğu veritabanının içinde olduğu için sahte (mock) veriyle sınanamaz.
//
// Güvenlik: yalnızca adında "test" geçen bir veritabanında çalışır, geliştirme verinize dokunmaz.
// TEST_DATABASE_URL tanımlı değilse testler atlanır (CI'da tanımlıdır).
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DAILY = 125000; // TRY, kuruş (₺1.250)
const START = daysAhead(30);
const END = new Date(START.getTime() + 3 * DAY); // 3 gün

type Money = { amount: number; currency: string };
type Offer = {
  vehicleId: string;
  year: number;
  days: number;
  dailyPrice: Money;
  totalPrice: Money;
};

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}

describeDb('GET /vehicles müsaitlik sorgusu (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: AvailabilityService;
  const run = randomUUID().slice(0, 8);
  let counter = 0;
  let modelId = '';
  const created = {
    branches: [] as string[],
    vehicles: [] as string[],
    models: [] as string[],
    classes: [] as string[],
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new AvailabilityService(prisma);

    const vehicleClass = await prisma.vehicleClass.create({
      data: { slug: `test-sinif-${run}`, nameTr: 'Test', nameEn: 'Test' },
    });
    created.classes.push(vehicleClass.id);

    const model = await prisma.vehicleModel.create({
      data: {
        slug: `test-model-${run}`,
        brand: 'Test',
        model: 'Model',
        seats: 5,
        bags: 3,
        transmission: 'AUTOMATIC',
        fuelType: 'PETROL',
        consumption: 5.5,
        consumptionUnit: 'L_PER_100KM',
        dailyPrice: DAILY,
        description: { tr: 'Test aracı', en: 'Test car' },
        classId: vehicleClass.id,
      },
    });
    created.models.push(model.id);
    modelId = model.id;

    await prisma.exchangeRate.upsert({
      where: { currency: 'EUR' },
      update: { ratePerTry: '0.0200' },
      create: { currency: 'EUR', ratePerTry: '0.0200' },
    });
  });

  afterAll(async () => {
    await prisma.hold.deleteMany({ where: { vehicleId: { in: created.vehicles } } });
    await prisma.reservation.deleteMany({ where: { vehicleId: { in: created.vehicles } } });
    await prisma.vehicle.deleteMany({ where: { id: { in: created.vehicles } } });
    await prisma.vehicleModel.deleteMany({ where: { id: { in: created.models } } });
    await prisma.vehicleClass.deleteMany({ where: { id: { in: created.classes } } });
    await prisma.branch.deleteMany({ where: { id: { in: created.branches } } });
    await prisma.$disconnect();
  });

  // Her senaryo kendi bayisini ve aracını alır, testler birbirini etkilemez.
  async function scenario(): Promise<{ branchId: string; vehicleId: string }> {
    counter += 1;
    const branch = await prisma.branch.create({
      data: {
        name: `Test bayi ${run}-${counter}`,
        city: 'Testville',
        address: 'Test adresi',
        latitude: 0,
        longitude: 0,
        phone: '+90 000 000 00 00',
        email: 'test@novera.example',
        openingHours: { weekdays: '08:30-19:00', saturday: '09:00-17:00', sunday: 'closed' },
      },
    });
    created.branches.push(branch.id);
    const vehicleId = await addVehicle(branch.id);
    return { branchId: branch.id, vehicleId };
  }

  async function addVehicle(branchId: string): Promise<string> {
    counter += 1;
    const vehicle = await prisma.vehicle.create({
      data: { plate: `T-${run}-${counter}`, year: 2026, vehicleModelId: modelId, branchId },
    });
    created.vehicles.push(vehicle.id);
    return vehicle.id;
  }

  async function book(
    vehicleId: string,
    branchId: string,
    startAt: Date,
    endAt: Date,
    status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED',
  ): Promise<void> {
    counter += 1;
    await prisma.reservation.create({
      data: {
        number: `TST-${run}-${counter}`,
        status,
        startAt,
        endAt,
        days: 1,
        vehicleDailyPrice: DAILY,
        totalPrice: DAILY,
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
      },
    });
  }

  async function hold(vehicleId: string, branchId: string, startAt: Date, endAt: Date, expiresAt: Date): Promise<void> {
    await prisma.hold.create({
      data: {
        vehicleId,
        pickupBranchId: branchId,
        returnBranchId: branchId,
        startAt,
        endAt,
        expiresAt,
      },
    });
  }

  async function search(
    branchId: string,
    startAt: Date = START,
    endAt: Date = END,
    currency?: string,
  ): Promise<Offer[]> {
    const result = await service.getAvailableVehicles({
      pickupBranchId: branchId,
      returnBranchId: branchId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      currency,
    });
    return result as Offer[];
  }

  describe('rezervasyonla çakışma', () => {
    it('hiç rezervasyonu olmayan araç listelenir; gün ve fiyat doğru', async () => {
      const { branchId, vehicleId } = await scenario();
      const offers = await search(branchId);
      expect(offers).toHaveLength(1);
      expect(offers[0].vehicleId).toBe(vehicleId);
      expect(offers[0].days).toBe(3);
      expect(offers[0].dailyPrice).toEqual({ amount: DAILY, currency: 'TRY' });
      expect(offers[0].totalPrice).toEqual({ amount: DAILY * 3, currency: 'TRY' });
    });

    it('teklif aracın model yılını taşır', async () => {
      const { branchId } = await scenario();
      const offers = await search(branchId);
      expect(offers[0].year).toBe(2026);
    });

    const overlaps: Array<[string, Date, Date]> = [
      ['aralığın içinde', new Date(START.getTime() + DAY), new Date(START.getTime() + 2 * DAY)],
      [
        'başlangıçtan önce başlar, aralığın içinde biter',
        new Date(START.getTime() - DAY),
        new Date(START.getTime() + DAY),
      ],
      [
        'aralığın içinde başlar, bitişten sonra biter',
        new Date(START.getTime() + 2 * DAY),
        new Date(END.getTime() + DAY),
      ],
      ['tüm aralığı kapsar', new Date(START.getTime() - DAY), new Date(END.getTime() + DAY)],
      ['aralıkla birebir aynı', START, END],
    ];
    it.each(overlaps)('onaylı rezervasyon çakışıyorsa araç listelenmez: %s', async (_label, startAt, endAt) => {
      const { branchId, vehicleId } = await scenario();
      await book(vehicleId, branchId, startAt, endAt);
      expect(await search(branchId)).toHaveLength(0);
    });

    it('rezervasyon tam aramanın başladığı anda biterse çakışma sayılmaz', async () => {
      const { branchId, vehicleId } = await scenario();
      await book(vehicleId, branchId, new Date(START.getTime() - 2 * DAY), START);
      expect(await search(branchId)).toHaveLength(1);
    });

    it('rezervasyon tam aramanın bittiği anda başlarsa çakışma sayılmaz', async () => {
      const { branchId, vehicleId } = await scenario();
      await book(vehicleId, branchId, END, new Date(END.getTime() + DAY));
      expect(await search(branchId)).toHaveLength(1);
    });

    it('iptal edilmiş rezervasyon aracı kilitlemez', async () => {
      const { branchId, vehicleId } = await scenario();
      await book(vehicleId, branchId, START, END, 'CANCELLED');
      expect(await search(branchId)).toHaveLength(1);
    });

    it('aralıktan çok sonraki rezervasyon aracı etkilemez', async () => {
      const { branchId, vehicleId } = await scenario();
      await book(vehicleId, branchId, new Date(END.getTime() + 30 * DAY), new Date(END.getTime() + 33 * DAY));
      expect(await search(branchId)).toHaveLength(1);
    });
  });

  describe('geçici tutma (hold)', () => {
    it('süresi dolmamış tutma aracı listeden çıkarır', async () => {
      const { branchId, vehicleId } = await scenario();
      await hold(vehicleId, branchId, START, END, new Date(Date.now() + 10 * 60 * 1000));
      expect(await search(branchId)).toHaveLength(0);
    });

    it('süresi dolmuş tutma aracı serbest bırakır', async () => {
      const { branchId, vehicleId } = await scenario();
      await hold(vehicleId, branchId, START, END, new Date(Date.now() - 1000));
      expect(await search(branchId)).toHaveLength(1);
    });

    it('başka tarihler için yapılmış tutma aracı etkilemez', async () => {
      const { branchId, vehicleId } = await scenario();
      await hold(
        vehicleId,
        branchId,
        new Date(END.getTime() + 10 * DAY),
        new Date(END.getTime() + 12 * DAY),
        new Date(Date.now() + 10 * 60 * 1000),
      );
      expect(await search(branchId)).toHaveLength(1);
    });
  });

  describe('bayi ve araç seçimi', () => {
    it('yalnızca alış bayisindeki araçlar döner', async () => {
      const a = await scenario();
      await scenario();
      const offers = await search(a.branchId);
      expect(offers.map((o) => o.vehicleId)).toEqual([a.vehicleId]);
    });

    it('aynı modelden iki müsait araç varsa tek sonuç döner', async () => {
      const { branchId } = await scenario();
      await addVehicle(branchId);
      expect(await search(branchId)).toHaveLength(1);
    });

    it('ilk araç doluysa aynı modelin ikinci aracı önerilir', async () => {
      const { branchId, vehicleId } = await scenario();
      const second = await addVehicle(branchId);
      await book(vehicleId, branchId, START, END);
      const offers = await search(branchId);
      expect(offers).toHaveLength(1);
      expect(offers[0].vehicleId).toBe(second);
    });

    it('pasif araç listelenmez', async () => {
      const { branchId, vehicleId } = await scenario();
      await prisma.vehicle.update({ where: { id: vehicleId }, data: { active: false } });
      expect(await search(branchId)).toHaveLength(0);
    });
  });

  describe('gün sayısı ve para birimi', () => {
    it('24 saati aşan süre bir sonraki güne yuvarlanır (25 saat = 2 gün)', async () => {
      const { branchId } = await scenario();
      const offers = await search(branchId, START, new Date(START.getTime() + 25 * HOUR));
      expect(offers[0].days).toBe(2);
      expect(offers[0].totalPrice.amount).toBe(DAILY * 2);
    });

    it('tam 24 saat 1 gündür', async () => {
      const { branchId } = await scenario();
      const offers = await search(branchId, START, new Date(START.getTime() + DAY));
      expect(offers[0].days).toBe(1);
    });

    it('EUR: birim fiyat önce çevrilir, toplam = günlük × gün (yuvarlama kayması yok)', async () => {
      const { branchId } = await scenario();
      const offers = await search(branchId, START, END, 'EUR');
      expect(offers[0].dailyPrice).toEqual({ amount: 2500, currency: 'EUR' });
      expect(offers[0].totalPrice.amount).toBe(offers[0].dailyPrice.amount * offers[0].days);
      expect(offers[0].totalPrice.currency).toBe('EUR');
    });
  });

  describe('girdi doğrulaması', () => {
    it('geçmiş ya da en yakın dilimden önceki başlangıç reddedilir (IN_PAST), bir yıldan uzak olan OUT_OF_RANGE', async () => {
      const { branchId } = await scenario();
      const startErrorOf = async (start: Date) => {
        const error = await catchHttp(search(branchId, start, new Date(start.getTime() + DAY)));
        expect(error.getStatus()).toBe(422);
        return (error.getResponse() as { fieldErrors: Record<string, string> }).fieldErrors.startAt;
      };
      expect(await startErrorOf(daysAhead(-1))).toBe('IN_PAST');
      expect(await startErrorOf(slotBefore(30))).toBe('IN_PAST');
      expect(await startErrorOf(daysAhead(366))).toBe('OUT_OF_RANGE');
      const earliest = slotAtLeast(30);
      await expect(search(branchId, earliest, new Date(earliest.getTime() + DAY))).resolves.toBeDefined();
    });

    it('30 dakikalık dilime oturmayan an reddedilir (NOT_IN_SLOT)', async () => {
      const { branchId } = await scenario();
      const error = await catchHttp(
        service.getAvailableVehicles({
          pickupBranchId: branchId,
          returnBranchId: branchId,
          startAt: new Date(START.getTime() + 15 * 60 * 1000).toISOString(),
          endAt: END.toISOString(),
        }),
      );
      expect(error.getStatus()).toBe(422);
      const body = error.getResponse() as { code: string; fieldErrors: Record<string, string> };
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.fieldErrors.startAt).toBe('NOT_IN_SLOT');
    });

    it('bitiş başlangıçtan önce ya da eşitse reddedilir (INVALID_DATE_RANGE)', async () => {
      const { branchId } = await scenario();
      const error = await catchHttp(search(branchId, START, START));
      const body = error.getResponse() as { fieldErrors: Record<string, string> };
      expect(error.getStatus()).toBe(422);
      expect(body.fieldErrors.endAt).toBe('INVALID_DATE_RANGE');
    });

    it('var olmayan bayi reddedilir (UNKNOWN_REFERENCE)', async () => {
      const error = await catchHttp(search(randomUUID()));
      const body = error.getResponse() as { fieldErrors: Record<string, string> };
      expect(error.getStatus()).toBe(422);
      expect(body.fieldErrors.pickupBranchId).toBe('UNKNOWN_REFERENCE');
    });

    it('eksik parametreler REQUIRED döner', async () => {
      const error = await catchHttp(service.getAvailableVehicles({}));
      const body = error.getResponse() as { fieldErrors: Record<string, string> };
      expect(error.getStatus()).toBe(422);
      expect(body.fieldErrors.pickupBranchId).toBe('REQUIRED');
      expect(body.fieldErrors.returnBranchId).toBe('REQUIRED');
      expect(body.fieldErrors.startAt).toBe('REQUIRED');
      expect(body.fieldErrors.endAt).toBe('REQUIRED');
    });

    it('geçersiz para birimi reddedilir', async () => {
      const { branchId } = await scenario();
      const error = await catchHttp(search(branchId, START, END, 'GBP'));
      const body = error.getResponse() as { fieldErrors: Record<string, string> };
      expect(error.getStatus()).toBe(422);
      expect(body.fieldErrors.currency).toBe('INVALID_FORMAT');
    });
  });
});
