import { HttpException } from '@nestjs/common';
import type { UserRow } from '../auth/user-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService, convertMinor, isPromoUsable, rentalDays, withPoints } from './pricing.service.js';
import { parseReservationRequest } from './reservation-input.js';
import { DAY_MS, daysAhead, slotAtLeast, slotBefore } from './dates.testing.js';

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
const START_DATE = daysAhead(30);
const START = START_DATE.toISOString();
const END = new Date(START_DATE.getTime() + 3 * DAY_MS).toISOString(); // 3 gün
const startPlus = (days: number) => new Date(START_DATE.getTime() + days * DAY_MS);

class FakeDb {
  vehicles: Row[] = [
    {
      id: IDS.vehicle,
      active: true,
      branchId: IDS.pickup,
      vehicleModel: { slug: 'toyota-corolla', brand: 'Toyota', model: 'Corolla', dailyPrice: 125000 },
    },
    {
      id: IDS.vehicle2,
      active: false,
      branchId: IDS.pickup,
      vehicleModel: { slug: 'fiat-egea', brand: 'Fiat', model: 'Egea', dailyPrice: 90000 },
    },
  ];
  extras: Row[] = [
    { slug: 'cocuk-koltugu', nameTr: 'Çocuk koltuğu', nameEn: 'Child seat', price: 12345, pricing: 'PER_DAY' },
    { slug: 'ek-surucu', nameTr: 'Ek sürücü', nameEn: 'Additional driver', price: 50000, pricing: 'FIXED' },
  ];
  rates: Row[] = [{ currency: 'EUR', ratePerTry: '0.02300000' }];
  promoCodes: Row[] = [
    { code: 'NOVERA10', percent: 10, active: true, validFrom: null, validUntil: null, maxRedemptions: null, oncePerUser: true },
    { code: 'HOSGELDIN', percent: 5, active: true, validFrom: null, validUntil: null, maxRedemptions: null, oncePerUser: true },
  ];
  branches = [IDS.pickup, IDS.dropoff];
  reservations: Row[] = [];
  holds: Row[] = [];

  vehicle = {
    findUnique: async ({ where }: any) => this.vehicles.find((v) => v.id === where.id) ?? null,
  };
  extra = {
    findMany: async ({ where }: any) => this.extras.filter((e) => where.slug.in.includes(e.slug)),
  };
  promoCode = {
    findUnique: async ({ where }: any) => this.promoCodes.find((c) => c.code === where.code) ?? null,
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
      where.promoCode !== undefined
        ? this.reservations.filter(
            (r) =>
              r.promoCode === where.promoCode &&
              r.status === where.status &&
              (where.userId === undefined || r.userId === where.userId),
          ).length
        : this.reservations.filter(
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
    expect(fieldErrorsOf({ ...base, vehicleId: 'x', currency: 'GBP', startAt: START.replace('T10:00:00', 'T10:15:00') })).toEqual({
      vehicleId: 'INVALID_FORMAT',
      currency: 'INVALID_FORMAT',
      startAt: 'NOT_IN_SLOT',
    });
    expect(fieldErrorsOf({ ...base, endAt: START })).toEqual({ endAt: 'INVALID_DATE_RANGE' });
    expect(fieldErrorsOf({ ...base, endAt: '2033-03-10T10:00:00Z' })).toEqual({ endAt: 'OUT_OF_RANGE' });
    expect(fieldErrorsOf({ ...base, holdId: 'abc' })).toEqual({ holdId: 'INVALID_FORMAT' });
  });

  it('başlangıç geçmişteyse ya da en yakın dilimden önceyse IN_PAST, bir yıldan uzaksa OUT_OF_RANGE (G-01)', () => {
    const inDay = (start: Date) => ({ ...base, startAt: start.toISOString(), endAt: new Date(start.getTime() + DAY_MS).toISOString() });
    expect(fieldErrorsOf(inDay(daysAhead(-1)))).toEqual({ startAt: 'IN_PAST' });
    expect(fieldErrorsOf(inDay(slotBefore(30)))).toEqual({ startAt: 'IN_PAST' });
    expect(() => parseReservationRequest(inDay(slotAtLeast(30)))).not.toThrow();
    expect(fieldErrorsOf(inDay(daysAhead(366)))).toEqual({ startAt: 'OUT_OF_RANGE' });
  });

