import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService, convertMinor, rentalDays } from './pricing.service.js';
import { parseReservationRequest } from './reservation-input.js';

// Birim testi: veritabanı bellekte taklit edilir (gerçek PostgreSQL gerekmez).
type Row = Record<string, any>;

const IDS = {
  vehicle: '11111111-1111-4111-8111-111111111111',
  vehicle2: '11111111-1111-4111-8111-222222222222',
  pickup: '22222222-2222-4222-8222-222222222222',
  dropoff: '33333333-3333-4333-8333-333333333333',
  other: '44444444-4444-4444-8444-444444444444',
  hold: '55555555-5555-4555-8555-555555555555',
};
const START = '2031-03-10T10:00:00.000Z';
const END = '2031-03-13T10:00:00.000Z'; // 3 gün

class FakeDb {
  vehicles: Row[] = [
    {
      id: IDS.vehicle,
      active: true,
      branchId: IDS.pickup,
      vehicleModel: { brand: 'Toyota', model: 'Corolla', dailyPrice: 125000 },
    },
    {
      id: IDS.vehicle2,
      active: false,
      branchId: IDS.pickup,
      vehicleModel: { brand: 'Fiat', model: 'Egea', dailyPrice: 90000 },
    },
  ];
  extras: Row[] = [
    { slug: 'cocuk-koltugu', nameTr: 'Çocuk koltuğu', nameEn: 'Child seat', price: 12345, pricing: 'PER_DAY' },
    { slug: 'ek-surucu', nameTr: 'Ek sürücü', nameEn: 'Additional driver', price: 50000, pricing: 'FIXED' },
  ];
  rates: Row[] = [{ currency: 'EUR', ratePerTry: '0.02300000' }];
  branches = [IDS.pickup, IDS.dropoff];
  reservations: Row[] = [];
  holds: Row[] = [];

  vehicle = {
    findUnique: async ({ where }: any) => this.vehicles.find((v) => v.id === where.id) ?? null,
  };
  extra = {
    findMany: async ({ where }: any) => this.extras.filter((e) => where.slug.in.includes(e.slug)),
  };
  exchangeRate = {
    findUnique: async ({ where }: any) => this.rates.find((r) => r.currency === where.currency) ?? null,
  };
  branch = {
    findMany: async ({ where }: any) =>
      this.branches.filter((id) => where.id.in.includes(id)).map((id) => ({ id })),
  };
  reservation = {
    count: async ({ where }: any) =>
      this.reservations.filter(
        (r) =>
          r.vehicleId === where.vehicleId &&
          r.status === where.status &&
          r.startAt < where.startAt.lt &&
          r.endAt > where.endAt.gt,
      ).length,
  };
  hold = {
    count: async ({ where }: any) =>
      this.holds.filter(
        (h) =>
          h.vehicleId === where.vehicleId &&
          h.expiresAt > where.expiresAt.gt &&
          h.startAt < where.startAt.lt &&
          h.endAt > where.endAt.gt &&
          (!where.id?.not || h.id !== where.id.not),
      ).length,
  };
}

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

const base = {
  vehicleId: IDS.vehicle,
  pickupBranchId: IDS.pickup,
  returnBranchId: IDS.dropoff,
  startAt: START,
  endAt: END,
  currency: 'TRY',
};

describe('gün ve kur yardımcıları', () => {
  it('gün sayısı yukarı yuvarlanır, en az 1', () => {
    const t = (iso: string) => new Date(iso);
    expect(rentalDays(t('2031-03-10T10:00:00Z'), t('2031-03-10T10:30:00Z'))).toBe(1);
    expect(rentalDays(t('2031-03-10T10:00:00Z'), t('2031-03-11T10:00:00Z'))).toBe(1);
    expect(rentalDays(t('2031-03-10T10:00:00Z'), t('2031-03-11T10:30:00Z'))).toBe(2);
    expect(rentalDays(t('2031-03-10T10:00:00Z'), t('2031-03-13T10:00:00Z'))).toBe(3);
  });

  it('TRY çevrilmez, diğerleri yuvarlanır', () => {
    expect(convertMinor(12345, 1, 'TRY')).toBe(12345);
    expect(convertMinor(12345, 0.023, 'EUR')).toBe(284); // 283.935
  });
});

