import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { AvailabilityService } from '../catalog/availability.service.js';
import { HoldsService } from './holds.service.js';
import 'dotenv/config';
import { HttpException } from '@nestjs/common';
import { daysAhead } from '../reservations/dates.testing.js';
import { testPlate } from '../common/plate.testing.js';

// Shared set-up of holds.service.spec.ts (V2-13, QUALITY M-04): the fake database and the fixtures, moved out so the spec itself is only the cases.
// Entegrasyon testi: POST /holds, gerçek PostgreSQL'e karşı (BACKLOG Y48).
// Yalnızca adında "test" geçen bir veritabanında çalışır; TEST_DATABASE_URL yoksa atlanır.
export const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
export const describeDb = databaseUrl ? describe : describe.skip;

export const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;
export const START = daysAhead(30);
export const END = new Date(START.getTime() + 3 * DAY);
export const DAILY = 125000;

export async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}

export type ErrorBody = { code: string; fieldErrors?: Record<string, string> };
export const bodyOf = (error: HttpException): ErrorBody => error.getResponse() as ErrorBody;

export function holdsFixture() {
  let prisma: PrismaService;
  let holds: HoldsService;
  let catalog: AvailabilityService;
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
    catalog = new AvailabilityService(prisma);

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
      data: { plate: testPlate(), year: 2026, vehicleModelId: modelId, branchId: branch.id },
    });
    created.vehicles.push(vehicle.id);
    return { branchId: branch.id, vehicleId: vehicle.id };
  }

  function holdInput(
    s: { branchId: string; vehicleId: string },
    startAt: Date = START,
    endAt: Date = END,
  ): Record<string, unknown> {
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

  return {
    get prisma() {
      return prisma;
    },
    get holds() {
      return holds;
    },
    get catalog() {
      return catalog;
    },
    scenario,
    holdInput,
    book,
  };
}
