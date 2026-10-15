import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CONTACT_LIMIT_PER_HOUR, ContactService } from './contact.service.js';
import { RateLimiter } from './rate-limiter.js';

// Entegrasyon testi: POST /contact, gerçek PostgreSQL'e karşı (BACKLOG Y34).
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

describeDb('POST /contact iletişim formu (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ContactService;
  const run = randomUUID().slice(0, 8);
  const email = (label: string) => `contact-${run}-${label}@novera.example`;
  const client = () => `client-${randomUUID()}`;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ContactService(prisma, new RateLimiter());
  });

  afterAll(async () => {
    await prisma.contactMessage.deleteMany({ where: { email: { contains: `contact-${run}-` } } });
    await prisma.$disconnect();
  });

  const valid = (label: string) => ({
    name: 'Ayşe Yılmaz',
    email: email(label),
    phone: '0532 123 45 67',
    subject: 'Kurumsal fiyat',
    message: 'Merhaba, bilgi almak istiyorum.',
    consent: true,
  });

  it('geçerli form kaydedilir ve { received: true } döner', async () => {
    const before = Date.now();
    const result = await service.create(valid('ok'), client());
    expect(result).toEqual({ received: true });

    const row = await prisma.contactMessage.findFirst({ where: { email: email('ok') } });
    expect(row).not.toBeNull();
    expect(row?.name).toBe('Ayşe Yılmaz');
    expect(row?.phone).toBe('0532 123 45 67');
    expect(row?.subject).toBe('Kurumsal fiyat');
    expect(row?.message).toBe('Merhaba, bilgi almak istiyorum.');
    // KVKK onay zamanı sunucuda kaydedilir
    expect(row?.kvkkConsentAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(row?.kvkkConsentAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('telefon isteğe bağlıdır: boş telefon null olarak kaydedilir', async () => {
    await service.create({ ...valid('nophone'), phone: '' }, client());
    const row = await prisma.contactMessage.findFirst({ where: { email: email('nophone') } });
    expect(row?.phone).toBeNull();
  });

  it('metin alanları kırpılır', async () => {
    await service.create({ ...valid('trim'), name: '  Ali  ', subject: '  Konu  ' }, client());
    const row = await prisma.contactMessage.findFirst({ where: { email: email('trim') } });
    expect(row?.name).toBe('Ali');
    expect(row?.subject).toBe('Konu');
  });

  it('tuzak alan doluysa 422 SPAM_DETECTED döner ve hiçbir şey kaydedilmez', async () => {
    const error = await catchHttp(service.create({ ...valid('spam'), website: 'http://spam.example' }, client()));
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).code).toBe('SPAM_DETECTED');
    expect(await prisma.contactMessage.count({ where: { email: email('spam') } })).toBe(0);
  });

  it('eksik alanlar REQUIRED, onay yoksa CONSENT_REQUIRED döner; kayıt oluşmaz', async () => {
    const error = await catchHttp(service.create({}, client()));
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).code).toBe('VALIDATION_FAILED');
    expect(bodyOf(error).fieldErrors).toEqual({
      name: 'REQUIRED',
      email: 'REQUIRED',
      subject: 'REQUIRED',
      message: 'REQUIRED',
      consent: 'CONSENT_REQUIRED',
    });
  });

  it('geçersiz e-posta ve çok uzun mesaj ayrı ayrı bildirilir', async () => {
    const error = await catchHttp(
      service.create({ ...valid('bad'), email: 'bu-bir-adres-degil', message: 'x'.repeat(4001) }, client()),
    );
    expect(error.getStatus()).toBe(422);
    expect(bodyOf(error).fieldErrors).toEqual({ email: 'INVALID_EMAIL', message: 'TOO_LONG' });
  });

  it('onay false ise reddedilir ve kaydedilmez', async () => {
    const error = await catchHttp(service.create({ ...valid('noconsent'), consent: false }, client()));
    expect(bodyOf(error).fieldErrors?.consent).toBe('CONSENT_REQUIRED');
    expect(await prisma.contactMessage.count({ where: { email: email('noconsent') } })).toBe(0);
  });

  it('aynı istemci saatte sınırdan fazla gönderirse 429 RATE_LIMITED; başka istemci etkilenmez', async () => {
    const heavy = client();
    for (let i = 0; i < CONTACT_LIMIT_PER_HOUR; i += 1) {
      await service.create(valid(`rate-${i}`), heavy);
    }
    const error = await catchHttp(service.create(valid('rate-extra'), heavy));
    expect(error.getStatus()).toBe(429);
    expect(bodyOf(error).code).toBe('RATE_LIMITED');
    expect(await prisma.contactMessage.count({ where: { email: email('rate-extra') } })).toBe(0);

    const other = await service.create(valid('rate-other'), client());
    expect(other).toEqual({ received: true });
  });
});