describe('parseReservationRequest', () => {
  it('geçerli isteği ayrıştırır (holdId ve extras isteğe bağlı)', () => {
    const parsed = parseReservationRequest({ ...base });
    expect(parsed.holdId).toBeNull();
    expect(parsed.extras).toEqual([]);
    expect(parsed.startAt.toISOString()).toBe(START);
  });

  it('eksik alanları REQUIRED ile bildirir', () => {
    const error = (() => {
      try {
        parseReservationRequest({});
      } catch (e) {
        return e as HttpException;
      }
      throw new Error('hata bekleniyordu');
    })();
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).fieldErrors).toEqual({
      vehicleId: 'REQUIRED',
      pickupBranchId: 'REQUIRED',
      returnBranchId: 'REQUIRED',
      startAt: 'REQUIRED',
      endAt: 'REQUIRED',
      currency: 'REQUIRED',
    });
  });

  const fieldErrorsOf = (input: unknown) => {
    try {
      parseReservationRequest(input);
    } catch (e) {
      return bodyOf(e as HttpException).fieldErrors;
    }
    throw new Error('hata bekleniyordu');
  };

  it('biçim, dilim ve aralık hatalarını sabit kodlarla döner', () => {
    expect(fieldErrorsOf({ ...base, vehicleId: 'x', currency: 'GBP', startAt: '2031-03-10T10:15:00Z' })).toEqual({
      vehicleId: 'INVALID_FORMAT',
      currency: 'INVALID_FORMAT',
      startAt: 'NOT_IN_SLOT',
    });
    expect(fieldErrorsOf({ ...base, endAt: START })).toEqual({ endAt: 'INVALID_DATE_RANGE' });
    expect(fieldErrorsOf({ ...base, endAt: '2033-03-10T10:00:00Z' })).toEqual({ endAt: 'OUT_OF_RANGE' });
    expect(fieldErrorsOf({ ...base, holdId: 'abc' })).toEqual({ holdId: 'INVALID_FORMAT' });
  });

  it('ek hizmet hatalarını extras alanında bildirir', () => {
    expect(fieldErrorsOf({ ...base, extras: 'x' })).toEqual({ extras: 'INVALID_FORMAT' });
    expect(fieldErrorsOf({ ...base, extras: [{ slug: 'a', quantity: 0 }] })).toEqual({ extras: 'OUT_OF_RANGE' });
    expect(fieldErrorsOf({ ...base, extras: [{ slug: 'a', quantity: 11 }] })).toEqual({ extras: 'OUT_OF_RANGE' });
    expect(fieldErrorsOf({ ...base, extras: [{ slug: 'a', quantity: 1.5 }] })).toEqual({ extras: 'INVALID_FORMAT' });
    expect(fieldErrorsOf({ ...base, extras: [{ slug: 'a', quantity: 1 }, { slug: 'a', quantity: 2 }] })).toEqual({
      extras: 'INVALID_FORMAT',
    });
    expect(fieldErrorsOf({ ...base, extras: [{ quantity: 1 }] })).toEqual({ extras: 'INVALID_FORMAT' });
  });
});

