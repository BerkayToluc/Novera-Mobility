import type { UserRow } from '../auth/user-view.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PricingService, isPromoUsable, withPoints } from './pricing.service.js';
import { FakeDb, base } from './pricing.service.testing.js';

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
    const result = await service.price({
      ...base,
      promoCode: 'HOSGELDIN',
      extras: [{ slug: 'cocuk-koltugu', quantity: 3 }],
    });
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

  it("EUR'da indirim dönüştürülmüş tutar üzerinden hesaplanır", async () => {
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
      db.promoCodes.push({
        code: 'TEKLIK',
        percent: 20,
        active: true,
        validFrom: null,
        validUntil: null,
        maxRedemptions: 1,
        oncePerUser: false,
      });
      db.reservations.push(used('TEKLIK', 'someone'));
      const exhausted = await service.price({ ...base, promoCode: 'TEKLIK' });
      const missing = await service.price({ ...base, promoCode: 'YOKBOYLEKOD' });
      expect(exhausted.promo).toEqual({ code: 'TEKLIK', applied: false, percent: null });
      expect(Object.keys(exhausted.promo!).sort()).toEqual(Object.keys(missing.promo!).sort());
      expect(discountOf(exhausted)).toBeUndefined();
    });

    it('iptal edilen rezervasyon kodu geri verir', async () => {
      db.promoCodes.push({
        code: 'TEKLIK',
        percent: 20,
        active: true,
        validFrom: null,
        validUntil: null,
        maxRedemptions: 1,
        oncePerUser: false,
      });
      db.reservations.push(used('TEKLIK', 'someone', 'CANCELLED'));
      const result = await service.price({ ...base, promoCode: 'TEKLIK' });
      expect(result.promo).toEqual({ code: 'TEKLIK', applied: true, percent: 20 });
    });

    it('kişi başı tek kullanım: kullanmış kişide uygulanmaz, başkasında ve girişsizde uygulanır', async () => {
      db.promoCodes.push({
        code: 'BIRKEZ',
        percent: 20,
        active: true,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        oncePerUser: true,
      });
      db.reservations.push(used('BIRKEZ', 'alice'));
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' }, alice)).promo?.applied).toBe(false);
      const bob = { id: 'bob', accountType: 'INDIVIDUAL' } as unknown as UserRow;
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' }, bob)).promo?.applied).toBe(true);
      expect((await service.price({ ...base, promoCode: 'BIRKEZ' })).promo?.applied).toBe(true);
    });

    it('oncePerUser kapalıysa aynı kişi tekrar kullanabilir', async () => {
      db.promoCodes.push({
        code: 'HERKEZ',
        percent: 20,
        active: true,
        validFrom: null,
        validUntil: null,
        maxRedemptions: null,
        oncePerUser: false,
      });
      db.reservations.push(used('HERKEZ', 'alice'));
      expect((await service.price({ ...base, promoCode: 'HERKEZ' }, alice)).promo?.applied).toBe(true);
    });
  });

  it('kapalı, henüz başlamamış ve süresi geçmiş kod uygulanmaz', async () => {
    db.promoCodes.push(
      { code: 'KAPALI', percent: 20, active: false, validFrom: null, validUntil: null },
      { code: 'YAKINDA', percent: 20, active: true, validFrom: new Date(Date.now() + 3600_000), validUntil: null },
      { code: 'BITTI', percent: 20, active: true, validFrom: null, validUntil: new Date(Date.now() - 3600_000) },
      {
        code: 'SURELI',
        percent: 20,
        active: true,
        validFrom: new Date(Date.now() - 3600_000),
        validUntil: new Date(Date.now() + 3600_000),
      },
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
