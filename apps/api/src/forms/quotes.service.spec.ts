import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { QuotesService } from './quotes.service.js';

// Entegrasyon testi: POST /quotes, gerçek PostgreSQL'e karşı (BACKLOG #33, Y35).
// Yalnızca adında "test" geçen veritabanında çalışır; TEST_DATABASE_URL yoksa atlanır.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

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
const NUMBER_FORMAT = /^TKL-\d{4}-\d{5}$/;
const serialOf = (number: string): number => Number(number.slice(-5));

describeDb('POST /quotes kurumsal teklif (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: QuotesService;
  const run = randomUUID().slice(0, 8);
  const company = (label: string) => `Test ${run} ${label}`;
  const created = { products: [] as string[] };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new QuotesService(prisma);
  });

  afterAll(async () => {
    await prisma.quoteRequest.deleteMany({ where: { companyName: { startsWith: `Test ${run} ` } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.$disconnect();
  });

  const valid = (label: string) => ({
    companyName: company(label),
    contactName: 'Mehmet Demir',
    phone: '0212 555 01 01',
    email: `quote-${run}-${label}@sirket.example`,
    vehicleCount: 10,
    durationMonths: 24,
    vehicleType: 'binek,suv',
    deliveryCities: 'İstanbul, Ankara',
    notes: 'Haftaiçi teslim tercih ederiz.',
    consent: true,
  });

  it('geçerli talep kaydedilir; TKL-YYYY-NNNNN numarası döner', async () => {
    const before = Date.now();
    const result = await service.create(valid('ok'));
    expect(result.received).toBe(true);
    expect(result.referenceNumber).toMatch(NUMBER_FORMAT);

    const row = await prisma.quoteRequest.findUnique({ where: { number: result.referenceNumber } });
    expect(row).not.toBeNull();
    expect(row?.status).toBe('RECEIVED');
    expect(row?.companyName).toBe(company('ok'));
    expect(row?.contactName).toBe('Mehmet Demir');
    expect(row?.phone).toBe('0212 555 01 01');
    expect(row?.vehicleCount).toBe(10);
    expect(row?.durationMonths).toBe(24);
    expect(row?.vehicleType).toBe('binek,suv');
    expect(row?.deliveryCities).toBe('İstanbul, Ankara');
    expect(row?.notes).toBe('Haftaiçi teslim tercih ederiz.');
    expect(row?.productId).toBeNull();
    expect(row?.userId).toBeNull();
    expect(row?.kvkkConsentAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('numara yılın son numarasının bir fazlasıdır', async () => {
    const first = await service.create(valid('seq1'));
    const second = await service.create(valid('seq2'));
    expect(second.referenceNumber.slice(0, 9)).toBe(first.referenceNumber.slice(0, 9));
    expect(serialOf(second.referenceNumber)).toBe(serialOf(first.referenceNumber) + 1);
  });

  it('5 talep aynı anda gelirse hepsi kaydedilir ve numaralar birbirinden farklıdır', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => service.create(valid(`par${i}`))),
    );
    const numbers = results.map((r) => r.referenceNumber);
    expect(new Set(numbers).size).toBe(5);
    for (const number of numbers) expect(number).toMatch(NUMBER_FORMAT);
    const saved = await prisma.quoteRequest.count({ where: { companyName: { startsWith: company('par') } } });
    expect(saved).toBe(5);
  });

  it('oturumdaki hesaba bağlanır; GET /me/quotes yalnızca kendi taleplerini yeniden eskiye döner', async () => {
    const owner = await prisma.user.create({
      data: { email: `quote-${run}-owner@sirket.example`, passwordHash: 'x', firstName: 'A', lastName: 'B', accountType: 'CORPORATE' },
    });
    const other = await prisma.user.create({
      data: { email: `quote-${run}-other@sirket.example`, passwordHash: 'x', firstName: 'C', lastName: 'D' },
    });
    try {
      const first = await service.create(valid('mine1'), owner.id);
      const second = await service.create(valid('mine2'), owner.id);
      await service.create(valid('theirs'), other.id);
      await service.create(valid('anon'));

      const list = await service.listMine(owner.id);
      expect(list.map((q) => q.number)).toEqual([second.referenceNumber, first.referenceNumber]);
      expect(list[0]).toMatchObject({ vehicleCount: 10, durationMonths: 24, productSlug: null, status: 'RECEIVED' });
      expect(typeof list[0].createdAt).toBe('string');
      expect(await service.listMine(randomUUID())).toEqual([]);
    } finally {
      await prisma.quoteRequest.deleteMany({ where: { userId: { in: [owner.id, other.id] } } });
      await prisma.user.deleteMany({ where: { id: { in: [owner.id, other.id] } } });
    }
  });

  it('isteğe bağlı alanlar boş bırakılabilir', async () => {
    const result = await service.create(
      { companyName: company('min'), email: `quote-${run}-min@sirket.example`, vehicleCount: 1, durationMonths: 1, vehicleType: 'suv', consent: true },
    );
    const row = await prisma.quoteRequest.findUnique({ where: { number: result.referenceNumber } });
    expect(row?.contactName).toBeNull();
    expect(row?.phone).toBeNull();
    expect(row?.deliveryCities).toBeNull();
    expect(row?.notes).toBeNull();
  });

  describe('ürün bağlantısı', () => {
    it('geçerli productSlug talebe bağlanır', async () => {
      const slug = `test-urun-${run}`;
      const product = await prisma.product.create({ data: { slug } });
      created.products.push(product.id);

      const result = await service.create({ ...valid('prod'), productSlug: slug });
      const row = await prisma.quoteRequest.findUnique({ where: { number: result.referenceNumber } });
      expect(row?.productId).toBe(product.id);
    });

    it('olmayan productSlug 422 UNKNOWN_REFERENCE döner ve kayıt oluşmaz', async () => {
      const error = await catchHttp(service.create({ ...valid('noprod'), productSlug: `yok-${run}` }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({ productSlug: 'UNKNOWN_REFERENCE' });
      expect(await prisma.quoteRequest.count({ where: { companyName: company('noprod') } })).toBe(0);
    });
  });

  describe('doğrulama (422 VALIDATION_FAILED)', () => {
    it('eksik zorunlu alanlar REQUIRED, onay yoksa CONSENT_REQUIRED döner', async () => {
      const error = await catchHttp(service.create({}));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).fieldErrors).toEqual({
        companyName: 'REQUIRED',
        email: 'REQUIRED',
        vehicleCount: 'REQUIRED',
        durationMonths: 'REQUIRED',
        vehicleType: 'REQUIRED',
        consent: 'CONSENT_REQUIRED',
      });
    });

    it.each([[0], [10001], [-1]])('araç sayısı aralık dışı OUT_OF_RANGE: %p', async (count) => {
      const error = await catchHttp(service.create({ ...valid('cnt'), vehicleCount: count }));
      expect(bodyOf(error).fieldErrors).toEqual({ vehicleCount: 'OUT_OF_RANGE' });
    });

    it.each([[0], [121]])('süre aralık dışı OUT_OF_RANGE: %p', async (months) => {
      const error = await catchHttp(service.create({ ...valid('dur'), durationMonths: months }));
      expect(bodyOf(error).fieldErrors).toEqual({ durationMonths: 'OUT_OF_RANGE' });
    });

    it('sayı yerine metin gönderilirse INVALID_FORMAT döner', async () => {
      const error = await catchHttp(service.create({ ...valid('str'), vehicleCount: '10' }));
      expect(bodyOf(error).fieldErrors).toEqual({ vehicleCount: 'INVALID_FORMAT' });
    });

    it('geçersiz e-posta ve telefon ayrı ayrı bildirilir', async () => {
      const error = await catchHttp(service.create({ ...valid('fmt'), email: 'x', phone: 'abc' }));
      expect(bodyOf(error).fieldErrors).toEqual({ email: 'INVALID_EMAIL', phone: 'INVALID_FORMAT' });
    });

    it('çok uzun not TOO_LONG döner', async () => {
      const error = await catchHttp(service.create({ ...valid('long'), notes: 'n'.repeat(2001) }));
      expect(bodyOf(error).fieldErrors).toEqual({ notes: 'TOO_LONG' });
    });

    it('geçersiz taleplerden hiçbiri kaydedilmez', async () => {
      await catchHttp(service.create({ ...valid('inv'), vehicleCount: 0 }));
      expect(await prisma.quoteRequest.count({ where: { companyName: company('inv') } })).toBe(0);
    });
  });

  describe('spam', () => {
    it('tuzak alan doluysa 422 SPAM_DETECTED döner ve kayıt oluşmaz', async () => {
      const error = await catchHttp(service.create({ ...valid('spam'), website: 'http://spam.example' }));
      expect(error.getStatus()).toBe(422);
      expect(bodyOf(error).code).toBe('SPAM_DETECTED');
      expect(await prisma.quoteRequest.count({ where: { companyName: company('spam') } })).toBe(0);
    });

  });
});