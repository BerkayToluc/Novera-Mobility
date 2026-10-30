import 'reflect-metadata';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureApp } from '../../app.setup.js';
import { AuthModule } from '../../auth/auth.module.js';
import { FakePrisma } from '../../auth/auth.testing.js';
import { RateLimitModule } from '../../common/rate-limit.module.js';
import { RateLimitStore } from '../../common/rate-limit.store.js';
import { MemoryRateLimitStore } from '../../common/rate-limit.testing.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AdminModule } from '../admin.module.js';
import { AdminMessagesService } from '../messages/messages.service.js';
import type { MessageDetail } from '../messages/messages.view.js';
import { AdminQuotesService } from './quotes.service.js';
import type { QuoteDetail } from './quotes.view.js';

// "Every change is written to the audit log" (V2-32, ADR-24) for the quote requests and the contact messages: the action, the
// number or id, and the NAMES of the fields that were sent, never their values. The internal note, the customer's name and
// e-mail and what a message says are not in the log. The services are replaced by ones that answer, so this is only about what
// the interceptor writes.
const fake = new FakePrisma();

@Global()
@Module({ providers: [{ provide: PrismaService, useValue: fake }], exports: [PrismaService] })
class FakePrismaModule {}

const NUMBER = 'TKL-2026-00042';
const MESSAGE_ID = '6f0a1f7e-8f5e-4b86-9f5c-2d2f6d9a0b11';
const QUOTE: QuoteDetail = {
  id: '0b1c2d3e-8f5e-4b86-9f5c-2d2f6d9a0b22',
  number: NUMBER,
  status: 'OFFERED',
  source: 'WEB',
  companyName: 'Ege Lojistik',
  contactName: 'Ayşe Yılmaz',
  email: 'ayse@ege-lojistik.example',
  vehicleCount: 8,
  durationMonths: 12,
  vehicleType: 'SUV',
  productSlug: null,
  createdAt: '2026-10-29T10:00:00.000Z',
  updatedAt: '2026-10-29T10:00:00.000Z',
  anonymized: false,
  phone: null,
  deliveryCities: null,
  notes: null,
  internalNote: 'Gizli indirim payı',
  account: null,
  nextStatuses: ['CLOSED'],
};
const MESSAGE: MessageDetail = {
  id: MESSAGE_ID,
  name: 'Ayşe Yılmaz',
  email: 'ayse@example.com',
  subject: 'Fiyat sorusu',
  preview: 'Merhaba',
  createdAt: '2026-10-29T10:00:00.000Z',
  handledAt: '2026-10-30T10:00:00.000Z',
  anonymized: false,
  phone: null,
  message: 'Merhaba, fiyat almak istiyoruz.',
  handledBy: null,
};
const quotes = { list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }), get: async () => QUOTE, update: async () => QUOTE };
const messages = { list: async () => ({ items: [], total: 0, page: 1, pageSize: 20 }), get: async () => MESSAGE, handle: async () => MESSAGE };

describe('quote requests and contact messages in the audit log (V2-32)', () => {
  let app: INestApplication;
  let base = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakePrismaModule, AuthModule, RateLimitModule, AdminModule] })
      .overrideProvider(AdminQuotesService)
      .useValue(quotes)
      .overrideProvider(AdminMessagesService)
      .useValue(messages)
      .overrideProvider(RateLimitStore)
      .useValue(new MemoryRateLimitStore())
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0);
    base = await app.getUrl();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    fake.users = [];
    fake.sessions = [];
    fake.throttles = [];
    fake.auditLogs = [];
  });

  let counter = 0;
  const call = (method: string, path: string, options: { body?: unknown; cookie?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': `10.9.${Math.floor(counter / 250)}.${(counter += 1) % 250}`,
        ...(options.cookie ? { Cookie: options.cookie } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  async function administrator() {
    const response = await call('POST', '/auth/register', {
      body: { email: `yonetici${counter}@example.com`, password: 'long-enough-1', firstName: 'Ece', lastName: 'Aydın', consent: true },
    });
    const cookie = (response.headers.get('set-cookie') ?? '').split(';')[0]!;
    const user = fake.users.at(-1)!;
    user.role = 'ADMIN';
    return { cookie, id: user.id as string };
  }

  it('a change to a quote and a mark on a message each leave one row: action, number or id, only the field names', async () => {
    const { cookie, id } = await administrator();
    expect((await call('PATCH', `/admin/quotes/${NUMBER.toLowerCase()}`, { cookie, body: { updatedAt: QUOTE.updatedAt, status: 'OFFERED', internalNote: 'Gizli indirim payı' } })).status).toBe(200);
    expect((await call('PATCH', `/admin/contact-messages/${MESSAGE_ID}`, { cookie, body: { handled: true } })).status).toBe(200);

    expect(fake.auditLogs).toHaveLength(2);
    // The number in the path is written the way it is stored, whatever case it came in.
    expect(fake.auditLogs[0]).toMatchObject({ actorId: id, action: 'quote.update', entity: 'quote', entityId: NUMBER, fields: ['updatedAt', 'status', 'internalNote'] });
    expect(fake.auditLogs[1]).toMatchObject({ action: 'contact-message.handle', entity: 'contact-message', entityId: MESSAGE_ID, fields: ['handled'] });
    // Names only: not the note, not the company or the person, not what the message says.
    const written = JSON.stringify(fake.auditLogs);
    for (const secret of ['Gizli indirim', 'Ege Lojistik', 'Ayşe', 'ayse@', 'fiyat almak']) expect(written).not.toContain(secret);
  });

  it('a read is not logged', async () => {
    const { cookie } = await administrator();
    expect((await call('GET', '/admin/quotes', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/quotes/${NUMBER}`, { cookie })).status).toBe(200);
    expect((await call('GET', '/admin/contact-messages', { cookie })).status).toBe(200);
    expect((await call('GET', `/admin/contact-messages/${MESSAGE_ID}`, { cookie })).status).toBe(200);
    expect(fake.auditLogs).toHaveLength(0);
  });
});