  it('kampanya kodu boşluksuz ve büyük harfe çevrilerek alınır; kod yoksa null', () => {
    expect(parseReservationRequest({ ...base }).promoCode).toBeNull();
    expect(parseReservationRequest({ ...base, promoCode: null }).promoCode).toBeNull();
    expect(parseReservationRequest({ ...base, promoCode: '' }).promoCode).toBeNull();
    expect(parseReservationRequest({ ...base, promoCode: ' novera 10 ' }).promoCode).toBe('NOVERA10');
  });

  it('kod biçimine uymayan değer promoCode alanında INVALID_FORMAT olur', () => {
    for (const promoCode of ['ab', 'A'.repeat(21), 'NOVERA-10', 'İNDİRİM%', 12, true, {}]) {
      expect(fieldErrorsOf({ ...base, promoCode })).toEqual({ promoCode: 'INVALID_FORMAT' });
    }
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
        slug: 'toyota-corolla',
        label: { tr: 'Toyota Corolla', en: 'Toyota Corolla' },
        quantity: 3,
        unitPrice: { amount: 125000, currency: 'TRY' },
        total: { amount: 375000, currency: 'TRY' },
      },
      {
        type: 'EXTRA',
        slug: 'cocuk-koltugu',
        label: { tr: 'Çocuk koltuğu', en: 'Child seat' },
        quantity: 6,
        unitPrice: { amount: 12345, currency: 'TRY' },
        total: { amount: 74070, currency: 'TRY' },
      },
      {
        type: 'EXTRA',
        slug: 'ek-surucu',
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
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: startPlus(2), endAt: startPlus(5) });
      const error = await catchHttp(service.price({ ...base }));
      expect(error.getStatus()).toBe(409);
      expect(bodyOf(error).code).toBe('VEHICLE_UNAVAILABLE');
    });

    it('iptal edilmiş rezervasyon engellemez', async () => {
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CANCELLED', startAt: at(START), endAt: at(END) });
      await expect(service.price({ ...base })).resolves.toBeDefined();
    });

    it('yarı açık aralık: biri diğerinin bittiği anda başlayabilir', async () => {
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: startPlus(3), endAt: startPlus(5) });
      db.reservations.push({ vehicleId: IDS.vehicle, status: 'CONFIRMED', startAt: startPlus(-2), endAt: startPlus(0) });
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

