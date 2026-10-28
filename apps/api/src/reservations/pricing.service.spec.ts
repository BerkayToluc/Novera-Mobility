import { HttpException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { convertMinor } from '../common/money.js';
import { rentalDays } from '../common/time.js';
import { PricingService } from './pricing.service.js';
import { parseReservationRequest } from './reservation-input.js';
import { DAY_MS, daysAhead, slotAtLeast, slotBefore } from './dates.testing.js';
import { END, FakeDb, IDS, START, base, bodyOf, catchHttp, startPlus } from './pricing.service.testing.js';

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
    expect(
      fieldErrorsOf({ ...base, vehicleId: 'x', currency: 'GBP', startAt: START.replace('T10:00:00', 'T10:15:00') }),
    ).toEqual({
      vehicleId: 'INVALID_FORMAT',
      currency: 'INVALID_FORMAT',
      startAt: 'NOT_IN_SLOT',
    });
    expect(fieldErrorsOf({ ...base, endAt: START })).toEqual({ endAt: 'INVALID_DATE_RANGE' });
    expect(fieldErrorsOf({ ...base, endAt: '2033-03-10T10:00:00Z' })).toEqual({ endAt: 'OUT_OF_RANGE' });
    expect(fieldErrorsOf({ ...base, holdId: 'abc' })).toEqual({ holdId: 'INVALID_FORMAT' });
  });

  it('başlangıç geçmişteyse ya da en yakın dilimden önceyse IN_PAST, bir yıldan uzaksa OUT_OF_RANGE (G-01)', () => {
    const inDay = (start: Date) => ({
      ...base,
      startAt: start.toISOString(),
      endAt: new Date(start.getTime() + DAY_MS).toISOString(),
    });
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
    expect(
      fieldErrorsOf({
        ...base,
        extras: [
          { slug: 'a', quantity: 1 },
          { slug: 'a', quantity: 2 },
        ],
      }),
    ).toEqual({
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
    expect(bodyOf(branch)).toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { returnBranchId: 'UNKNOWN_REFERENCE' },
    });

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
      db.reservations.push({
        vehicleId: IDS.vehicle,
        status: 'CONFIRMED',
        startAt: startPlus(-2),
        endAt: startPlus(0),
      });
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
