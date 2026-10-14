import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import {
  HOLD_MINUTES,
  HoldsService,
  MAX_ACTIVE_HOLDS_PER_CLIENT,
  type CreateHoldInput,
} from './holds.service.js';

// Entegrasyon testi: POST /holds, gerçek PostgreSQL'e karşı (BACKLOG Y48).
// Yalnızca adında "test" geçen bir veritabanında çalışır; TEST_DATABASE_URL yoksa atlanır.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const START = new Date('2031-03-10T10:00:00.000Z');
const END = new Date(START.getTime() + 3 * DAY);
const DAILY = 125000;

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}

type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

describeDb('POST /holds araç tutma (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let holds: HoldsService;
  let catalog: CatalogService;
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
    holds = new HoldsService(prisma);
    catalog = new CatalogService(prisma);

    const vehicleClass = await prisma.vehicleClass.create({
      data: { slug: `hold-sinif-${run}`, nameTr: 'Test', nameEn: 'Test' },
    });
    created.classes.push(vehicleClass.id);
    const model = await prisma.vehicleModel.create({
      data: {
        slug: `hold-model-${run}`,
        brand: 'Test',
        model: 'Hold',
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

  async function scenario(): Promise<{ branchId: string; vehicleId: string }> {
    counter += 1;
    const branch = await prisma.branch.create({
      data: {
        name: `Hold bayi ${run}-${counter}`,
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
    const vehicle = await prisma.vehicle.create({
      data: { plate: `H-${run}-${counter}`, year: 2026, vehicleModelId: modelId, branchId: branch.id },
    });
    created.vehicles.push(vehicle.id);
    return { branchId: branch.id, vehicleId: vehicle.id };
  }

  function holdInput(
    s: { branchId: string; vehicleId: string },
    startAt: Date = START,
    endAt: Date = END,
  ): CreateHoldInput {
    return {
      vehicleId: s.vehicleId,
      pickupBranchId: s.branchId,
      returnBranchId: s.branchId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    };
  }

  async function book(
    s: { branchId: string; vehicleId: string },
    startAt: Date,
    endAt: Date,
    status: 'CONFIRMED' | 'CANCELLED' = 'CONFIRMED',
  ): Promise<void> {
    counter += 1;
    await prisma.reservation.create({
      data: {
        number: `HLD-${run}-${counter}`,
        status,
        startAt,
        endAt,
        days: 1,
        vehicleDailyPrice: DAILY,
        totalPrice: DAILY,
        vehicleId: s.vehicleId,
        pickupBranchId: s.branchId,
        returnBranchId: s.branchId,
      },
    });
  }

  describe('başarılı tutma', () => {
    it('araç 15 dakika tutulur ve yanıt sözleşmeye uyar', async () => {
      const s = await scenario();
      const result = await holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(Object.keys(result).sort()).toEqual(['expiresAt', 'id', 'vehicleId']);
      expect(result.vehicleId).toBe(s.vehicleId);
      const remaining = new Date(result.expiresAt).getTime() - Date.now();
      expect(remaining).toBeGreaterThan((HOLD_MINUTES - 1) * MINUTE);
      expect(remaining).toBeLessThanOrEqual(HOLD_MINUTES * MINUTE);
    });

    it('tutulan araç müsaitlik aramasında görünmez', async () => {
      const s = await scenario();
      const query = {
        pickupBranchId: s.branchId,
        returnBranchId: s.branchId,
        startAt: START.toISOString(),
        endAt: END.toISOString(),
      };
      expect(await catalog.getAvailableVehicles(query)).toHaveLength(1);
      await holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(await catalog.getAvailableVehicles(query)).toHaveLength(0);
    });

    it('aynı istemci aynı aracı aynı aralıkta yeniden isterse aynı tutma döner', async () => {
      const s = await scenario();
      const client = `client-${randomUUID()}`;
      const first = await holds.create(holdInput(s), client);
      const second = await holds.create(holdInput(s), client);
      expect(second.id).toBe(first.id);
      expect(second.expiresAt).toBe(first.expiresAt);
      expect(await prisma.hold.count({ where: { vehicleId: s.vehicleId } })).toBe(1);
    });

    it('süresi dolan tutma aracı başkasına açar', async () => {
      const s = await scenario();
      const first = await holds.create(holdInput(s), `client-${randomUUID()}`);
      await prisma.hold.update({
        where: { id: first.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const second = await holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(second.id).not.toBe(first.id);
    });

    it('bitişik aralık (biri diğerinin bittiği anda başlar) çakışma sayılmaz', async () => {
      const s = await scenario();
      await holds.create(holdInput(s, START, END), `client-${randomUUID()}`);
      const next = await holds.create(
        holdInput(s, END, new Date(END.getTime() + DAY)),
        `client-${randomUUID()}`,
      );
      expect(next.vehicleId).toBe(s.vehicleId);
    });
  });

  describe('çakışma (409 VEHICLE_UNAVAILABLE)', () => {
    it('başka istemci aynı aracı aynı aralıkta tutamaz', async () => {
      const s = await scenario();
      await holds.create(holdInput(s), `client-${randomUUID()}`);
      const error = await catchHttp(holds.create(holdInput(s), `client-${randomUUID()}`));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('kısmen çakışan aralık da reddedilir', async () => {
      const s = await scenario();
      await holds.create(holdInput(s), `client-${randomUUID()}`);
      const error = await catchHttp(
        holds.create(
          holdInput(s, new Date(START.getTime() + DAY), new Date(END.getTime() + DAY)),
          `client-${randomUUID()}`,
        ),
      );
      expect(error.getStatus()).toBe(409);
    });

    it('onaylı rezervasyonla çakışan araç tutulamaz', async () => {
      const s = await scenario();
      await book(s, new Date(START.getTime() + DAY), new Date(START.getTime() + 2 * DAY));
      const error = await catchHttp(holds.create(holdInput(s), `client-${randomUUID()}`));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('rezervasyon tam başlangıç anında bitiyorsa tutulabilir', async () => {
      const s = await scenario();
      await book(s, new Date(START.getTime() - 2 * DAY), START);
      const result = await holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(result.vehicleId).toBe(s.vehicleId);
    });

    it('iptal edilmiş rezervasyon engel olmaz', async () => {
      const s = await scenario();
      await book(s, START, END, 'CANCELLED');
      const result = await holds.create(holdInput(s), `client-${randomUUID()}`);
      expect(result.vehicleId).toBe(s.vehicleId);
    });
  });

  describe('eşzamanlılık', () => {
    it('8 istek aynı anda gelirse yalnızca biri aracı tutar', async () => {
      const s = await scenario();
      const clients = Array.from({ length: 8 }, () => `client-${randomUUID()}`);
      const results = await Promise.allSettled(
        clients.map((client) => holds.create(holdInput(s), client)),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(7);
      for (const r of rejected) {
        expect(r.reason).toBeInstanceOf(HttpException);
        expect((r.reason as HttpException).getStatus()).toBe(409);
      }
      expect(await prisma.hold.count({ where: { vehicleId: s.vehicleId } })).toBe(1);
    });
  });

  describe('hız sınırı (429 RATE_LIMITED)', () => {
    it('aynı istemci en fazla 5 aracı aynı anda tutabilir', async () => {
      const client = `client-${randomUUID()}`;
      for (let i = 0; i < MAX_ACTIVE_HOLDS_PER_CLIENT; i += 1) {
        const s = await scenario();
        await holds.create(holdInput(s), client);
      }
      const extra = await scenario();
      const error = await catchHttp(holds.create(holdInput(extra), client));
      expect(error.getStatus()).toBe(429);
      expect(bodyOf(error).code).toBe('RATE_LIMITED');

      // Başka bir istemci etkilenmez.
      const other = await holds.create(holdInput(extra), `client-${randomUUID()}`);
      expect(other.vehicleId).toBe(extra.vehicleId);
    });

    it('süresi dolan tutmalar sınıra sayılmaz', async () => {
      const client = `client-${randomUUID()}`;
      const first = await scenario();
      const created1 = await holds.create(holdInput(first), client);
      await prisma.hold.update({
        where: { id: created1.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const active = await prisma.hold.count({
        where: { clientKey: client, expiresAt: { gt: new Date() } },
      });
      expect(active).toBe(0);
    });
  });

  describe('girdi doğrulaması (422 VALIDATION_FAILED)', () => {
    it('eksik alanlar REQUIRED döner', async () => {
      const error = await catchHttp(holds.create({}, 'client-x'));
      expect(error.getStatus()).toBe(422);
      const fields = bodyOf(error).fieldErrors ?? {};
      for (const name of ['vehicleId', 'pickupBranchId', 'returnBranchId', 'startAt', 'endAt']) {
        expect(fields[name]).toBe('REQUIRED');
      }
    });

    it('30 dakikalık dilime oturmayan an reddedilir (NOT_IN_SLOT)', async () => {
      const s = await scenario();
      const error = await catchHttp(
        holds.create({ ...holdInput(s), startAt: '2031-03-10T10:15:00.000Z' }, 'client-x'),
      );
      expect(bodyOf(error).fieldErrors?.startAt).toBe('NOT_IN_SLOT');
    });

    it('bitiş başlangıçtan önceyse reddedilir (INVALID_DATE_RANGE)', async () => {
      const s = await scenario();
      const error = await catchHttp(holds.create(holdInput(s, END, START), 'client-x'));
      expect(bodyOf(error).fieldErrors?.endAt).toBe('INVALID_DATE_RANGE');
    });

    it('geçersiz kimlik biçimi reddedilir (INVALID_FORMAT)', async () => {
      const s = await scenario();
      const error = await catchHttp(
        holds.create({ ...holdInput(s), vehicleId: 'bu-bir-uuid-degil' }, 'client-x'),
      );
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('INVALID_FORMAT');
    });

    it('araç alış bayisinde değilse reddedilir (UNKNOWN_REFERENCE)', async () => {
      const a = await scenario();
      const b = await scenario();
      const error = await catchHttp(
        holds.create({ ...holdInput(a), vehicleId: b.vehicleId }, 'client-x'),
      );
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });

    it('var olmayan araç reddedilir (UNKNOWN_REFERENCE)', async () => {
      const s = await scenario();
      const error = await catchHttp(
        holds.create({ ...holdInput(s), vehicleId: randomUUID() }, 'client-x'),
      );
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });

    it('var olmayan iade bayisi reddedilir (UNKNOWN_REFERENCE)', async () => {
      const s = await scenario();
      const error = await catchHttp(
        holds.create({ ...holdInput(s), returnBranchId: randomUUID() }, 'client-x'),
      );
      expect(bodyOf(error).fieldErrors?.returnBranchId).toBe('UNKNOWN_REFERENCE');
    });

    it('pasif araç tutulamaz', async () => {
      const s = await scenario();
      await prisma.vehicle.update({ where: { id: s.vehicleId }, data: { active: false } });
      const error = await catchHttp(holds.create(holdInput(s), 'client-x'));
      expect(bodyOf(error).fieldErrors?.vehicleId).toBe('UNKNOWN_REFERENCE');
    });
  });
});