describe('kampanya kodu', () => {
  let db: FakeDb;
  let service: PricingService;

  beforeEach(() => {
    db = new FakeDb();
    service = new PricingService(db as unknown as PrismaService);
  });

  const discountOf = (result: Awaited<ReturnType<PricingService['price']>>) =>
    result.lines.find((line) => line.type === 'DISCOUNT');

  it('kod yoksa promo null ve indirim satırı yoktur', async () => {
    const result = await service.price({ ...base });
    expect(result.promo).toBeNull();
    expect(discountOf(result)).toBeUndefined();
  });

  it('NOVERA10 araç ve ek hizmetlerin toplamından yüzde 10 düşer; satır en sondadır ve negatiftir', async () => {
    const result = await service.price({
      ...base,
      promoCode: 'NOVERA10',
      extras: [
        { slug: 'cocuk-koltugu', quantity: 2 },
        { slug: 'ek-surucu', quantity: 1 },
      ],
    });
    const subtotal = 375000 + 74070 + 50000; // 499 070
    const discount = Math.floor(subtotal / 10); // 49 907
    expect(result.lines.map((line) => line.type)).toEqual(['VEHICLE', 'EXTRA', 'EXTRA', 'DISCOUNT']);
    expect(discountOf(result)).toEqual({
      type: 'DISCOUNT',
      slug: 'NOVERA10',
      label: { tr: 'Kampanya kodu NOVERA10 (%10)', en: 'Campaign code NOVERA10 (10% off)' },
      quantity: 1,
      unitPrice: { amount: -discount, currency: 'TRY' },
      total: { amount: -discount, currency: 'TRY' },
    });
    expect(result.promo).toEqual({ code: 'NOVERA10', applied: true, percent: 10 });
    expect(result.total).toEqual({ amount: subtotal - discount, currency: 'TRY' });
    expect(result.payable).toEqual(result.total);
  });

  it('kalemlerin toplamı (indirim dahil) total ile tam eşittir', async () => {
    const result = await service.price({ ...base, promoCode: 'HOSGELDIN', extras: [{ slug: 'cocuk-koltugu', quantity: 3 }] });
    expect(result.lines.reduce((sum, line) => sum + line.total.amount, 0)).toBe(result.total.amount);
  });

  it('indirim alt birime aşağı yuvarlanır: yüzdenin gösterdiğinden fazla olmaz', async () => {
    db.vehicles[0]!.vehicleModel.dailyPrice = 12345; // 3 gün = 37 035, yüzde 5 = 1851,75
    const result = await service.price({ ...base, promoCode: 'HOSGELDIN' });
    expect(discountOf(result)!.total.amount).toBe(-1851);
    expect(result.total.amount).toBe(37035 - 1851);
  });

  it('kod küçük harf ve boşlukla gelse de uygulanır', async () => {
    const result = await service.price({ ...base, promoCode: '  novera10 ' });
    expect(result.promo).toEqual({ code: 'NOVERA10', applied: true, percent: 10 });
  });

  it('EUR\'da indirim dönüştürülmüş tutar üzerinden hesaplanır', async () => {
    const result = await service.price({ ...base, currency: 'EUR', promoCode: 'NOVERA10' });
    const vehicleTotal = 2875 * 3; // 8 625
    expect(discountOf(result)!.total).toEqual({ amount: -Math.floor(vehicleTotal / 10), currency: 'EUR' });
    expect(result.total.amount).toBe(vehicleTotal - Math.floor(vehicleTotal / 10));
  });

  it('olmayan kod uygulanmaz: fiyat düz kalır ve cevap bunu söyler (hata değildir)', async () => {
    const plain = await service.price({ ...base });
    const result = await service.price({ ...base, promoCode: 'YOKBOYLEKOD' });
    expect(result.promo).toEqual({ code: 'YOKBOYLEKOD', applied: false, percent: null });
    expect(discountOf(result)).toBeUndefined();
    expect(result.total).toEqual(plain.total);
  });

  // QUALITY G-04: a code that is used up, or that this person already used, is "not applied", and the answer looks
  // exactly like the one for a code that does not exist, so nobody can tell codes apart by trying them.
  describe('kullanım tavanları (V2-05)', () => {
    const used = (code: string, userId: string, status = 'CONFIRMED') => ({ promoCode: code, userId, status });
    const alice = { id: 'alice', accountType: 'INDIVIDUAL' } as unknown as UserRow;

    it('toplam tavanı dolmuş kod uygulanmaz ve cevap olmayan kodla aynı biçimdedir', async () => {
      db.promoCodes.push({ code: 'TEKLIK', percent: 20, active: true, validFrom: null, validUntil: null, maxRedemptions: 1, oncePerUser: false });
      db.reservations.push(used('TEKLIK', 'someone'));
      const exhausted = await service.price({ ...base, promoCode: 'TEKLIK' });
      const missing = await service.price({ ...base, promoCode: 'YOKBOYLEKOD' });
      expect(exhausted.promo).toEqual({ code: 'TEKLIK', applied: false, percent: null });
      expect(Object.keys(exhausted.promo!).sort()).toEqual(Object.keys(missing.promo!).sort());
      expect(discountOf(exhausted)).toBeUndefined();
    });

    it('iptal edilen rezervasyon kodu geri verir', async () => {
      db.promoCodes.push({ code: 'TEKLIK', percent: 20, active: true, validFrom: null, validUntil: null, maxRedemptions: 1, oncePerUser: false });
      db.reservations.push(used('TEKLIK', 'someone', 'CANCELLED'));
      const result = await service.price({ ...base, promoCode: 'TEKLIK' });
      expect(result.promo).toEqual({ code: 'TEKLIK', applied: true, percent: 20 });
    });

    it('kişi başı tek kullanım: kullanmış kişide uygulanmaz, başkasında ve girişsizde uygulanır', async () => {
      db.promoCodes.push({ code: 'BIRKEZ', percent: 20, active: true, validFrom: null, validUntil: null, maxRedemptions: null, oncePerUser: true });
      db.reservations.push(used('BIRKEZ', 'alice'));
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' }, alice)).promo?.applied).toBe(false);
      const bob = { id: 'bob', accountType: 'INDIVIDUAL' } as unknown as UserRow;
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' }, bob)).promo?.applied).toBe(true);
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' })).promo?.applied).toBe(true);
    });

    it('oncePerUser kapalıysa aynı kişi tekrar kullanabilir', async () => {
      db.promoCodes.push({ code: 'HERKEZ', percent: 20, active: true, validFrom: null, validUntil: null, maxRedemptions: null, oncePerUser: false });
      db.reservations.push(used('HERKEZ', 'alice'));
      expect((await service.price({ ...base, promoCode: 'HERKEZ' }, alice)).promo?.applied).toBe(true);
    });
  });

  it('kapalı, henüz başlamamış ve süresi geçmiş kod uygulanmaz', async () => {
    db.promoCodes.push(
      { code: 'KAPALI', percent: 20, active: false, validFrom: null, validUntil: null },
      { code: 'YAKINDA', percent: 20, active: true, validFrom: new Date(Date.now() + 3600_000), validUntil: null },
      { code: 'BITTI', percent: 20, active: true, validFrom: null, validUntil: new Date(Date.now() - 3600_000) },
      { code: 'SURELI', percent: 20, active: true, validFrom: new Date(Date.now() - 3600_000), validUntil: new Date(Date.now() + 3600_000) },
    );
    for (const code of ['KAPALI', 'YAKINDA', 'BITTI']) {
      const result = await service.price({ ...base, promoCode: code });
      expect(result.promo).toEqual({ code, applied: false, percent: null });
    }
    const valid = await service.price({ ...base, promoCode: 'SURELI' });
    expect(valid.promo).toEqual({ code: 'SURELI', applied: true, percent: 20 });
  });

  it('isPromoUsable: bitiş anı dahil değildir, başlangıç anı dahildir', () => {
    const at = new Date('2031-03-10T10:00:00Z');
    expect(isPromoUsable({ active: true, validFrom: at, validUntil: null }, at)).toBe(true);
    expect(isPromoUsable({ active: true, validFrom: null, validUntil: at }, at)).toBe(false);
    expect(isPromoUsable({ active: false, validFrom: null, validUntil: null }, at)).toBe(false);
  });

  it('puan, kodun düştüğü tutardan SONRA kalanın en çok yarısını karşılar', async () => {
    const result = await service.price({ ...base, promoCode: 'NOVERA10' }); // 375 000 - 37 500 = 337 500
    const withAllPoints = withPoints(result, 100_000);
    // Yarısı 168 750 kuruş = 337 puan (1 puan = 500 kuruş), 168 500 kuruş.
    expect(withAllPoints.pointsUsed).toBe(337);
    expect(withAllPoints.payable).toEqual({ amount: 337500 - 337 * 500, currency: 'TRY' });
    expect(withAllPoints.total).toEqual(result.total);
    expect(withAllPoints.promo).toEqual(result.promo);
  });
});
