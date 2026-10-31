import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { RESEND_URL } from '../auth/reset-link-notifier.js';
import { MailService } from './mail.service.js';

const KEYS = ['RESEND_API_KEY', 'MAIL_FROM'] as const;
const MAIL = { subject: 'Konu', text: 'Metin', html: '<p>Metin</p>' };

describe('MailService (V2-44)', () => {
  const saved: Record<string, string | undefined> = {};
  let calls: Array<{ url: string; init: RequestInit }>;
  let logs: jest.SpyInstance[];

  const service = (answer: () => Promise<Response>) => {
    const instance = new MailService();
    instance.fetcher = async (url, init) => {
      calls.push({ url, init });
      return answer();
    };
    return instance;
  };
  const ok = async () => new Response('{"id":"1"}', { status: 200 });

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    calls = [];
    logs = (['log', 'debug', 'warn', 'error'] as const).map((level) => jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined));
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    jest.restoreAllMocks();
  });

  const written = () => JSON.stringify(logs.flatMap((spy) => spy.mock.calls));

  it('sends nothing, and says so, without the two settings', async () => {
    const mail = service(ok);
    expect(mail.enabled).toBe(false);
    expect(await mail.send('ayse@example.com', MAIL, 'booking-confirmed')).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('sends through Resend, with the key, the sender, the address and both bodies, when it is set up', async () => {
    process.env.RESEND_API_KEY = 're_secret_key';
    process.env.MAIL_FROM = 'Novera <bildirim@novera.example>';
    const mail = service(ok);
    expect(mail.enabled).toBe(true);
    expect(await mail.send('ayse@example.com', MAIL, 'booking-confirmed')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(RESEND_URL);
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer re_secret_key');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ from: 'Novera <bildirim@novera.example>', to: ['ayse@example.com'], ...MAIL });
  });

  it('never throws and never writes the address or the key to the log: a refusal, a network failure, a timeout', async () => {
    process.env.RESEND_API_KEY = 're_secret_key';
    process.env.MAIL_FROM = 'bildirim@novera.example';
    const refused = service(async () => new Response('{"to":"ayse@example.com"}', { status: 422 }));
    const down = service(async () => {
      throw new TypeError('fetch failed for ayse@example.com');
    });
    const slow = service(async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    });
    for (const instance of [refused, down, slow]) expect(await instance.send('ayse@example.com', MAIL, 'booking-confirmed')).toBe(false);
    const log = written();
    expect(log).toContain('422');
    expect(log).not.toContain('ayse@example.com');
    expect(log).not.toContain('re_secret_key');
  });
});