describe('PricingService.price', () => {
  let db: FakeDb;
  let service: PricingService;

  beforeEach(() => {
    db = new FakeDb();
    service = new PricingService(db as unknown as PrismaService);
  });

  it('TRY: araç gün sayısıyla, günlük ek hizmet adet × gün, sabit ek hizmet adetle', async () => {
    const result = await service.price({
      ...base,
      extras: [
        { slug: 'cocuk-koltugu', quantity: 2 },
        { slug: 'ek-surucu', quantity: 1 },
      ],
    });
    expect(result.currency).toBe('TRY');
    expect(result.exchangeRate).toBe(1);
    expect(result.days).toBe(3);
    expect(result.lines).toEqual([
      {
        type: 'VEHICLE',
        label: { tr: 'Toyota Corolla', en: 'Toyota Corolla' },
        quantity: 3,
        unitPrice: { amount: 125000, currency: 'TRY' },
        total: { amount: 375000, currency: 'TRY' },
      },
      {
        type: 'EXTRA',
        label: { tr: 'Çocuk koltuğu', en: 'Child seat' },
        quantity: 6,
        unitPrice: { amount: 12345, currency: 'TRY' },
        total: { amount: 74070, currency: 'TRY' },
      },
      {
        type: 'EXTRA',
        label: { tr: 'Ek sürücü', en: 'Additional driver' },
        quantity: 1,
        unitPrice: { amount: 50000, currency: 'TRY' },
        total: { amount: 50000, currency: 'TRY' },
      },
    ]);
    expect(result.total).toEqual({ amount: 375000 + 74070 + 50000, currency: 'TRY' });
  });

  it('EUR: birim fiyat önce çevrilir sonra çarpılır, kalem toplamları total ile tam eşit', async () => {
    const result = await service.price({
      ...base,
      currency: 'EUR',
      extras: [{ slug: 'cocuk-koltugu', quantity: 2 }],
    });
    expect(result.exchangeRate).toBe(0.023);
    const [vehicle, extra] = result.lines;
    expect(vehicle!.unitPrice.amount).toBe(2875); // 125000 × 0.023
    expect(vehicle!.total.amount).toBe(2875 * 3);
    expect(extra!.unitPrice.amount).toBe(284); // 12345 × 0.023 = 283.935
    expect(extra!.total.amount).toBe(284 * 6);
    expect(result.total.amount).toBe(vehicle!.total.amount + extra!.total.amount);
    expect(result.lines.every((line) => line.total.currency === 'EUR')).toBe(true);
  });

  it('veritabanında kur yoksa yedek kur kullanılır', async () => {
    db.rates = [];
    const result = await service.price({ ...base, currency: 'USD' });
    expect(result.exchangeRate).toBe(0.023);
  });

  it('bilinmeyen bayi, araç, başka bayideki araç, pasif araç ve ek hizmet 422 UNKNOWN_REFERENCE', async () => {
    const branch = await catchHttp(service.price({ ...base, returnBranchId: IDS.other }));
    expect(bodyOf(branch)).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: { returnBranchId: 'UNKNOWN_REFERENCE' } });

    const missing = await catchHttp(service.price({ ...base, vehicleId: IDS.other }));
    expect(bodyOf(missing).fieldErrors).toEqual({ vehicleId: 'UNKNOWN_REFERENCE' });

    db.vehicles[0]!.branchId = IDS.dropoff;
    const wrongBranch = await catchHttp(service.price({ ...base }));
    expect(bodyOf(wrongBranch).fieldErrors).toEqual({ vehicleId: 'UNKNOWN_REFERENCE' });
    db.vehicles[0]!.branchId = IDS.pickup;

    const inactive = await catchHttp(service.price({ ...base, vehicleId: IDS.vehicle2 }));
    expect(bodyOf(inactive).fieldErrors).toEqual({ vehicleId: 'UNKNOWN_REFERENCE' });

    const extra = await catchHttp(service.price({ ...base, extras: [{ slug: 'yok', quantity: 1 }] }));
    expect(bodyOf(extra).fieldErrors).toEqual({ extras: 'UNKNOWN_REFERENCE' });
  });

  describe('müsaitlik (409 VEHICLE_UNAVAILABLE)', () => {
    const at = (iso: string) => new Date(iso);
    const future = new Date(Date.now() + 10 * 60_000);

    it('çakışan onaylı rezervasyon varsa reddeder', async () => {
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: at('2031-03-12T10:00:00Z'), endAt: at('2031-03-15T10:00:00Z') });
      const error = await catchHttp(service.price({ ...base }));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('iptal edilmiş rezervasyon engellemez', async () => {
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CANCELLED', startAt: at(START), endAt: at(END) });
      await expect(service.price({ ...base })).resolves.toBeDefined();
    });

    it('yarı açık aralık: biri diğerinin bittiği anda başlayabilir', async () => {
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: at('2031-03-13T10:00:00Z'), endAt: at('2031-03-15T10:00:00Z') });
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: at('2031-03-08T10:00:00Z'), endAt: at('2031-03-10T10:00:00Z') });
      await expect(service.price({ ...base })).resolves.toBeDefined();
    });

    it('başkasının süresi dolmamış tutması engeller, kendi tutması (holdId) engellemez, süresi dolmuş tutma engellemez', async () => {
      db.holds.push({ id: IDS.hold, vehicleId: IDS.vehicle, expiresAt: future, startAt: at(START), endAt: at(END) });
      const blocked = await catchHttp(service.price({ ...base }));
      expect(bodyOf(blocked).code).toBe('VEHICLE_UNAVAILABLE');
      await expect(service.price({ ...base, holdId: IDS.hold })).resolves.toBeDefined();

      db.holds[0]!.expiresAt = new Date(Date.now() - 1000);
      await expect(service.price({ ...base })).resolves.toBeDefined();
    });
  });
});
