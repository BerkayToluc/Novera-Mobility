import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ContentService } from './content.service.js';

// Entegrasyon testi: GET /faq, /products, /products/:slug, /services (BACKLOG #33),
// gerçek PostgreSQL'e karşı. Yalnızca adında "test" geçen veritabanında çalışır;
// TEST_DATABASE_URL yoksa atlanır. Testler kendi satırlarını oluşturur ve siler,
// veritabanında başka satır olsa da yalnızca kendi kayıtlarına bakar.
const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl && !/test/i.test(databaseUrl)) {
  throw new Error('TEST_DATABASE_URL adında "test" geçen bir veritabanını göstermeli.');
}
const describeDb = databaseUrl ? describe : describe.skip;

type Text = { tr: string; en: string };
type List = { tr: string[]; en: string[] };

async function catchHttp(promise: Promise<unknown>): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('HttpException bekleniyordu ama hata atılmadı');
}

const text = (tr: string, en: string): Text => ({ tr, en });
const list = (tr: string[], en: string[]): List => ({ tr, en });

describeDb('içerik uçları: SSS, ürünler, hizmetler (gerçek PostgreSQL)', () => {
  let prisma: PrismaService;
  let service: ContentService;
  const run = randomUUID().slice(0, 8);
  const created = { faq: [] as string[], products: [] as string[], services: [] as string[] };

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    prisma = new PrismaService();
    await prisma.$connect();
    service = new ContentService(prisma);
  });

  afterAll(async () => {
    await prisma.faqItem.deleteMany({ where: { id: { in: created.faq } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    await prisma.service.deleteMany({ where: { id: { in: created.services } } });
    await prisma.$disconnect();
  });

  async function addFaq(
    audience: 'INDIVIDUAL' | 'CORPORATE',
    sortOrder: number,
    topic: 'rezervasyon' | 'odeme' | 'teslim' | 'hasar' | 'hesap' | 'kurumsal' = 'rezervasyon',
  ): Promise<string> {
    const row = await prisma.faqItem.create({
      data: {
        audience,
        topic,
        sortOrder,
        question: text(`Soru ${run} ${sortOrder}`, `Question ${run} ${sortOrder}`),
        answer: text(`Cevap ${sortOrder}`, `Answer ${sortOrder}`),
      },
    });
    created.faq.push(row.id);
    return row.id;
  }

  async function addProduct(label: string, sortOrder: number, featured = false): Promise<string> {
    const slug = `test-urun-${run}-${label}`;
    const row = await prisma.product.create({
      data: {
        slug,
        sortOrder,
        featured,
        title: text(`Ürün ${label}`, `Product ${label}`),
        concept: text('Konsept', 'Concept'),
        whatYouGet: text('Ne alıyorsunuz', 'What you get'),
        techBenefits: list(['Madde 1', 'Madde 2'], ['Item 1', 'Item 2']),
      },
    });
    created.products.push(row.id);
    return slug;
  }

  async function addService(label: string, sortOrder: number): Promise<string> {
    const slug = `test-hizmet-${run}-${label}`;
    const row = await prisma.service.create({
      data: {
        slug,
        sortOrder,
        title: text(`Hizmet ${label}`, `Service ${label}`),
        summary: text('Özet', 'Summary'),
        points: list(['A', 'B', 'C'], ['A', 'B', 'C']),
      },
    });
    created.services.push(row.id);
    return slug;
  }

  describe('GET /faq', () => {
    it('her öğe yalnızca sözleşmedeki alanları taşır', async () => {
      const id = await addFaq('INDIVIDUAL', 1, 'odeme');
      const items = await service.getFaq();
      const item = items.find((i) => i.id === id);
      expect(item).toBeDefined();
      expect(Object.keys(item ?? {}).sort()).toEqual(['answer', 'audience', 'id', 'question', 'topic']);
      expect(item?.audience).toBe('INDIVIDUAL');
      expect(item?.topic).toBe('odeme');
      expect(item?.question.tr).toContain('Soru');
      expect(item?.question.en).toContain('Question');
    });

    it('audience=INDIVIDUAL kurumsal soruları içermez', async () => {
      const individual = await addFaq('INDIVIDUAL', 1);
      const corporate = await addFaq('CORPORATE', 1, 'kurumsal');
      const ids = (await service.getFaq('INDIVIDUAL')).map((i) => i.id);
      expect(ids).toContain(individual);
      expect(ids).not.toContain(corporate);
    });

    it('audience=CORPORATE bireysel soruları içermez', async () => {
      const individual = await addFaq('INDIVIDUAL', 2);
      const corporate = await addFaq('CORPORATE', 2, 'kurumsal');
      const ids = (await service.getFaq('CORPORATE')).map((i) => i.id);
      expect(ids).toContain(corporate);
      expect(ids).not.toContain(individual);
    });

    it('audience verilmezse iki kitle de döner (Yardım merkezi)', async () => {
      const individual = await addFaq('INDIVIDUAL', 3);
      const corporate = await addFaq('CORPORATE', 3, 'kurumsal');
      const ids = (await service.getFaq()).map((i) => i.id);
      expect(ids).toContain(individual);
      expect(ids).toContain(corporate);
    });

    it('aynı kitlede sortOrder sırasına göre döner', async () => {
      const third = await addFaq('INDIVIDUAL', 903);
      const first = await addFaq('INDIVIDUAL', 901);
      const second = await addFaq('INDIVIDUAL', 902);
      const mine = new Set([first, second, third]);
      const ordered = (await service.getFaq('INDIVIDUAL')).map((i) => i.id).filter((id) => mine.has(id));
      expect(ordered).toEqual([first, second, third]);
    });

    it('bireysel sorular kurumsal sorulardan önce gelir', async () => {
      const corporate = await addFaq('CORPORATE', 1, 'kurumsal');
      const individual = await addFaq('INDIVIDUAL', 999);
      const mine = new Set([corporate, individual]);
      const ordered = (await service.getFaq()).map((i) => i.id).filter((id) => mine.has(id));
      expect(ordered).toEqual([individual, corporate]);
    });

    it.each([['individual'], ['KURUMSAL'], [''], ['INDIVIDUAL,CORPORATE']])(
      'geçersiz audience reddedilir: "%s"',
      async (value) => {
        const error = await catchHttp(service.getFaq(value));
        expect(error.getStatus()).toBe(422);
        const body = error.getResponse() as { code: string; fieldErrors: Record<string, string> };
        expect(body.code).toBe('VALIDATION_FAILED');
        expect(body.fieldErrors.audience).toBe('INVALID_FORMAT');
      },
    );

    it('audience birden fazla kez verilirse (dizi) reddedilir', async () => {
      const error = await catchHttp(service.getFaq(['INDIVIDUAL', 'CORPORATE']));
      expect(error.getStatus()).toBe(422);
    });
  });

  describe('GET /products', () => {
    it('ürün yalnızca sözleşmedeki alanları taşır (sortOrder sızmaz)', async () => {
      const slug = await addProduct('a', 1, true);
      const product = (await service.getProducts()).find((p) => p.slug === slug);
      expect(product).toBeDefined();
      expect(Object.keys(product ?? {}).sort()).toEqual([
        'concept',
        'featured',
        'slug',
        'techBenefits',
        'title',
        'whatYouGet',
      ]);
      expect(product?.featured).toBe(true);
      expect(product?.techBenefits.tr).toEqual(['Madde 1', 'Madde 2']);
      expect(product?.techBenefits.en).toEqual(['Item 1', 'Item 2']);
    });

    it('sortOrder sırasına göre döner', async () => {
      const second = await addProduct('ikinci', 902);
      const first = await addProduct('birinci', 901);
      const mine = new Set([first, second]);
      const ordered = (await service.getProducts()).map((p) => p.slug).filter((s) => mine.has(s));
      expect(ordered).toEqual([first, second]);
    });
  });

  describe('GET /products/:slug', () => {
    it('slug ile ürünü döner', async () => {
      const slug = await addProduct('detay', 5);
      const product = await service.getProduct(slug);
      expect(product.slug).toBe(slug);
      expect(product.title.tr).toBe('Ürün detay');
      expect(product.title.en).toBe('Product detay');
      expect(product.featured).toBe(false);
    });

    it('olmayan slug 404 NOT_FOUND döner', async () => {
      const error = await catchHttp(service.getProduct(`yok-${randomUUID()}`));
      expect(error.getStatus()).toBe(404);
      expect((error.getResponse() as { code: string }).code).toBe('NOT_FOUND');
    });
  });

  describe('GET /services', () => {
    it('hizmet yalnızca sözleşmedeki alanları taşır', async () => {
      const slug = await addService('a', 1);
      const item = (await service.getServices()).find((s) => s.slug === slug);
      expect(item).toBeDefined();
      expect(Object.keys(item ?? {}).sort()).toEqual(['points', 'slug', 'summary', 'title']);
      expect(item?.points.tr).toEqual(['A', 'B', 'C']);
    });

    it('sortOrder sırasına göre döner', async () => {
      const second = await addService('ikinci', 902);
      const first = await addService('birinci', 901);
      const mine = new Set([first, second]);
      const ordered = (await service.getServices()).map((s) => s.slug).filter((s) => mine.has(s));
      expect(ordered).toEqual([first, second]);
    });
  });
});
